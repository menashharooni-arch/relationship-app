import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The Office admin account, end to end (2026-09-23 review) ─────────────────
// Every block names the defect it stops coming back.

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const after = (s: string, marker: string) => s.slice(s.indexOf(marker));

describe("removing a member", () => {
  const route = code("src/app/api/office/members/route.ts");

  it("strips the brand BEFORE handing the cards back (it matched nothing after)", () => {
    const strip = route.indexOf("await stripBrandFromUserCards(member.user_id, brand);");
    const unflag = route.indexOf('.update({ is_office_card: false }).eq("user_id", member.user_id)');
    expect(strip).toBeGreaterThan(-1);
    expect(unflag).toBeGreaterThan(strip);
    expect(route.split("stripBrandFromUserCards(").length - 1).toBe(1);
  });

  it("settles their plan, so a newer account's card isn't held behind the plan step", () => {
    expect(route).toContain("[PLAN_CHOSEN_KEY]: plan");
  });

  it("tells them it was a removal, and where their card went", () => {
    expect(route).toContain("body: officeRemovedMessage(plan)");
    const msg = code("src/lib/office-billing-sync.ts");
    expect(msg).toContain("You were removed from your team");
    expect(msg).toContain("Settings → Cards and sharing");
  });

  it("from the person's own page, the dialogs survive (no refresh into a 404)", () => {
    const ta = code("src/components/office/TeamActions.tsx");
    expect(ta).toContain("const refresh = () => { if (!onPersonPage) router.refresh(); };");
    expect(code("src/app/office/admin/team/[id]/page.tsx")).toContain("onPersonPage />");
  });
});

describe("an Office that ends keeps its team to come back to", () => {
  const sync = code("src/lib/office-billing-sync.ts");
  const teardown = after(sync, "export async function tearDownOfficeForOwner");

  it("suspends ACTIVE members only, never deletes the office or the roster", () => {
    expect(teardown).toContain('.eq("status", "active")');
    expect(teardown).toContain('update({ status: "suspended" })');
    expect(teardown).not.toContain('from("office_members").delete()');
    expect(teardown).not.toContain('from("offices").delete()');
  });

  it("hands the cards back unbranded, and keeps a newer member's first card live", () => {
    expect(teardown.indexOf("stripBrandFromUserCards(uid, brand)")).toBeLessThan(teardown.indexOf('update({ is_office_card: false })'));
    expect(teardown).toContain("[PLAN_CHOSEN_KEY]: fallback");
  });

  it("re-subscribing restores members WITH the current brand, and no stale expiry", () => {
    const restore = after(sync, "async function restoreSuspendedMembers");
    expect(restore).toContain("if (brand) await applyBrandToUserCards(uid, brand)");
    expect(restore).toContain('update({ plan_expires_at: null })');
  });

  it("the purge only touches people still attached, and respects their own Pro", () => {
    const purge = code("src/lib/account-purge.ts");
    expect(purge).toContain('.eq("id", m.user_id as string).eq("office_id", officeId)');
    expect(purge).toContain("memberFallbackPlan(m.user_id as string)");
  });

  it("admin tools that move an owner off Office release the team", () => {
    for (const f of ["src/app/api/admin/set-plan/route.ts", "src/app/api/admin/users/[id]/route.ts"]) {
      const c = code(f);
      expect(c).toContain("tearDownOfficeForOwner(admin,");
      expect(c).toContain("This account pays for Office through Stripe.");
    }
  });
});

describe("billing says what happens, and lets you do what it offers", () => {
  const bm = code("src/components/BillingManager.tsx");

  it("Office → Pro asks first, and says what happens to the team", () => {
    expect(bm).toContain('onSelect={() => (sub.plan === "office" ? setConfirmPro(true) : choose("pro"))}');
    expect(bm).toContain("Switch to Pro and end your team?");
    expect(bm).toContain("The unused part of Office is credited to your next invoice.");
    expect(bm).not.toContain("you&apos;re only charged the difference");
  });

  it("monthly ↔ annual can actually be switched", () => {
    expect(bm).toContain('const onInterval = (sub.interval ?? "monthly") === interval;');
    expect(bm).toContain('current={sub.plan === "pro" && onInterval}');
    expect(bm).toContain('sub.plan === "office" && onInterval');
  });

  it("the cancel dialog no longer claims teammates' cards go offline", () => {
    expect(bm).not.toContain("Every teammate's card goes offline");
    expect(bm).toContain("keeping their first card live without your company branding");
  });

  it("never says Pro to an Office owner", () => {
    expect(bm).not.toContain("to keep Pro — your access continues");
    expect(bm).not.toMatch(/>Free Pro · ends/);
    expect(bm).toContain('"Your Office subscription is active on this account.');
  });

  it("in the app: a load failure is not a paywall, and a failed payment is shown", () => {
    const native = bm.slice(bm.indexOf("if (native) {"), bm.indexOf("Loading billing…"));
    expect(native).toContain("if (!sub) {");
    expect(native).toContain("Your last payment didn&apos;t go through.");
    expect(native).toContain("openExternalPurchase(\"/settings/flows?billing=1#billing\")");
  });
});

