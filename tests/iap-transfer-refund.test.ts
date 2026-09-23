import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { decideRcEvent } from "../src/lib/iap-entitlement";

// Restore Purchases on a second SwiftCard account moves the Apple subscription
// there. RevenueCat reports it as TRANSFER, with transferred_from /
// transferred_to and no app_user_id — the webhook skipped it as "anonymous", so
// the first account kept Pro forever. And a refund arrives as CANCELLATION
// (cancel_reason CUSTOMER_SUPPORT), which on its own is ignored.
const route = readFileSync("src/app/api/iap/revenuecat/route.ts", "utf8");
const rest = readFileSync("src/lib/revenuecat-rest.ts", "utf8");

describe("a transferred Apple subscription moves Pro with it", () => {
  it("handles TRANSFER before the app_user_id lookup that skipped it", () => {
    expect(route).toMatch(/type === "TRANSFER"/);
    expect(route.indexOf('type === "TRANSFER"')).toBeLessThan(route.indexOf('skipped: "anonymous"'));
    expect(route).toContain("event.transferred_from");
    expect(route).toContain("event.transferred_to");
  });

  it("the losing account is decided as an expiry, the receiving one as a renewal", () => {
    expect(route).toMatch(/transferred_from\)\)[\s\S]*applyEvent\(admin, uid, "EXPIRATION"/);
    expect(route).toMatch(/transferred_to\)\)[\s\S]*applyEvent\(admin, uid, "RENEWAL"/);
  });

  it("never takes Pro off an account RevenueCat still shows as active", () => {
    expect(route).toMatch(/rcProActive\(uid\)\) === true\) \{ applied\[uid\] = "still_active"; continue; \}/);
  });

  it("the expiry side keeps every source guard: a Stripe payer or an Office stays", () => {
    expect(decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: "stripe", hasStripeSubscription: true }).action).toBe("ignore");
    expect(decideRcEvent({ eventType: "EXPIRATION", currentPlan: "pro", planSource: "apple", hasStripeSubscription: false }).action).toBe("revoke");
    expect(decideRcEvent({ eventType: "RENEWAL", currentPlan: "enterprise", planSource: "stripe", hasStripeSubscription: true }).action).toBe("ignore");
  });

  it("sandbox events are still gated before any decision", () => {
    expect(route.indexOf("sandboxEventAllowed(")).toBeLessThan(route.indexOf("decideRcEvent("));
  });
});

describe("a refunded Apple purchase ends Pro", () => {
  it("a CUSTOMER_SUPPORT cancellation revokes only when RevenueCat says it is no longer active", () => {
    expect(route).toMatch(/cancel_reason\?\.toUpperCase\(\) === "CUSTOMER_SUPPORT"/);
    expect(route).toMatch(/rcProActive\(uid\)\) === false\)[\s\S]*applyEvent\(admin, uid, "EXPIRATION"/);
  });

  it("the RevenueCat check is server-to-server with the secret key, and unknown is null", () => {
    expect(rest).toContain("api.revenuecat.com/v1/subscribers");
    expect(rest).toContain("REVENUECAT_SECRET_KEY");
    expect(rest).toMatch(/if \(!secret\) return null/);
  });
});
