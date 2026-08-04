import { getStripe } from "@/lib/stripe";

// ── Who gets the 14-day Pro free trial ───────────────────────────────────────
// FIRST-TIME subscribers only, decided from Stripe's own records rather than
// anything in our DB: a customer who has EVER had a subscription — active,
// trialing, canceled, past_due, anything — is not "new" and never gets a second
// trial. This is the single source of truth shared by the checkout API (which
// enforces it on the session Stripe actually creates) and the /upgrade page
// (which decides whether to ADVERTISE the trial), so the promise on the button
// and the behavior at checkout cannot drift apart.
//
// A user with no Stripe customer at all has never subscribed → eligible. If
// Stripe can't be reached we say NOT eligible: wrongly hiding a trial costs a
// nicety; wrongly promising one costs trust (and the checkout would then bill
// them today after a button said "free").

type StripeSubscriptionLister = {
  subscriptions: {
    list: (params: { customer: string; status: "all"; limit: number }) => Promise<{ data: unknown[] }>;
  };
};

export async function isProTrialEligible(
  stripeCustomerId: string | null | undefined,
  stripeClient?: StripeSubscriptionLister,
): Promise<boolean> {
  if (!stripeCustomerId) return true; // never been a Stripe customer → first-timer
  try {
    const stripe = stripeClient ?? (getStripe() as unknown as StripeSubscriptionLister);
    const prior = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 1 });
    return prior.data.length === 0;
  } catch {
    return false; // can't verify → err on the side of not granting a trial
  }
}
