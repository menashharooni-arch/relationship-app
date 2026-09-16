import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import { isProTrialEligible } from "@/lib/trial-eligibility";

// ── ONE TRIAL PER CUSTOMER (owner, 2026-09-15) ───────────────────────────────
//
// A customer with ANY prior Stripe subscription — active, canceled, past_due or
// trialing — gets no second trial.
//
// This rule has now moved three times, and the two previous settings both came
// back, so the history is worth keeping in the test as well as the source:
//
//   1. "ever subscribed"      → refused the trial to anyone who had subscribed
//                               once and stopped, the owner's test accounts
//                               included.
//   2. "already used a trial" → the textbook rule; still showed a cold "$4.99 a
//                               month" to the person who reported it.
//   3. unconditional          → simple and loud, but made "for new customers"
//                               on /pricing untrue.
//
// We are back to rule 1, chosen with that history in view. The known cost is
// that a previously-subscribed account sees the plain price. When that is
// reported, it is this policy working — change the policy here, not a surface.
//
// The function exists at all because four surfaces print the promise before
// anyone reaches checkout, and the sentence on a button must never disagree
// with the session Stripe creates.

/** A Stripe stand-in whose subscriptions.list returns whatever we hand it. */
const stripeWith = (data: unknown[], onCall?: () => void) =>
  ({
    subscriptions: {
      list: async () => {
        onCall?.();
        return { data };
      },
    },
  }) as unknown as Stripe;

describe("isProTrialEligible", () => {
  it("is true for a brand-new account, without asking Stripe", async () => {
    let called = false;
    const spy = stripeWith([], () => { called = true; });
    expect(await isProTrialEligible(null, spy)).toBe(true);
    expect(await isProTrialEligible(undefined, spy)).toBe(true);
    expect(await isProTrialEligible("", spy)).toBe(true);
    // No customer id means there is nothing to look up — the common case must
    // not cost a network round trip on every dashboard and upgrade render.
    expect(called).toBe(false);
  });

  it("is true for a Stripe customer with no subscriptions yet", async () => {
    // A customer record can exist before the first subscription (an abandoned
    // checkout creates one). That person is still new.
    expect(await isProTrialEligible("cus_123", stripeWith([]))).toBe(true);
  });

  it("is FALSE for someone who has already had a trial", async () => {
    const trialled = stripeWith([{ id: "sub_1", status: "canceled", trial_start: 1735689600 }]);
    expect(await isProTrialEligible("cus_UtLt5fRNh2gh66", trialled)).toBe(false);
  });

  it("is FALSE for a returning customer who never trialled", async () => {
    // Rule 1, not rule 2: having subscribed at all is what disqualifies, even
    // if they paid from day one and never took a trial.
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "canceled" }]))).toBe(false);
  });

  it("is FALSE for a currently-active subscriber", async () => {
    expect(await isProTrialEligible("cus_123", stripeWith([{ id: "sub_1", status: "active" }]))).toBe(false);
  });

  it("counts canceled and expired history — status:'all' is load-bearing", async () => {
    // Stripe's default list omits canceled subscriptions, which are exactly the
    // ones that make somebody a returning customer. If this regresses, every
    // churned customer silently gets another free fortnight.
    let opts: Record<string, unknown> | undefined;
    const capture = {
      subscriptions: {
        list: async (o: Record<string, unknown>) => { opts = o; return { data: [] }; },
      },
    } as unknown as Stripe;
    await isProTrialEligible("cus_123", capture);
    expect(opts?.status).toBe("all");
    expect(opts?.customer).toBe("cus_123");
  });

  it("FAILS OPEN when Stripe cannot be reached", async () => {
    // A first-time customer shown a cold price during a Stripe blip is a lost
    // sale and reads as the product being broken; a wrongly-granted trial costs
    // 14 days of one $4.99 subscription. Fail towards the offer.
    const broken = {
      subscriptions: { list: async () => { throw new Error("network"); } },
    } as unknown as Stripe;
    expect(await isProTrialEligible("cus_123", broken)).toBe(true);
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

  it("the 'new customers' copy is true again, and stays paired with the rule", () => {
    // Under the unconditional rule this wording was a lie. It is accurate under
    // one-trial-per-customer, and the two must move together.
    expect(read("src/lib/trial-eligibility.ts")).toMatch(/subscriptions\.list/);
    expect(read("src/app/pricing/page.tsx")).toMatch(/for new customers/);
  });
});
