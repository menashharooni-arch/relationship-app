import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// A second checkout opened in the seconds between paying and Stripe's webhook
// landing created a second subscription; the webhook then cancelled the first
// with no refund, so a no-trial buyer paid twice.
const route = readFileSync("src/app/api/stripe/checkout/route.ts", "utf8");

describe("checkout refuses to start a second subscription during the webhook gap", () => {
  it("asks Stripe for this account's completed subscription checkouts from the last hour", () => {
    expect(route).toMatch(/checkout\.sessions\.list\(\{\s*status: "complete"/);
    expect(route).toMatch(/created: \{ gte: Math\.floor\(Date\.now\(\) \/ 1000\) - 3600 \}/);
    expect(route).toContain("s.client_reference_id !== user.id");
  });

  it("only a subscription that is still alive blocks — a cancelled one does not", () => {
    expect(route).toMatch(/\["active", "trialing", "past_due", "incomplete"\]\.includes\(sub\.status\)/);
  });

  it("answers the same 409 + redirect the checkout pages already follow", () => {
    const guard = route.slice(route.indexOf("The webhook gap"), route.indexOf("recent-session check failed"));
    expect(guard).toContain('error: "already_subscribed"');
    expect(guard).toContain("redirect: `/checkout/success?plan=");
    expect(guard).toContain("status: 409");
  });

  it("runs before a new Checkout Session is created, and never blocks on its own failure", () => {
    expect(route.indexOf("The webhook gap")).toBeLessThan(route.indexOf("stripe.checkout.sessions.create("));
    expect(route).toContain("[checkout] recent-session check failed:");
  });
});
