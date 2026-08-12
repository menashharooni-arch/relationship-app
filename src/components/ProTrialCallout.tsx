import { TRIAL_DAYS } from "@/lib/plan";

// The free-trial offer, stated where people actually decide.
//
// The trial used to live in two places on the Pro card: the button label and an
// 11px line UNDER the button. Both lose to the price. Someone scanning three
// columns reads "$5 / month", files Pro under "costs money", and never learns
// the first two weeks are free — which is the one fact most likely to turn a
// looker into a subscriber.
//
// So the offer moves up, directly beneath the price, as its own object: a
// frosted band the eye cannot skip on the way from the price to the CTA. It
// deliberately does NOT replace the price. Three columns are being compared and
// the number is what makes them comparable; the band reframes what the number
// means ("then"), rather than hiding it.
//
// Rendered inside the Pro card on all three plan surfaces — /pricing,
// PlanCards (signup + /welcome), /upgrade — so the offer reads identically
// wherever someone meets it. All three sit on a blue/aurora gradient with white
// text, which is why this is white-on-translucent rather than themed.
//
// It carries the HEADLINE only. The eligibility qualifier ("for new customers")
// and the billing terms stay in the fine print under the button, where
// copy-truth.test.ts pins them — checkout grants a trial only to customers with
// no prior Stripe subscription, so the promise must never lose its condition.

export default function ProTrialCallout({
  /** What they'll be charged once the trial ends, e.g. "$5/month". */
  priceLabel,
  className = "",
}: {
  priceLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-white/25 bg-white/[0.16] px-3.5 py-3 ${className}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#2450d8] shadow-sm">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M11.2 3.3a.6.6 0 011.13 0l1.36 3.66a.6.6 0 00.35.35l3.66 1.36a.6.6 0 010 1.13l-3.66 1.36a.6.6 0 00-.35.35l-1.36 3.66a.6.6 0 01-1.13 0l-1.36-3.66a.6.6 0 00-.35-.35L5.83 9.8a.6.6 0 010-1.13l3.66-1.36a.6.6 0 00.35-.35z" />
          <path d="M18.4 14.6a.4.4 0 01.75 0l.6 1.6a.4.4 0 00.24.24l1.6.6a.4.4 0 010 .75l-1.6.6a.4.4 0 00-.24.24l-.6 1.6a.4.4 0 01-.75 0l-.6-1.6a.4.4 0 00-.24-.24l-1.6-.6a.4.4 0 010-.75l1.6-.6a.4.4 0 00.24-.24z" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-white">
          Start with {TRIAL_DAYS} days free
        </span>
        {/* The price repeats here on purpose: "then $5/month" is what makes the
            band an offer instead of a slogan, and it is the sentence that
            answers "what happens after?" before they have to ask. */}
        <span className="mt-0.5 block text-[11.5px] leading-snug text-white/75">
          then {priceLabel} · cancel anytime
        </span>
      </span>
    </div>
  );
}