describe("the admin console's own actions", () => {
  it("Branding keeps both tabs mounted, and refreshes after a save", () => {
    const ob = code("src/components/OfficeBranding.tsx");
    expect(ob).toContain('<div hidden={tab !== "links"}>');
    expect(ob).toContain('<div hidden={tab !== "card"}>');
    expect(ob).toContain("router.refresh();");
    expect(code("src/components/OfficeLinksBranding.tsx")).toContain("router.refresh();");
  });

  it("an admin's phone edit changes the number the card SHOWS", () => {
    const r = code("src/app/api/office/cards/[id]/route.ts");
    expect(r).toContain('if ("phone" in updates && typeof updates.phone === "string")');
    expect(r).toContain("p.office !== true");
  });

  it("taking a card offline tells its owner, and refreshes the public page", () => {
    const r = code("src/app/api/office/cards/[id]/route.ts");
    expect(r).toContain('"Your team admin took your card offline"');
    expect(r).toContain("revalidateCardPage(beforeCard.username as string)");
  });

  it("a delegated admin isn't offered edits on the owner's card", () => {
    expect(code("src/components/office/TeamList.tsx")).toContain("(!person.isOwner || caps.viewerIsOwner)");
    expect(code("src/app/office/admin/team/[id]/page.tsx")).toContain("(!isOwner || viewerIsOwner)");
  });

  it("the Leads export works from the iOS app (download token)", () => {
    expect(code("src/lib/download-token.ts")).toContain('"/api/office/leads/export"');
    expect(code("src/lib/native-file.ts")).toContain('"/api/office/leads/export"');
  });

  it("claiming a draft follows the member rules", () => {
    const c = code("src/app/api/drafts/claim/route.ts");
    expect(c).toContain('error: "team_card_limit"');
    expect(c).toMatch(/if \(subCtx\) \{[\s\S]{0,600}insert\.is_office_card = true;/);
  });
});

describe("the app never paints /pricing, and sign-in keeps where you were going", () => {
  const proxy = code("src/proxy.ts");
  it("redirects an app request for /pricing before any HTML", () => {
    const top = proxy.slice(proxy.indexOf("export async function proxy"), proxy.indexOf("let supabaseResponse"));
    expect(top).toContain('request.nextUrl.pathname === "/pricing"');
    expect(top).toContain('NextResponse.redirect(new URL("/dashboard", request.url))');
    expect(proxy).toMatch(/"\/pricing",\n\s*\],/);
  });
  it("the login wall carries next", () => {
    expect(proxy).toContain('login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);');
  });
});

describe("the owner can delete a team member's account (members can't delete their own)", () => {
  const r = code("src/app/api/office/members/delete-account/route.ts");

  it("owner only — not a delegated admin", () => {
    expect(r).toContain("if (!ctx || !ctx.isOwner)");
    expect(r).toContain("Only the Office owner can delete a team member's account.");
  });

  it("removes them from the team with the Remove button's own handler, THEN soft-deletes", () => {
    expect(r).toContain('import { DELETE as removeFromTeam } from "../route";');
    const removeAt = r.indexOf("await removeFromTeam(");
    const deleteAt = r.indexOf("_deleted: true");
    expect(removeAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(removeAt);
    expect(r).toContain("stopSubscription(");
    expect(r).toContain("revokeAppleTokensOnDelete(target)");
  });

  it("never the owner themselves, only an active member of THIS office", () => {
    expect(r).toContain('.eq("office_id", ctx.officeId)');
    expect(r).toContain('member.status !== "active"');
    expect(r).toContain("targetId === user.id || targetId === ctx.ownerId");
  });

  it("the person is emailed and can reopen within 30 days", () => {
    expect(r).toContain('subject: "Your SwiftCard account was deleted"');
    expect(r).toContain("within 30 days");
  });

  it("the button is shown only to the owner, behind a typed DELETE", () => {
    const ta = code("src/components/office/TeamActions.tsx");
    expect(ta).toContain('typed.trim().toUpperCase() !== "DELETE"');
    expect(code("src/components/office/TeamList.tsx")).toContain("{caps.viewerIsOwner && <DeleteMemberAccountButton");
    expect(code("src/app/office/admin/team/[id]/page.tsx")).toContain("{viewerIsOwner && <DeleteMemberAccountButton");
  });

  it("members still cannot delete their own account", () => {
    const self = code("src/app/api/account/delete/route.ts");
    expect(self).toContain("officeSubUserBlockMessage(user.id");
  });
});
