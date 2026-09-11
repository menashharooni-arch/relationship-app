// ── Who gets the 14-day Pro free trial ───────────────────────────────────────
//
// EVERYONE. That is the owner's decision (2026-09-11, asked for four times):
// the offer is "14-day free trial, then $4.99 a month", to every account, every
// time, with no conditions attached to it.
//
// This function exists because four surfaces need to agree about that — the
// checkout API, /upgrade, and the two Pro dialogs — and because the rule has
// moved twice already. Keeping one exported answer means the sentence on a
// button and the session Stripe creates can never drift apart, and means the
// policy can be changed back in one place rather than four.
//
// WHAT IT USED TO BE, AND WHY IT KEPT BEING WRONG
//
// First it was "has this customer EVER had a subscription" — which refused a
// trial to anyone who had subscribed once and stopped, including the owner
// testing the product. Then it was "has this customer already USED a trial",
// which is the textbook rule and still showed a cold "$4.99 a month" to exactly
// the person who reported it, because their account had trialled before. Both
// times the headline offer silently became a bare price for real people, and
// both times it read as the feature being broken.
//
// THE ABUSE CASE, STATED PLAINLY
//
// Somebody can now cancel and resubscribe to take another free fortnight. On
// the WEB that is real, if small: it needs re-entering card details each time
// for a $4.99 product. On iOS it cannot happen at all — Apple allows one
// introductory offer per Apple ID per subscription group and enforces it
// itself, whatever we ask for. The owner has weighed that and chosen the
// simpler, louder offer.
//
// Stripe imposes no one-trial-per-customer rule of its own: trial_period_days
// is honoured for anybody. So promising the trial is always something we can
// actually deliver — which is the property that matters, because every one of
// those four surfaces prints the promise before the person ever reaches
// checkout.

/* eslint-disable @typescript-eslint/no-unused-vars --
   The parameters stay even though nothing reads them. Four call sites pass a
   customer id and the checkout API passes its own Stripe client; keeping the
   signature means the policy can be narrowed again by editing this one body,
   without touching a single caller. That is the point of it being one
   function. */
export async function isProTrialEligible(
  stripeCustomerId?: string | null,
  stripeClient?: unknown,
): Promise<boolean> {
  return true;
}
