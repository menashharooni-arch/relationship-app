import { describe, it, expect } from "vitest";
import { isProTrialEligible } from "@/lib/trial-eligibility";

// The 14-day Pro trial's eligibility contract, shared by the checkout API (the
// enforcement), /upgrade, and the two Pro dialogs (the advertising). These pin
// every branch so no surface can quietly start promising — or denying — a trial
// differently from the session Stripe actually creates.
//
// THE RULE CHANGED ON 2026-09-11. It used to be "has this customer EVER had a
// subscription", which refused a trial to anyone who had subscribed and
// cancelled — including the owner testing their own product, who saw a cold
// "$4.99 a month" and reasonably read it as the trial being broken. It is the
// ordinary rule now: no SECOND free trial. A prior subscription only
// disqualifies you if it actually carried one.

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

  // THE RULE THAT STILL HOLDS: one trial per customer.
  it("a subscription that carried a trial blocks a second one", async () => {
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", trial_start: 1735689600 }]))).toBe(false);
  });

  it("cancel during the trial, come back → still no second trial", async () => {
    // status:"all" is what the helper queries, so a sub in any state appears
    // here; this is what makes "cancel mid-trial, re-subscribe, new trial"
    // impossible.
    expect(
      await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "canceled", trial_start: 1735689600, trial_end: 1736899200 }])),
    ).toBe(false);
  });

  it("one trialled subscription among several still blocks", async () => {
    expect(
      await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1" }, { id: "sub_2", trial_end: 1736899200 }, { id: "sub_3" }])),
    ).toBe(false);
  });

  // THE RULE THAT CHANGED: paying from day one does not spend your trial.
  it("a returning customer who never trialled IS offered one", async () => {
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "canceled" }]))).toBe(true);
    expect(
      await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "canceled", trial_start: null, trial_end: null }])),
    ).toBe(true);
  });

  // AND THE INVERSION. The old version refused when Stripe could not be
  // reached, reasoning that wrongly promising a trial costs trust. That was
  // right while the copy was quiet about it; with "14-day free trial" on the
  // front of every Pro dialog it is backwards, because an unreachable Stripe
  // would silently turn the headline offer into a cold price for EVERYONE —
  // which is exactly what a missing STRIPE_SECRET_KEY did. Stripe imposes no
  // one-trial-per-customer rule of its own, so granting is always deliverable.
  it("Stripe unreachable → eligible, so the headline promise stays keepable", async () => {
    const broken = { subscriptions: { list: async () => { throw new Error("network"); } } };
    expect(await isProTrialEligible("cus_123", broken)).toBe(true);
  });

  it("asks for enough history to answer the question", async () => {
    // limit:1 answers "did the MOST RECENT subscription have a trial", which is
    // a different question — an older trialled sub would be missed.
    let seen: { limit?: number } = {};
    await isProTrialEligible("cus_123", {
      subscriptions: { list: async (p: { customer: string; status: "all"; limit: number }) => { seen = p; return { data: [] }; } },
    });
    expect(seen.limit).toBeGreaterThanOrEqual(100);
    expect(seen).toMatchObject({ status: "all" });
  });
});
