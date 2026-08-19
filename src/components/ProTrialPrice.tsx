import { TRIAL_DAYS } from "@/lib/plan";

// ── The Pro card's price block: "Free for your first 14 days" ───────────────
//
// Owner-approved design 2026-08-19 (mockup round): the price block leads with
// the word FREE — big, bold, plain white, deliberately NOT a colored badge or
// a strikethrough ("I don't want this to look like a scam") — followed by the
// qualifier in quiet white, then the real price stated plainly underneath.
// Reads as one honest sentence: "Free for your first 14 days, then $4.99 a
// month, cancel anytime."
//
// This REPLACES both the old price row and the emerald ProTrialCallout pill on
// every Pro card (pricing page, signup PlanCards, upgrade page), so the offer
// reads identically wherever someone meets it.
//
// Compliance copy contract (tests/copy-truth.test.ts): the day count comes
// from TRIAL_DAYS, and the "for new customers" qualifier + billing terms stay
// in the fine print under each card's CTA — this block carries the offer, not
// the conditions.

export default function ProTrialPrice({
  then,
  note,
  className = "",
}: {
  /** The real price, stated plainly: "$4.99 / month" or "$53.99 / year". */
  then: string;
  /** Optional extra after the price, e.g. "~$4.50/mo · Save 10%". */
  note?: string;
  className?: string;
}) {
  // One loud word, everything else quiet and uniform: "Free" carries all the
  // weight, and the qualifier + real price share a single calm tone so the
  // block reads as one sentence instead of three competing lines.
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="text-[2.6rem] font-bold text-white leading-none tracking-tight">Free</span>
        <span className="text-white/70 text-sm">for your first {TRIAL_DAYS} days</span>
      </div>
      <p className="text-white/70 text-sm mt-2">
        then {then} · cancel anytime
      </p>
      {note && <p className="text-white/60 text-xs mt-1">{note}</p>}
    </div>
  );
}
