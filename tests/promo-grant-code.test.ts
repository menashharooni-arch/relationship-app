import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isDiscountType, isGrantCode, promoLabel, durationLabel } from "../src/lib/promo";

const route = readFileSync("src/app/api/promo/redeem/route.ts", "utf8");

// ── Why this file exists ────────────────────────────────────────────────────
//
// The tester code opens a paid plan with no payment. That is exactly the shape
// of thing that goes wrong quietly: a grant that reaches a real subscriber
// would put an expiry on an account Stripe is still charging, and the daily
// cron would then downgrade a paying customer. So the rules the route relies
// on are pinned here rather than left to a careful reading.
describe("grant codes — the vocabulary", () => {
  it("is a real discount type, so an admin form can't reject it", () => {
    expect(isDiscountType("grant")).toBe(true);
    expect(isGrantCode({ discount_type: "grant" })).toBe(true);
    expect(isGrantCode({ discount_type: "percent" })).toBe(false);
  });

  it("describes itself by the plan it opens, not by a discount", () => {
    expect(promoLabel({ discount_type: "grant", applies_to: "office", free_days: 30 })).toContain("Office");
    expect(promoLabel({ discount_type: "grant", applies_to: "pro", free_days: 14 })).toContain("Pro");
    // No "% off" or "$ off" language on a code that discounts nothing.
    expect(promoLabel({ discount_type: "grant", applies_to: "pro", free_days: 14 })).not.toMatch(/off/);
  });

  it("has no billing duration — nothing recurs", () => {
    expect(durationLabel({ discount_type: "grant", duration: "forever" })).toBe("");
  });
});

describe("grant codes — what the redeem route must guarantee", () => {
  it("refuses an account that already has a Stripe subscription", () => {
    expect(route).toContain("stripe_subscription_id");
    expect(route).toMatch(/only works on an account with no subscription/i);
  });

  it("never writes a plan down", () => {
    // An Office account redeeming a Pro tester code must stay Office.
    expect(route).toContain('prof?.plan === "enterprise" ? "enterprise" : "pro"');
  });

  it("sets an expiry, so a granted plan always ends on its own", () => {
    expect(route).toContain("plan_expires_at");
    expect(route).toContain("days * 86400000");
  });

  it("clears the Stripe-trial keys, so no charge notice is ever sent", () => {
    for (const key of ["_trialEndsAt", "_trialChargeCents", "_trialChargeWarnedFor"]) {
      expect(route).toContain(`delete cust.${key}`);
    }
  });

  it("gives a granted Office an actual office to administer", () => {
    expect(route).toContain("provisionOfficeForOwner");
  });

  it("records the redemption before handing anything out", () => {
    const redemption = route.indexOf("promo_code_redemptions");
    // The LAST check is the one that hands the plan out. An earlier one — the
    // signed-out preview — only refuses a grant code (there is no account).
    const grant = route.lastIndexOf("isGrantCode(promo)");
    expect(redemption).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(redemption);
  });

  it("stays off Stripe entirely", () => {
    expect(route).not.toMatch(/getStripe|stripe\.(subscriptions|checkout|coupons)/);
  });
});
