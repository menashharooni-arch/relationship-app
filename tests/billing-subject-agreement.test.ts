import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── You may only act on what you were shown ─────────────────────────────────
//
// resolveBillingSubjectId returns the OWNER's id for a delegated billing_admin
// — that is the role working as intended. The bug was that only the WRITES
// asked. The subscription GET read `user.id`, so a billing_admin who also held
// a personal subscription was shown their own plan, and pressing Cancel would
// have cancelled the organisation's. Money moves through these five routes;
// they have to agree on whose money.

const WRITE_ROUTES = [
  "src/app/api/stripe/subscription/cancel/route.ts",
  "src/app/api/stripe/subscription/change-plan/route.ts",
  "src/app/api/stripe/subscription/discount/route.ts",
  "src/app/api/stripe/subscription/keep/route.ts",
  "src/app/api/stripe/subscription/preview/route.ts",
];
const READ_ROUTE = "src/app/api/stripe/subscription/route.ts";

describe("every billing route resolves the same subject", () => {
  for (const f of WRITE_ROUTES) {
    it(`${f.split("/").slice(-2)[0]} resolves through resolveBillingSubjectId`, () => {
      expect(read(f)).toContain("resolveBillingSubjectId(user.id)");
    });
  }

  it("the READ model resolves it too", () => {
    expect(read(READ_ROUTE)).toContain("resolveBillingSubjectId(user.id)");
  });

  it("the read model no longer looks up the profile by the CALLER's id", () => {
    const src = read(READ_ROUTE);
    const lookup = src.slice(src.indexOf('.from("profiles")'), src.indexOf('.single()'));
    expect(lookup).toContain('.eq("id", subjectId)');
    expect(lookup, "the profile is still read for user.id, not the billing subject").not.toContain('.eq("id", user.id)');
  });

  it("the office row is read for the subject, so seat counts are not silently empty", () => {
    const src = read(READ_ROUTE);
    const office = src.slice(src.indexOf('.from("offices")'), src.indexOf(".maybeSingle()", src.indexOf('.from("offices")')));
    expect(office).toContain('.eq("owner_id", subjectId)');
  });

  it("tells the UI when it is showing the organisation's subscription", () => {
    // Otherwise the screen is honest about the numbers and silent about whose
    // they are, which is the same confusion in a quieter form.
    expect(read(READ_ROUTE)).toContain("managingOrgBilling");
  });
});

describe("a delegated billing_admin loses the delegation when the Office plan lapses", () => {
  it("re-checks the owner's paid plan, like requireOfficeCapability does", () => {
    // Membership outlives the subscription on purpose (re-subscribing restores
    // the team), and /api/admin/set-plan changes profiles.plan with no office
    // teardown. Without this check a stale billing_admin could reach the
    // ex-owner's now-PERSONAL subscription. /seats already refused in that
    // state through requireOfficeCapability — these five routes disagreed.
    const src = read("src/lib/office-roles.ts");
    const fn = src.slice(src.indexOf("export async function resolveBillingSubjectId"), src.indexOf("export async function requireOfficeCapability"));
    expect(fn).toContain("isOfficePlan");
    expect(fn).toContain('.from("profiles")');
    // And it falls back to the caller's own account rather than the ex-owner's.
    expect(fn).toMatch(/if \(!isOfficePlan\([\s\S]{0,60}\)\) return userId;/);
  });
});
