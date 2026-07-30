import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A sub-user who joins an Office while still paying for their OWN Pro
// subscription must always be able to SEE and CANCEL that subscription.
//
// The failure this guards against (plans audit, 2026-07): the cancel/keep/portal
// routes allowed it (billing audit #6A), but the READ model and the Settings
// page did not — so the subscription kept charging with no way to even see it
// in the app, while the UI said "billing is managed by your organization".
// A billing trap: real money, invisible.
//
// And the counter-invariant, which is the truly dangerous direction: that
// visibility must NEVER let a plain sub-user act on the ORG's subscription.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("a sub-user's own subscription is visible and cancellable", () => {
  const OWN_SUB = /allowIfOwnSubscription:\s*true/;

  it("the billing read model lets them in — without it no UI can render at all", () => {
    expect(read("src/app/api/stripe/subscription/route.ts")).toMatch(OWN_SUB);
  });

  it("cancel, keep and portal keep letting them in", () => {
    for (const r of ["cancel", "keep"]) {
      expect(read(`src/app/api/stripe/subscription/${r}/route.ts`), r).toMatch(OWN_SUB);
    }
    expect(read("src/app/api/stripe/portal/route.ts"), "portal").toMatch(OWN_SUB);
  });

  it("the Settings page shows the billing section when they have their own sub", () => {
    const src = read("src/app/settings/flows/page.tsx");
    const at = src.indexOf("const canSeeBilling");
    expect(at).toBeGreaterThan(-1);
    const decl = src.slice(at, src.indexOf(";", at));
    expect(decl, "canSeeBilling no longer accounts for a personal subscription").toContain("stripe_subscription_id");
  });

  it("the read model flags the trimmed view, and the UI renders it", () => {
    expect(read("src/app/api/stripe/subscription/route.ts")).toMatch(/personalSubOnly/);
    const ui = read("src/components/BillingManager.tsx");
    expect(ui).toMatch(/sub\.personalSubOnly/);
    expect(ui, "trimmed view lost its cancel action").toMatch(/PersonalSubCard/);
  });

  it("joining a team tells them, durably and inline", () => {
    const api = read("src/app/api/join/route.ts");
    // Assert on the success RESPONSE itself, not just anywhere in the file —
    // the flag being computed but dropped from the payload is exactly the
    // regression this catches (a variable-only match survived that mutation).
    const at = api.lastIndexOf("return NextResponse.json(");
    const responseBlock = api.slice(at, api.indexOf("});", at) + 3);
    expect(responseBlock, "join success response no longer carries hasPersonalSubscription").toContain("hasPersonalSubscription");
    expect(api, "join no longer leaves the bell notification").toMatch(/personal_sub_reminder/);
    expect(read("src/components/JoinButton.tsx")).toMatch(/hasPersonalSubscription/);
  });
});

describe("that visibility can never reach the ORG's subscription", () => {
  it("billing subject resolves to the owner ONLY behind manage_billing", () => {
    // The disaster case: if resolveBillingSubjectId ever mapped a plain
    // sub-user to the owner, their "cancel my personal sub" click would cancel
    // the ORGANIZATION's subscription and tear down the whole team.
    const src = read("src/lib/office-roles.ts");
    const at = src.indexOf("export async function resolveBillingSubjectId");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n}", at));
    expect(body).toContain('roleHasCapability(ctx.role, "manage_billing")');
    // Exactly one return path yields the owner, and it's the guarded one.
    expect(body.split("ctx.ownerId").length - 1).toBeGreaterThanOrEqual(1);
    expect(body).toContain("return userId");
  });

  it("plan switching stays closed to them — a seated member has no plan to switch", () => {
    // change-plan deliberately does NOT get allowIfOwnSubscription: their
    // account plan is the seat's ("enterprise"); switching would corrupt it.
    const src = read("src/app/api/stripe/subscription/change-plan/route.ts");
    expect(src).not.toMatch(/allowIfOwnSubscription/);
  });

  it("allowIfOwnSubscription checks the caller's OWN row, nothing else", () => {
    const src = read("src/lib/office-roles.ts");
    const at = src.indexOf("if (opts?.allowIfOwnSubscription)");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 400);
    expect(block).toContain('.eq("id", userId)');
    expect(block).toContain("stripe_subscription_id");
  });
});
