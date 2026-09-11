import { getStripe } from "@/lib/stripe";

// ── Who gets the 14-day Pro free trial ───────────────────────────────────────
//
// THE OFFER IS THE TRIAL (owner, 2026-09-11). Every Pro surface leads with
// "14-day free trial, then $4.99 a month", and this decides when that sentence
// is allowed to be shown. It is the SINGLE source of truth shared by the
// checkout API (which enforces it on the session Stripe actually creates), the
// /upgrade page, and the two Pro dialogs — so the promise on a button and the
// session it creates can never drift apart.
//
// THE RULE, AND WHY IT CHANGED
//
// It used to be "has this customer EVER had a subscription?" — any subscription
// at all, active, cancelled or otherwise. That was too strict in a way nobody
// noticed until the offer went on the front of every dialog: an owner testing
// their own product, or anyone who had ever subscribed and cancelled, was shown
// a cold "$4.99 a month" with no trial, and it looked like the trial feature
// was simply broken. It also punished the wrong person — somebody who had paid
// before and never used a trial was refused one.
//
// The rule is now the ordinary one: you do not get a SECOND free trial. A prior
// subscription only disqualifies you if it actually carried a trial, which
// Stripe records as `trial_start`. First-timers, and returning customers who
// paid from day one, are both offered it.
//
// AND IT NOW FAILS OPEN, WHICH IS AN INVERSION
//
// The old version returned "not eligible" when Stripe could not be reached, on
// the reasoning that wrongly promising a trial costs trust. That reasoning was
// sound when the copy was quiet about it. It is backwards now: with the trial
// on the front of every dialog, an unreachable Stripe would silently turn the
// whole offer into a cold price for everyone — which is exactly the bug that
// prompted this, since a missing STRIPE_SECRET_KEY makes getStripe() throw and
// every account with a customer id falls into the catch.
//
// So an unverifiable customer is granted the trial. Stripe imposes no
// one-trial-per-customer rule of its own — `trial_period_days` is honoured for
// anybody — so granting it is always something we can actually deliver. The
// worst case is one extra free fortnight for someone who already had one; the
// alternative was breaking the headline promise for everybody during an outage.

type StripeSubscriptionLister = {
  subscriptions: {
    list: (params: { customer: string; status: "all"; limit: number }) => Promise<{ data: unknown[] }>;
  };
};

/** Stripe records the start of a trial on the subscription that carried one. */
function hasUsedTrial(subscriptions: unknown[]): boolean {
  return subscriptions.some((s) => {
    const sub = s as { trial_start?: number | null; trial_end?: number | null };
    return !!sub?.trial_start || !!sub?.trial_end;
  });
}

export async function isProTrialEligible(
  stripeCustomerId: string | null | undefined,
  stripeClient?: StripeSubscriptionLister,
): Promise<boolean> {
  if (!stripeCustomerId) return true; // never been a Stripe customer → first-timer
  try {
    const stripe = stripeClient ?? (getStripe() as unknown as StripeSubscriptionLister);
    // 100, not 1: the question is whether ANY past subscription carried a
    // trial, and asking for a single one answers a different question — the
    // most recent subscription having no trial says nothing about the one
    // before it.
    const prior = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 100 });
    return !hasUsedTrial(prior.data);
  } catch {
    // Cannot verify → grant it. See the note above: the offer is on the front
    // of every dialog now, so refusing here would quietly cancel the headline
    // promise for everyone the moment Stripe hiccuped.
    return true;
  }
}
