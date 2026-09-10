"use client";

import { TRIAL_DAYS } from "@/lib/plan";
import { useIsNativeApp } from "@/lib/platform";

/**
 * The moment someone picks Free after building with Pro design.
 *
 * It used to work like this: they chose Free, their card was rewritten, and
 * THEN a grey sentence appeared saying "Custom colors and premium design
 * options are available on Pro" with a single Continue button. The decision
 * was already made, the card was already changed, the sentence described the
 * plan rather than their card, and there was no way back.
 *
 * That is the highest-intent moment in the entire product and it was being
 * spent on a disclaimer. Someone who has just spent ten minutes on a card
 * feels it is theirs — so the honest and the persuasive thing are the same
 * thing here: tell them exactly what is about to change, before it changes,
 * and offer the one option that keeps it.
 *
 * Three rules this component follows:
 *
 *  1. It only appears when the card ACTUALLY changes. `changes` comes from the
 *     converter, so tapping a Free Look never triggers this.
 *  2. Free is a real exit, not a dark pattern. The secondary button is plainly
 *     labelled, says what is kept, and is one tap.
 *  3. NATIVE (the iOS shell) may not sell. On native the trial offer is not
 *     rendered at all — no price, no "upgrade", no trial CTA — leaving the
 *     honest description and the Continue button. Same posture as PlanGate.
 */
export default function FreeDesignChoice({
  changes,
  onKeepWithTrial,
  onContinueFree,
  busy = false,
}: {
  /** Plain-English lines from describeFreeDesignChanges(). Never empty. */
  changes: string[];
  /** Start the Pro trial so the card is kept exactly as built. */
  onKeepWithTrial: () => void;
  /** Proceed on Free, applying the conversion. */
  onContinueFree: () => void;
  busy?: boolean;
}) {
  const native = useIsNativeApp();

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-2xl border border-blue-800/40 bg-blue-950/30 px-5 py-5">
        <p className="text-white font-bold text-base">Your card uses Pro design</p>
        <p className="text-blue-200/80 text-[0.8125rem] mt-1 leading-snug">
          Everything you typed is saved either way. On Free, the look changes:
        </p>

        <ul className="mt-3.5 space-y-2">
          {changes.map((line) => (
            // text-blue-100 (not /90): the light-theme layer in globals.css
            // remaps a fixed list of blue text shades, and an opacity variant
            // it doesn't list stays near-invisible on a light background.
            <li key={line} className="flex items-start gap-2.5 text-[0.8125rem] text-blue-100 leading-snug">
              {/* An arrow, not a cross: these are changes, not errors, and a red
                  cross beside four lines would read as four things going wrong. */}
              <span aria-hidden className="text-blue-400/70 mt-[1px] shrink-0">→</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {!native && (
        <>
          <button
            onClick={onKeepWithTrial}
            disabled={busy}
            className="mt-4 w-full py-3.5 rounded-full text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
          >
            {busy ? "Saving…" : `Keep my card exactly like this — ${TRIAL_DAYS} days free →`}
          </button>
          {/* The same disclosure the plan cards carry. A trial that takes a card
              and renews has to say so at every point it is offered, not only on
              the pricing page. */}
          {/* gray-400, not the gray-500/600 the rest of the app uses for small
              print: measured against this backdrop those are 3.97:1 and 2.54:1,
              under the 4.5:1 floor. This is the line that says a card is taken
              and the subscription renews — the one piece of text here that has
              to be legible whether or not anyone wants to read it. 7.56:1. */}
          <p className="text-gray-400 text-[0.625rem] text-center mt-2 leading-snug">
            {TRIAL_DAYS} days free for new customers · card required · renews automatically · cancel anytime
          </p>
        </>
      )}

      <button
        onClick={onContinueFree}
        disabled={busy}
        className={`w-full py-3 rounded-full text-sm font-semibold border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors ${native ? "mt-4" : "mt-3"}`}
      >
        {busy ? "Saving…" : "Continue with Free"}
      </button>
      {/* The reassurance under the exit. Whatever makes Free feel safe has to
          be as readable as what makes Pro attractive, or the choice is only
          balanced on paper. */}
      <p className="text-gray-400 text-[0.625rem] text-center mt-2 leading-snug">
        You keep your card, your link, your QR code and everything you typed.
      </p>
    </div>
  );
}
