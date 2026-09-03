import { describe, expect, it } from "vitest";
import { decideRcEvent, sandboxEventAllowed, stripeDowngradeAllowed } from "@/lib/iap-entitlement";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The two-source plan rule: a billing source may only revoke what it
//    granted ─────────────────────────────────────────────────────────────────
//
// These are the cases that, gotten wrong, either strip Pro from a paying
// customer (support nightmare) or leave Pro on a lapsed one (revenue leak).

describe("decideRcEvent — Apple grants", () => {
  for (const type of ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "SUBSCRIPTION_EXTENDED"]) {
    it(`${type} grants pro regardless of prior state`, () => {
      expect(
        decideRcEvent({ eventType: type, currentPlan: "free", planSource: null, hasStripeSubscription: false }),
      ).toEqual({ action: "grant" });
    });
  }
  it("a grant never overwrites OFFICE — Apple only sells Pro, and office is the higher tier", () => {
    // Real sequence: Pro bought in the app, then upgraded to Office on the web.
    // The Apple sub's next RENEWAL must not downgrade the row back to pro.
    expect(
      decideRcEvent({ eventType: "RENEWAL", currentPlan: "enterprise", planSource: "stripe", hasStripeSubscription: true }),
    ).toEqual({ action: "ignore" });
    expect(
      decideRcEvent({ eventType: "INITIAL_PURCHASE", currentPlan: "enterprise", planSource: null, hasStripeSubscription: false }),
    ).toEqual({ action: "ignore" });
  });

  it("the instant-sync route carries the same office guard", () => {
    const src = readFileSync("src/app/api/iap/sync/route.ts", "utf8");
    expect(src).toMatch(/isOfficePlan\(profile\?\.plan\) \|\| profile\?\.office_id/);
    expect(src).toMatch(/select\("plan, customization, office_id"\)/);
  });

  it("grant is case-insensitive on event type", () => {
    expect(
      decideRcEvent({ eventType: "initial_purchase", currentPlan: null, planSource: null, hasStripeSubscription: false }),
    ).toEqual({ action: "grant" });
  });
});

describe("decideRcEvent — Apple revokes only its own grant", () => {
  it("EXPIRATION revokes an apple-sourced pro", () => {
    expect(
      decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: "apple", hasStripeSubscription: false }),
    ).toEqual({ action: "revoke" });
  });
  it("EXPIRATION must NOT touch a stripe-sourced plan", () => {
    expect(
      decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: "stripe", hasStripeSubscription: true }),
    ).toEqual({ action: "ignore" });
  });
  it("EXPIRATION must NOT touch a plan with no recorded source (pre-IAP Stripe rows)", () => {
    expect(
      decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: null, hasStripeSubscription: false }),
    ).toEqual({ action: "ignore" });
  });
  it("EXPIRATION with a live Stripe sub on the row is ignored even if source says apple", () => {
    expect(
      decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: "apple", hasStripeSubscription: true }),
    ).toEqual({ action: "ignore" });
  });
  it("EXPIRATION on an already-free row is a no-op", () => {
    expect(
      decideRcEvent({ eventType: "EXPIRATION", currentPlan: "free", planSource: "apple", hasStripeSubscription: false }),
    ).toEqual({ action: "ignore" });
  });
});

describe("decideRcEvent — lifecycle noise is ignored", () => {
  // CANCELLATION = auto-renew switched off, access CONTINUES to period end.
  // Revoking on it is the classic IAP bug: the customer paid for the month
  // and loses it the day they toggle renewal.
  for (const type of ["CANCELLATION", "BILLING_ISSUE", "SUBSCRIBER_ALIAS", "TRANSFER", "TEST"]) {
    it(`${type} changes nothing`, () => {
      expect(
        decideRcEvent({ eventType: type, currentPlan: "pro", planSource: "apple", hasStripeSubscription: false }),
      ).toEqual({ action: "ignore" });
    });
  }
});

