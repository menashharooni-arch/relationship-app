import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * When the current billing period ends, as a unix timestamp.
 *
 * Read off the subscription ITEM, not the subscription. `current_period_end`
 * used to sit on Subscription; it does not any more — in the installed SDK it
 * exists only on SubscriptionItem, and Subscription mentions it solely in doc
 * prose. Five call sites reached for it with
 *
 *     (sub as unknown as { current_period_end?: number }).current_period_end
 *
 * and the `as unknown as` is what made the breakage silent: the cast asserts a
 * shape the compiler would otherwise have rejected, so every site quietly read
 * `undefined` instead of failing to build. The visible symptoms were a seat
 * REDUCTION that always 503'd (the route treats a missing period end as a
 * Stripe failure) and "Your plan is scheduled to end on ." with the date
 * missing everywhere in billing.
 *
 * Returns undefined when there is no item — callers already handle that by
 * falling back to null rather than rendering a bogus date.
 *
 * items.data[0]: SwiftCard subscriptions carry exactly one item (Pro, or Office
 * with a seat quantity), and the surrounding code already derives `item` the
 * same way. If a second item is ever added, revisit this rather than assuming
 * the first one's period is authoritative.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | undefined {
  return sub.items?.data?.[0]?.current_period_end;
}

/** Same, pre-formatted as an ISO string — or null, which is what every caller wants. */
export function subscriptionPeriodEndIso(sub: Stripe.Subscription): string | null {
  const unix = subscriptionPeriodEnd(sub);
  return unix ? new Date(unix * 1000).toISOString() : null;
}
