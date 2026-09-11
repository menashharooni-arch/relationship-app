import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isProTrialEligible } from "@/lib/trial-eligibility";

// The 14-day Pro trial is offered to EVERYONE (owner, 2026-09-11). This pins
// that, and pins the reason the function still exists: four surfaces have to
// agree about the offer — the checkout API that creates the Stripe session,
// /upgrade, and the two Pro dialogs — so the sentence printed on a button and
// the session it produces can never disagree.
//
// The rule has moved twice. It was "has this customer EVER subscribed", which
// refused the trial to anyone who had subscribed once and stopped. Then it was
// "has this customer already USED a trial", the textbook rule, which still
// showed a cold "$4.99 a month" to the very person who reported it. Both times
// the headline offer quietly became a bare price for real people. It is
// unconditional now.

describe("isProTrialEligible", () => {
  it("is true for a brand-new account", async () => {
    expect(await isProTrialEligible(null)).toBe(true);
    expect(await isProTrialEligible(undefined)).toBe(true);
    expect(await isProTrialEligible("")).toBe(true);
  });

  it("is true for a returning customer, however much history they have", async () => {
    const withHistory = {
      subscriptions: {
        list: async () => ({ data: [{ id: "sub_1", status: "canceled", trial_start: 1735689600, trial_end: 1736899200 }] }),
      },
    };
    expect(await isProTrialEligible("cus_123", withHistory)).toBe(true);
  });

  // The case that was reported four times: an account that had already trialled
  // saw "$4.99 a month" with no trial line, on both the web and the app.
  it("is true for someone who has already had a trial", async () => {
    const trialled = {
      subscriptions: { list: async () => ({ data: [{ id: "sub_1", trial_start: 1735689600 }] }) },
    };
    expect(await isProTrialEligible("cus_UtLt5fRNh2gh66", trialled)).toBe(true);
  });

  it("is true when Stripe cannot be reached at all", async () => {
    const broken = { subscriptions: { list: async () => { throw new Error("network"); } } };
    expect(await isProTrialEligible("cus_123", broken)).toBe(true);
  });

  it("never calls Stripe — there is nothing left to ask it", async () => {
    let called = false;
    await isProTrialEligible("cus_123", {
      subscriptions: { list: async () => { called = true; return { data: [] }; } },
    });
    expect(called).toBe(false);
  });
});

describe("one answer, shared by every surface that promises it", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  // If any of these started deciding for itself, the promise on its button
  // could drift from the session the checkout creates — which is the whole
  // reason this lives in one function.
  it.each([
    ["src/app/api/stripe/checkout/route.ts", "the session Stripe actually creates"],
    ["src/app/upgrade/page.tsx", "the upgrade page"],
    ["src/app/cards/[id]/edit/page.tsx", "the Save Changes dialog"],
    ["src/app/dashboard/page.tsx", "the Add card dialog"],
  ])("%s asks the shared helper (%s)", (file) => {
    expect(read(file)).toContain("isProTrialEligible");
  });

  it("the checkout still grants real trial days, not just copy", () => {
    const checkout = read("src/app/api/stripe/checkout/route.ts");
    expect(checkout).toContain("trial_period_days");
    expect(checkout).toContain("TRIAL_DAYS");
  });
});
