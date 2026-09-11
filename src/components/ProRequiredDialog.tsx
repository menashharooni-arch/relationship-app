"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PLAN_PRICES, TRIAL_DAYS } from "@/lib/plan";
import { useIsNativeApp } from "@/lib/platform";
import { PlanGate } from "@/components/PlanGate";

/**
 * Save Changes, blocked because the card is using Pro design.
 *
 * The old behaviour was silent: a Free account could pick Brushed, drop in a
 * background video, press Save Changes, get a success message — and then find
 * a flat card on the live link, because the server sanitized the Pro keys away
 * on the way in. Nothing lied exactly, but the person was never told, and the
 * one moment they most wanted the feature was spent teaching them the product
 * does not do what they just watched it do.
 *
 * So the preview stays open — every Pro finish and the photo/video picker are
 * still tappable on Free, the card still renders them in the editor, that is
 * the demo — and the wall moves to Save. This is what stands at the wall.
 *
 * THE TRIAL IS THE OFFER (owner, 2026-09-11)
 * Not "$4.99/month" cold. Fourteen days free, then $4.99 — and the button goes
 * STRAIGHT to the same checkout /upgrade builds, so what it promises is what
 * Stripe actually creates.
 *
 * `trialEligible` is resolved on the SERVER by the page that renders the
 * editor, using lib/trial-eligibility — the identical helper the checkout API
 * enforces with. Someone who has ever had a subscription is not offered a
 * second trial here, and their button carries `trial=0` so the checkout page's
 * copy matches. The promise on the button and the session it creates cannot
 * drift, which is the whole reason that helper is shared rather than re-guessed.
 *
 * NATIVE GOES THROUGH PlanGate, LIKE EVERY OTHER LOCKED SURFACE
 * The first version of this hand-rolled its own `!native` checks and simply
 * rendered NOTHING in the shell — no price, no button, nothing. That satisfied
 * App Store 3.1.1 and failed the person holding the phone: the rest of the app
 * offers a StoreKit paywall on a locked feature (3.1.3(b) requires one), and
 * this dialog offered a dead end. It also looked broken, because the sheet
 * painted the full web layout on the first client render and then collapsed
 * once useIsNativeApp() flipped after mount.
 *
 * So the offer is a PlanGate now. Web gets the trial and the checkout link;
 * native gets PlanNotice and the in-app purchase button, the same one every
 * other gate in the shell shows. One component owns the platform rule, and the
 * tests that pin it (no link, no price, no "upgrade" verb on native) cover this
 * surface for free.
 */
export default function ProRequiredDialog({
  features,
  onSaveWithoutPro,
  onCancel,
  busy = false,
  trialEligible = false,
}: {
  /** Names from proFeaturesInUse(). Never empty. */
  features: string[];
  /** Save anyway, letting the Free conversion apply. */
  onSaveWithoutPro: () => void;
  /** Go back to editing with everything still selected. */
  onCancel: () => void;
  busy?: boolean;
  /** First-time subscriber → offer the free trial. Resolved server-side. */
  trialEligible?: boolean;
}) {
  const native = useIsNativeApp();

  // Esc closes, and the page behind must not scroll under the sheet on a phone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, busy]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-required-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
      />

      {/* A bottom sheet on a phone and a centred card from `sm` up. The phone
          case is the one that matters: `items-end` + `max-h` + the safe-area
          padding keep it off the home indicator, and the sheet scrolls inside
          itself rather than pushing the buttons off the screen on a short
          phone with four Pro features listed. */}
      <div
        className="sc-dark-sheet relative w-full sm:max-w-[26rem] sm:mx-4 max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #101728 0%, #0B1120 46%)",
          border: "1px solid rgba(148,163,184,0.16)",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Grab handle — phones only. It is what makes a sheet read as a sheet. */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* The reading half scrolls; the actions below do not. On a 320px
            phone with four Pro features listed the sheet is taller than the
            screen, and if the buttons scroll with the text the upgrade CTA —
            the entire point of this dialog — starts below the fold. */}
        <div className="px-5 pt-4 sm:pt-6 overflow-y-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-blue-300">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
            </svg>
            PRO DESIGN
          </span>

          <h2 id="pro-required-title" className="text-white font-bold text-[1.3125rem] leading-tight mt-3">
            {features.length === 1 ? "That finish is part of Pro" : "Those touches are part of Pro"}
          </h2>
          <p className="text-slate-300/90 text-[0.875rem] leading-snug mt-1.5">
            {native
              ? "Your card is set up with design that comes with the Pro plan:"
              : trialEligible
                ? `The features you selected are part of Pro. Try it free for ${TRIAL_DAYS} days and keep them on your live card:`
                : "The features you selected are only available on Pro. Upgrade to keep them on your live card:"}
          </p>

          <ul className="mt-3.5 space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-[3px] shrink-0 w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-blue-300" fill="none" stroke="currentColor" strokeWidth={3.2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-[0.875rem] text-slate-100 leading-snug">{f}</span>
              </li>
            ))}
          </ul>

          {/* The offer. Web: the trial and the price. Native: PlanNotice and
              the in-app purchase button, chosen by PlanGate, not by us. */}
          <div className="mt-5">
            <PlanGate
              feature="card-pro-design"
              nativeCopy="Pro feature — material finishes, any color, and photo or video card backgrounds are part of the Pro plan"
            >
            <div className="rounded-2xl border border-blue-400/25 bg-blue-500/[0.07] px-4 py-3.5">
              {trialEligible ? (
                <>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-white font-extrabold text-[1.5rem] leading-none">
                      {TRIAL_DAYS} days free
                    </span>
                    <span className="text-slate-400 text-[0.8125rem]">
                      then ${(PLAN_PRICES.PRO_MONTHLY_CENTS / 100).toFixed(2)} / month
                    </span>
                  </div>
                  <p className="text-slate-300/85 text-[0.8125rem] leading-snug mt-1.5">
                    Every finish, any color, photo and video backgrounds, unlimited links, and
                    your card without the SwiftCard badge. Cancel anytime before day {TRIAL_DAYS} and
                    you are not charged.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white font-extrabold text-[1.5rem] leading-none">
                      ${(PLAN_PRICES.PRO_MONTHLY_CENTS / 100).toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-[0.8125rem]">/ month</span>
                  </div>
                  <p className="text-slate-300/85 text-[0.8125rem] leading-snug mt-1.5">
                    Every finish, any color, photo and video backgrounds, unlimited links, and
                    your card without the SwiftCard badge. Cancel anytime.
                  </p>
                </>
              )}
            </div>
            </PlanGate>
          </div>
        </div>

        <div className="px-5 pt-4 mt-auto shrink-0 flex flex-col gap-2 border-t border-white/[0.07]">
          {!native && (
            <Link
              href={trialEligible ? "/checkout?plan=pro&interval=monthly" : "/checkout?plan=pro&interval=monthly&trial=0"}
              className="rd-btn rd-btn-aurora w-full !py-3.5 !min-h-[46px] text-center text-[0.9375rem] font-bold"
            >
              {trialEligible ? `Start my ${TRIAL_DAYS} days free` : "Upgrade to Pro"}
            </Link>
          )}

          {/* The way out is plainly labelled and says what actually happens.
              This is the only action on native. */}
          <button
            type="button"
            onClick={onSaveWithoutPro}
            disabled={busy}
            className="w-full py-3 rounded-full text-[0.875rem] font-semibold text-slate-200 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-colors disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save without them"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-full py-2 text-[0.8125rem] font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-60"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
