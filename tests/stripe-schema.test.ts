import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import { subscriptionPeriodEnd, subscriptionPeriodEndIso } from "@/lib/stripe";

// STRIPE SCHEMA DRIFT — two live defects, one root cause.
//
// Both were caused by `as unknown as` casts asserting a shape Stripe no longer
// returns. The cast is the whole problem: it tells the compiler to stop
// checking, so the field silently reads `undefined` instead of failing to
// build. Nothing errored, nothing logged — the UI just showed wrong numbers.
//
//   current_period_end — moved off Subscription onto SubscriptionItem.
//     Verified against the installed SDK: it appears in
//     SubscriptionItems.d.ts as a real field, and in Subscriptions.d.ts only
//     inside doc prose. Symptoms: seat REDUCTION always 503'd (the route reads
//     a missing period end as a Stripe failure) and every billing date
//     rendered blank — "Your plan is scheduled to end on ."
//
//   line.proration — the top-level flag is gone; it lives at
//     parent.subscription_item_details.proration. Stripe's own SDK docs say so
//     (Invoices.d.ts: "consider line items where
//     parent.subscription_item_details.proration is true"). Symptom: the
//     seat-add modal quoted "Charged today $0.00" — because the filter matched
//     nothing and the sum was always zero — and then charged the real prorated
//     amount via always_invoice. A false consent statement attached to a real
//     charge.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Minimal shapes — we only exercise the field this helper reads.
const subWithItem = (end?: number) =>
  ({ items: { data: [{ current_period_end: end }] } } as unknown as Stripe.Subscription);

describe("subscriptionPeriodEnd reads the ITEM, not the subscription", () => {
  it("returns the item's period end", () => {
    expect(subscriptionPeriodEnd(subWithItem(1767225600))).toBe(1767225600);
  });

  it("ignores a period end on the SUBSCRIPTION — that shape is gone", () => {
    // The exact shape the old casts assumed. If a future refactor reaches for
    // it again, this stays undefined and the test fails.
    const legacy = { current_period_end: 1767225600, items: { data: [{}] } } as unknown as Stripe.Subscription;
    expect(subscriptionPeriodEnd(legacy)).toBeUndefined();
  });

  it("survives a subscription with no items rather than throwing", () => {
    expect(subscriptionPeriodEnd({ items: { data: [] } } as unknown as Stripe.Subscription)).toBeUndefined();
    expect(subscriptionPeriodEnd({} as unknown as Stripe.Subscription)).toBeUndefined();
  });

  it("formats to ISO, or null — never a bogus epoch-zero date", () => {
    expect(subscriptionPeriodEndIso(subWithItem(1767225600))).toBe(new Date(1767225600 * 1000).toISOString());
    expect(subscriptionPeriodEndIso(subWithItem(undefined))).toBeNull();
    // 0 is falsy AND meaningless here; it must not become 1970-01-01.
    expect(subscriptionPeriodEndIso(subWithItem(0))).toBeNull();
  });
});

describe("no route reaches for the retired Stripe shapes", () => {
  const BILLING_ROUTES = [
    "src/app/api/stripe/subscription/cancel/route.ts",
    "src/app/api/stripe/subscription/keep/route.ts",
    "src/app/api/stripe/subscription/route.ts",
    "src/app/api/stripe/subscription/seats/route.ts",
    "src/app/api/stripe/webhook/route.ts",
  ];

  it.each(BILLING_ROUTES)("%s has no current_period_end cast", (f) => {
    expect(read(f), `${f} still casts to the retired Subscription shape`).not.toMatch(
      /as unknown as \{\s*current_period_end/,
    );
  });

  it.each(BILLING_ROUTES)("%s gets the period end from the shared helper", (f) => {
    expect(read(f)).toMatch(/subscriptionPeriodEnd(Iso)?\(/);
  });

  it("the seat quote and the plan-change quote filter prorations IDENTICALLY", () => {
    // These two disagreed, and the one that disagreed was the one attached to a
    // consent string. Same rule in both, or the customer is quoted a number the
    // charge does not honour.
    const seats = read("src/app/api/stripe/subscription/seats/route.ts");
    const preview = read("src/app/api/stripe/subscription/preview/route.ts");
    const RULE = /\.filter\(\(l\) => l\.parent\?\.subscription_item_details\?\.proration\)/;
    expect(seats, "the seat quote no longer uses the documented proration flag").toMatch(RULE);
    expect(preview, "the plan-change quote no longer uses the documented proration flag").toMatch(RULE);
    expect(seats, "the seat quote is back on the retired top-level flag").not.toMatch(
      /as unknown as \{\s*proration/,
    );
  });
});
