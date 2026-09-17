import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { ledgerHas } from "@/lib/trial-ledger";

// ── Who gets the 14-day Pro free trial ───────────────────────────────────────
//
// ONE PER CUSTOMER. A customer who has ever had a Stripe subscription — active,
// canceled, past_due or trialing — does not get another free trial. Owner
// decision, 2026-09-15, made with the full history below in front of him.
//
// This function exists because four surfaces need to agree about that — the
// checkout API, /upgrade, and the two Pro dialogs — and because the rule has
// now moved three times. Keeping one exported answer means the sentence on a
// button and the session Stripe creates can never drift apart, and means the
// policy can be changed again in one place rather than four.
//
// ── THE HISTORY, KEPT DELIBERATELY ───────────────────────────────────────────
//
// This is the third setting of this rule, and the previous two both came back:
//
//   1. "has this customer EVER had a subscription" — refused a trial to anyone
//      who had subscribed once and stopped, including the owner testing the
//      product.
//   2. "has this customer already USED a trial" — the textbook rule, and it
//      still showed a cold "$4.99 a month" to exactly the person who reported
//      it, because their account had trialled before.
//   3. Unconditional (2026-09-11, asked for four times): every account, every
//      time. Simple and loud, at the cost of a cancel-and-resubscribe loop.
//
// So this file is back to rule 1, and the failure mode is known in advance:
// ANY account that has ever subscribed — the owner's own test accounts
// included — now sees the plain price rather than the trial offer. That is not
// a bug when it happens. It is this rule working. If it reads as broken again,
// the fix is to change the POLICY here, not to patch a surface.
//
// WHY THE COPY MATTERS. /pricing and CheckoutClient both say "for new
// customers" / "First-time subscribers". Under rules 1 and 2 that is true;
// under rule 3 it was not, which is what prompted this change. Whoever moves
// this rule again must move that copy in the same commit — pinned by
// copy-truth.test.ts.
//
// ON iOS none of this applies: Apple allows one introductory offer per Apple ID
// per subscription group and enforces it itself, whatever we ask for.

/**
 * Is this customer entitled to the 14-day Pro trial?
 *
 * No Stripe customer id → brand-new, always eligible. That is the common case
 * and it costs no network call.
 *
 * FAILS OPEN. If Stripe cannot be reached the answer is `true`, because the
 * alternative is worse in both directions: a real first-time customer shown a
 * cold price during a Stripe blip is a lost sale and reads as the product being
 * broken, while the downside of a wrongly-granted trial is 14 days of one
 * $4.99 subscription. The promise on the button is also printed long before
 * checkout, so refusing on an outage would make the button and the session
 * disagree — the exact drift this single function exists to prevent.
 */
export async function isProTrialEligible(
  stripeCustomerId?: string | null,
  stripeClient?: Stripe,
  history?: {
    /** profiles.pro_trial_started_at — set when any trial (Stripe or Apple) began. */
    proTrialStartedAt?: string | null;
    /** The ACCOUNT email, checked against the purge-proof trial ledger. */
    accountEmail?: string | null;
    /** A friend's free month is on offer (lib/referral-server): that is this
     *  account's one free Pro period, so no 14-day trial beside it. */
    referralGiftOffered?: boolean;
  },
): Promise<boolean> {
  // RULE 4 (2026-09-16), layered on rule 1: one trial per PERSON, not per
  // Stripe customer. A new email is a new customer, so rule 1 alone let the
  // same person trial again from a second account, or from the same email
  // once the 30-day account purge freed it. The account marker and the email
  // ledger (lib/trial-ledger) close both; the card itself is checked in the
  // Stripe webhook, the first point a card exists. Both fail OPEN like the
  // Stripe check below: a missing marker or unreachable ledger reads as "no
  // record", never as a refusal.
  if (history?.proTrialStartedAt) return false;
  if (history?.referralGiftOffered) return false;
  if (history?.accountEmail && (await ledgerHas("email_trial", history.accountEmail))) return false;

  if (!stripeCustomerId) return true;

  try {
    const stripe = stripeClient ?? getStripe();
    // status: "all" is load-bearing — the default omits canceled and expired
    // subscriptions, which are precisely the ones that make someone a returning
    // customer rather than a new one.
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 1,
    });
    return subs.data.length === 0;
  } catch {
    return true;
  }
}
