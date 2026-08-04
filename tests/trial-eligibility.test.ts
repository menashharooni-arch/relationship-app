import { describe, it, expect } from "vitest";
import { isProTrialEligible } from "@/lib/trial-eligibility";

// The 14-day Pro trial's eligibility contract, shared by the checkout API (the
// enforcement) and /upgrade (the advertising): FIRST-TIME subscribers only,
// judged by Stripe's own subscription history. These tests pin every branch so
// neither surface can quietly start promising (or denying) trials differently.

function stripeWith(subs: unknown[]) {
  return { subscriptions: { list: async () => ({ data: subs }) } };
}

describe("isProTrialEligible", () => {
  it("no Stripe customer at all → eligible (they have never subscribed)", async () => {
    expect(await isProTrialEligible(null)).toBe(true);
    expect(await isProTrialEligible(undefined)).toBe(true);
    expect(await isProTrialEligible("")).toBe(true);
  });

  it("customer with zero subscriptions ever → eligible", async () => {
    expect(await isProTrialEligible("cus_123", stripeWith([]))).toBe(true);
  });

  it("ANY prior subscription — even one — blocks a second trial", async () => {
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1" }]))).toBe(false);
  });

  it("a canceled-during-trial subscription still counts as having had the trial", async () => {
    // status:"all" is what the helper queries, so a sub in any state appears
    // here; this is what makes "cancel during trial, re-subscribe, new trial"
    // impossible.
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "canceled" }]))).toBe(false);
  });

  it("Stripe unreachable → NOT eligible (never promise a trial we can't verify)", async () => {
    const broken = { subscriptions: { list: async () => { throw new Error("network"); } } };
    expect(await isProTrialEligible("cus_123", broken)).toBe(false);
  });
});
