"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Shared chrome for the homepage "mini builders" (card / SwiftLink / signature).
// A visitor steps through a handful of fields — only what a preview needs — with
// a live preview beside them, then hits "Make it live" to continue in the real
// builder with everything they typed carried over. The caller owns the field
// state; this component only renders the wizard shell, progress, live preview,
// and navigation. Portaled to <body> so the fixed overlay isn't trapped by the
// transformed reveal-animation ancestors on the page.

export type MiniStep = {
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  canAdvance?: boolean; // false disables Next/Make-it-live on this step
};

export default function MiniBuilderModal({
  open,
  onClose,
  eyebrow,
  step,
  setStep,
  steps,
  preview,
  previewCaption,
  onLaunch,
  onStartOver,
  launching = false,
  launchLabel = "Make it live →",
  hidePreviewOnMobile = false,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  step: number;
  setStep: (n: number) => void;
  steps: MiniStep[];
  preview: React.ReactNode;
  previewCaption?: string;
  onLaunch: () => void;
  /** Explicitly throw the whole draft away and start from a blank builder.
   *  Closing does NOT do this — the three builders share one draft and a
   *  visitor moving between products must not lose what they already typed. */
  onStartOver?: () => void;
  launching?: boolean;
  launchLabel?: string;
  /** Hides this shared preview column on mobile only (still shown on desktop,
   *  where it's pinned beside the form regardless of step). Used by the card
   *  builder's last step (the template picker), which drops its OWN inline
   *  copy of `preview` right next to the template choices instead — on mobile
   *  that reads better than the picker followed by nav buttons followed by
   *  the preview all the way at the bottom of the sheet. */
  hidePreviewOnMobile?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const total = steps.length;
  const current = steps[Math.min(step, total - 1)];
  const isLast = step >= total - 1;
  const canGo = current.canAdvance !== false;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] overflow-y-auto"
      style={{ background: "rgba(4,7,15,0.74)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center py-6 px-4">
        <div
          className="relative w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "#0E1017", border: "1px solid rgba(255,255,255,0.10)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 z-10 w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>

          <div className="grid md:grid-cols-2">
            {/* ── Left: form ─────────────────────────────── */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <span className="rd-pill rd-pill-d"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />{eyebrow}</span>
              </div>

              {/* progress */}
              <div className="flex items-center gap-1.5 mb-5">
                {steps.map((_, i) => (
                  <span key={i} className="h-1.5 rounded-full flex-1 transition-colors" style={{ background: i <= step ? "var(--rd-aurora)" : "rgba(255,255,255,0.12)" }} />
                ))}
              </div>

              <p className="text-white/40 text-[12px] font-medium mb-1">Step {step + 1} of {total}</p>
              <h3 className="text-white font-bold text-[20px] leading-tight">{current.title}</h3>
              {current.subtitle && <p className="text-white/50 text-[13.5px] mt-1.5 leading-relaxed">{current.subtitle}</p>}

              <div className="mt-5 space-y-3.5">{current.content}</div>

              {/* nav */}
              <div className="mt-7 flex items-center gap-3">
                {step > 0 && (
                  <button onClick={() => setStep(step - 1)} className="rd-btn rd-btn-ghost-d text-[14px] px-4 py-2.5">Back</button>
                )}
                {isLast ? (
                  <button
                    onClick={onLaunch}
                    disabled={!canGo || launching}
                    className="rd-btn rd-btn-aurora text-[14px] px-5 py-2.5 flex-1 disabled:opacity-50"
                  >
                    {launching ? "Opening…" : launchLabel}
                  </button>
                ) : (
                  <button
                    onClick={() => canGo && setStep(step + 1)}
                    disabled={!canGo}
                    className="rd-btn rd-btn-primary text-[14px] px-5 py-2.5 flex-1 disabled:opacity-40"
                  >
                    Continue
                  </button>
                )}
              </div>
              {isLast && (
                <p className="text-white/35 text-[11.5px] mt-3 leading-relaxed">
                  We&apos;ll carry over everything you entered — you&apos;ll just add the finishing touches.
                </p>
              )}

              {onStartOver && (
                <button
                  type="button"
                  onClick={onStartOver}
                  className="mt-4 text-white/35 hover:text-white/70 text-[11.5px] underline underline-offset-2 transition-colors"
                >
                  Start over with a blank one
                </button>
              )}
            </div>

            {/* ── Right: live preview ────────────────────── */}
            <div className={`${hidePreviewOnMobile ? "hidden md:flex" : "flex"} relative flex-col items-center justify-center p-6 sm:p-8 border-t md:border-t-0 md:border-l border-white/10`} style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(93,107,255,0.14), transparent 60%), #0A0B10" }}>
              <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/35 text-[11px] font-semibold uppercase tracking-widest">Live preview</span>
              <div className="w-full flex items-center justify-center mt-4">{preview}</div>
              {previewCaption && <p className="text-white/40 text-[12px] mt-4 text-center">{previewCaption}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