describe("stripeDowngradeAllowed", () => {
  it("blocks the Stripe cancel path when Apple backs the plan", () => {
    expect(stripeDowngradeAllowed("apple")).toBe(false);
  });
  it("allows it for stripe-sourced and legacy (no source) rows", () => {
    expect(stripeDowngradeAllowed("stripe")).toBe(true);
    expect(stripeDowngradeAllowed(null)).toBe(true);
    expect(stripeDowngradeAllowed(undefined)).toBe(true);
  });
});

// ── Wiring pins: the rule above only protects customers if the webhooks
//    actually consult it ─────────────────────────────────────────────────────

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("webhook wiring", () => {
  it("the Stripe deletion downgrade is gated on stripeDowngradeAllowed", () => {
    const s = read("src/app/api/stripe/webhook/route.ts");
    const idx = s.indexOf('update({ plan: "free" })');
    expect(idx).toBeGreaterThan(-1);
    const before = s.slice(Math.max(0, idx - 600), idx);
    expect(before).toContain("stripeDowngradeAllowed");
  });
  it("the RevenueCat webhook refuses without its bearer token", () => {
    const s = read("src/app/api/iap/revenuecat/route.ts");
    expect(s).toContain("REVENUECAT_WEBHOOK_TOKEN");
    expect(s).toMatch(/status: 401/);
    expect(s).toMatch(/status: 503/); // unconfigured → closed, not open
  });
  it("the instant-sync route verifies with RevenueCat, never the client's word", () => {
    const s = read("src/app/api/iap/sync/route.ts");
    expect(s).toContain("api.revenuecat.com/v1/subscribers");
    expect(s).not.toMatch(/req\.json|request\.json/); // takes no client-supplied claims
  });
});

describe("paywall compliance pins (App Review 3.1.2)", () => {
  const s = read("src/components/NativePaywall.tsx");
  it("has Restore Purchases, terms + privacy links, and the renewal disclosure", () => {
    expect(s).toContain("Restore Purchases");
    expect(s).toContain('href="/terms"');
    expect(s).toContain('href="/privacy"');
    expect(s).toMatch(/renew automatically/i);
  });
  it("never hardcodes a price — StoreKit's priceString is the only source", () => {
    expect(s).toContain("priceString");
    expect(s).not.toMatch(/\$\d/);
  });
  it("does not steer to the website from the paywall", () => {
    expect(s).not.toMatch(/swiftcard\.me/);
  });
});

describe("sandbox purchases never grant production Pro (except review/test accounts)", () => {
  it("allows only the designated review/test accounts, case-insensitively", () => {
    expect(sandboxEventAllowed("applereview@swiftcard.me")).toBe(true);
    expect(sandboxEventAllowed("applereview-free@swiftcard.me")).toBe(true);
    expect(sandboxEventAllowed("iap-test@swiftcard.me")).toBe(true);
    expect(sandboxEventAllowed(" AppleReview@SwiftCard.me ")).toBe(true);
    expect(sandboxEventAllowed("anyone@example.com")).toBe(false);
    expect(sandboxEventAllowed("")).toBe(false);
    expect(sandboxEventAllowed(null)).toBe(false);
    expect(sandboxEventAllowed(undefined)).toBe(false);
  });
  it("the webhook gates SANDBOX events through sandboxEventAllowed before any plan change", () => {
    const s = read("src/app/api/iap/revenuecat/route.ts");
    expect(s).toContain('"SANDBOX"');
    expect(s).toContain("sandboxEventAllowed");
    expect(s.indexOf("sandboxEventAllowed(") ).toBeLessThan(s.indexOf("decideRcEvent("));
  });
  it("the instant-sync route checks is_sandbox on the backing subscription", () => {
    const s = read("src/app/api/iap/sync/route.ts");
    expect(s).toContain("is_sandbox");
    expect(s).toContain("sandboxEventAllowed");
    expect(s.indexOf("is_sandbox")).toBeLessThan(s.indexOf("appleGrantPatch(customization)"));
  });
});
