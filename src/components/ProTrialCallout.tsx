import { TRIAL_DAYS } from "@/lib/plan";

// The free-trial offer, stated where people actually decide.
//
// WHY IT SITS ON THE PRICE. Someone scanning three columns reads "$4.99 /
// month", files Pro under "costs money", and never learns the first two weeks
// are free — the one fact most likely to turn a looker into a subscriber. So
// the offer is stamped directly onto the price block, on the way down from the
// number to the CTA. It deliberately does NOT replace the price: three columns
// are being compared and the number is what makes them comparable.
//
// WHY IT LOOKS LIKE THIS. The previous version was a translucent white panel
// (bg-white/16) wrapping a 15px headline and an 11.5px line that repeated the
// price. Three things were wrong with it. It opted out of every strong move
// the surrounding card already owns — the card states conviction in SOLID
// white (the CTA) and says "this saves you money" in EMERALD (the SAVE 10%
// badge) — and a 16% wash of white is the weakest possible version of the
// first. It read as a container, so the eye classified it as an alert or a
// disabled panel rather than an offer. And it printed the price a second time
// forty pixels under a 2.4rem price, which is what made it feel like fine
// print.
//
// This is the same two ideas at full strength instead: the page's savings
// colour as a SOLID pill, and its badge vocabulary (MOST POPULAR, SAVE 10% —
// both rounded-full, uppercase, heavy). It hugs its content rather than
// spanning the card, so it reads as a stamp ON the price instead of a row
// under it. No new colour, type, or shape enters the system.
//
// Rendered inside the Pro card on all three plan surfaces — /pricing,
// PlanCards (signup + /welcome), /upgrade — so the offer reads identically
// wherever someone meets it.
//
// It carries the HEADLINE only. The eligibility qualifier ("for new
// customers") and the billing terms stay in the fine print under the button,
// where copy-truth.test.ts pins them — checkout grants a trial only to
// customers with no prior Stripe subscription, so the promise must never lose
// its condition. "Nothing to pay today" is the literal truth of a Stripe trial
// (a card is collected, nothing is charged) and it answers the question the
// price just raised, which the old "then $4.99/month" only restated.

export default function ProTrialCallout({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      {/* w-fit: hugging the copy is what makes this a stamp rather than a
          full-width band, which is how the old version read as a container. */}
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-400 py-1.5 pl-2.5 pr-3.5"
        style={{ boxShadow: "0 8px 22px -8px rgba(4,120,87,0.75)" }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-emerald-950" fill="currentColor" aria-hidden="true">
          <path d="M11.2 3.3a.6.6 0 011.13 0l1.36 3.66a.6.6 0 00.35.35l3.66 1.36a.6.6 0 010 1.13l-3.66 1.36a.6.6 0 00-.35.35l-1.36 3.66a.6.6 0 01-1.13 0l-1.36-3.66a.6.6 0 00-.35-.35L5.83 9.8a.6.6 0 010-1.13l3.66-1.36a.6.6 0 00.35-.35z" />
          <path d="M18.4 14.6a.4.4 0 01.75 0l.6 1.6a.4.4 0 00.24.24l1.6.6a.4.4 0 010 .75l-1.6.6a.4.4 0 00-.24.24l-.6 1.6a.4.4 0 01-.75 0l-.6-1.6a.4.4 0 00-.24-.24l-1.6-.6a.4.4 0 010-.75l1.6-.6a.4.4 0 00.24-.24z" />
        </svg>
        {/* whitespace-nowrap: the pill is a single stamp — wrapping it to two
            lines inside a 320px column would turn it back into a block. */}
        <span className="whitespace-nowrap text-[12.5px] font-black uppercase leading-none tracking-[0.04em] text-emerald-950">
          First {TRIAL_DAYS} days free
        </span>
      </span>
      {/* Tinted from the card's own foreground, never gray: this sits on a blue
          gradient where gray goes muddy. */}
      <p className="mt-2 text-[12.5px] leading-snug text-white/85">
        Nothing to pay today · cancel anytime
      </p>
    </div>
  );
}
