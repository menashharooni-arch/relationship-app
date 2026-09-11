import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const webhook = read("src/app/api/stripe/webhook/route.ts");
const billing = read("src/lib/office-billing-sync.ts");

// ── A lapsed subscription must not destroy the team ─────────────────────────
//
// Both automated cascades deleted the office_members row. So an office whose
// card expired for a week came back to an empty roster: re-subscribing meant
// re-inviting all fourteen people, each accepting a fresh email — while
// lib/office-roles claimed "the offices row outlives the subscription on
// purpose (so re-subscribing restores the team)". The offices row surviving on
// its own restores nothing.

describe("neither cascade deletes a membership", () => {
  it("uses the shared release helper instead of a delete", () => {
    expect(webhook).toContain("async function releaseOfficeMember(");
    // Two call sites: the seat trim and the cancellation.
    const calls = webhook.match(/await releaseOfficeMember\(/g) ?? [];
    expect(calls.length, "a cascade stopped using the helper").toBe(2);
  });

  it("no cascade still hard-deletes office_members", () => {
    expect(
      /from\("office_members"\)\.delete\(\)/.test(webhook),
      "a cascade is hard-deleting memberships again",
    ).toBe(false);
  });

  it("suspends, which every office query already treats as inert", () => {
    // Every office query filters status 'active' or 'pending', so a suspended
    // row reserves no seat, receives no brand and leaves the lead list —
    // exactly what the old delete wanted — while surviving for restoration.
    expect(webhook).toMatch(/update\(\{ status: "suspended" \}\)/);
  });
});

describe("a released member gets their cards back", () => {
  it("clears is_office_card so the card is not permanently stranded", () => {
    // api/cards/[id] refuses to bring an is_office_card card back online:
    // "Your company manages this card. Ask your Office admin to bring it back
    // online." After a lapse there is no office and no admin. The manual
    // removal path already clears the flag; neither cascade did.
    const helper = webhook.slice(webhook.indexOf("async function releaseOfficeMember("), webhook.indexOf("export async function POST("));
    expect(helper).toContain("is_office_card: false");
  });

  it("does NOT take their card offline — a lapse is not a removal", () => {
    // Manual removal takes the card offline deliberately (the company is
    // handing back a card it branded). A lapse is different: nobody did
    // anything wrong, so the card stays live and simply becomes theirs.
    const helper = webhook.slice(webhook.indexOf("async function releaseOfficeMember("), webhook.indexOf("export async function POST("));
    expect(helper).not.toContain("is_offline: true");
  });

  it("hands the cards back BEFORE the row goes inert", () => {
    // Ordered so a failure cannot leave a card flagged to an office that no
    // longer claims it.
    const helper = webhook.slice(webhook.indexOf("async function releaseOfficeMember("), webhook.indexOf("export async function POST("));
    expect(helper.indexOf("is_office_card: false")).toBeLessThan(helper.indexOf('status: "suspended"'));
  });
});

describe("re-subscribing actually restores the team", () => {
  it("provisioning restores suspended members", () => {
    expect(billing).toContain("restoreSuspendedMembers");
    expect(billing).toMatch(/await restoreSuspendedMembers\(admin, officeId, seats\)/);
  });

  it("never restores past the seats actually bought", () => {
    // An owner returning on FEWER seats than they left with must not end up
    // over capacity — the seat gate would then be in a state the UI cannot
    // explain.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/seats - 1 - \(activeCount \?\? 0\) - \(pendingCount \?\? 0\)/);
    expect(fn).toContain("if (room <= 0) return;");
    expect(fn).toContain("if (room <= 0) break;");
  });

  it("counts pending invites against capacity too", () => {
    // A pending invite reserves a seat everywhere else in the product; if
    // restoration ignored them the office could be pushed over its seat count.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/\.eq\("status", "pending"\)/);
  });

  it("restores oldest-first, the exact inverse of how the trim removes", () => {
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/\.order\("joined_at", \{ ascending: true \}\)/);
    // And the trim it mirrors uses the same ordering.
    expect(webhook).toMatch(/\.order\("joined_at", \{ ascending: true \}\)/);
  });

  it("never steals someone who joined another office while suspended", () => {
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/\.neq\("office_id", officeId\)/);
    expect(fn).toContain("taken.has(uid)");
  });

  it("re-flags their cards as office cards", () => {
    // NOT cosmetic. /api/office/brand scopes every propagation with
    // .eq("is_office_card", true) — which releaseOfficeMember cleared — so
    // without this a restored teammate silently stops receiving branding. The
    // admin changes the logo, sees "Applied to every card", and one person's
    // card never updates with nothing saying why. Same pair api/join sets.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/is_office_card: true/);
    expect(read("src/app/api/join/route.ts")).toMatch(/is_office_card: true/);
  });

  it("tells them their access is back", () => {
    // They were told "Your Office access ended" when it lapsed. Being put back
    // silently is its own kind of broken — their plan and their card's
    // branding change under them.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toContain("insertNotification");
    expect(fn).toMatch(/Your Office access is back/);
    // And a failed notification must never abort the restore.
    expect(fn).toMatch(/\}\)\.catch\(\(\) => \{\}\);/);
  });

  it("restores the plan and office link, not just the row", () => {
    // The cascade set plan to free and office_id to null. A membership row
    // without them is a member who cannot use anything.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/plan: "enterprise", office_id: officeId/);
  });

  it("only counts a seat for a member it actually restored", () => {
    // Decrementing before the write would silently shrink capacity on an error
    // and strand the rest of the roster.
    const fn = billing.slice(billing.indexOf("async function restoreSuspendedMembers"));
    expect(fn).toMatch(/if \(error\) continue;[\s\S]{0,1400}room--;/);
  });

  it("cannot block provisioning if it fails", () => {
    // Restoring a roster is a nicety; taking someone's money and not giving
    // them an office is not.
    expect(billing).toMatch(/try \{ await restoreSuspendedMembers\([\s\S]{0,60}\} catch/);
  });
});

describe("a suspended person can still be re-invited by hand", () => {
  it("the invite route reuses any non-active row", () => {
    // Belt and braces: if restoration skipped someone (capacity, or they were
    // in another office), inviting their address again must just work rather
    // than colliding with the surviving row.
    const invite = read("src/app/api/office/invite/route.ts");
    expect(invite).toMatch(/status: "pending", user_id: null, joined_at: null/);
    // Only an ACTIVE row is refused as "already a member".
    expect(invite).toContain('existing?.status === "active"');
  });
});

describe("a suspended invite link cannot half-join someone", () => {
  const join = read("src/app/api/join/route.ts");

  it("refuses a suspended membership explicitly", () => {
    // The link in their original invite email still resolves. Without this the
    // route falls through: the activation UPDATE is scoped to status='pending'
    // so it silently matches nothing, and the rest of the route still applies
    // the plan, the office brand and the is_office_card flag to somebody who
    // is not a member.
    expect(join).toContain('member.status === "suspended"');
    expect(join).toMatch(/plan is no longer active/);
  });

  it("rejects every non-pending status before the activation update", () => {
    const guards = join.slice(0, join.indexOf("Accept: mark active"));
    for (const st of ["active", "revoked", "declined", "suspended"]) {
      expect(guards, `status "${st}" is not refused up front`).toContain(`member.status === "${st}"`);
    }
  });

  it("fails closed when the row did not end up active for this user", () => {
    // Defence in depth for any status added later. Checked on the RESULTING
    // state, not on who won the race, so a legitimate double-submit — where
    // another request activated the same row for the same person — still
    // completes their setup.
    expect(join).toContain("if (!didActivate) {");
    expect(join).toMatch(/settled\?\.status !== "active" \|\| settled\?\.user_id !== user\.id/);
  });
});
