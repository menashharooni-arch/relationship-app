"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import { resetGuestFlow } from "@/lib/guest-reset";
import { useIsNativeApp } from "@/lib/platform";

// Linktree-style corner badge for Swift Links pages: a small light chip with
// the lightning bolt at the top-left of the page (owner order 2026-09-02 —
// the bolt alone here, deliberately, unlike every other logo surface). It
// scrolls away with the hero like Linktree's does. Tapping it opens a promo
// sheet inviting the visitor to create their own Swift Links.
//
// The badge is passive and always present for web visitors — unlike
// SignupNudgeHost it is the VISITOR's choice to open it, so it doesn't gate
// on account-exists or spend nudge slots. Native app: never rendered (the
// iOS shell is forbidden from selling — same rule as the signup nudge).

// Best-effort funnel events, same endpoint the signup nudge uses. Must never
// affect whether the sheet opens.
function track(username: string, eventType: string): void {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, event_type: eventType, event_data: { source: "links_promo_badge" } }),
  }).catch(() => {});
}

export default function SwiftLinksPromoBadge({ username, appUrl }: { username: string; appUrl: string }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const native = useIsNativeApp();
  if (native) return null;

  function dismiss() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 220);
  }

  return (
    <>
      {/* The corner chip — light frosted square so it reads on any hero
          (photo, logo gradient, initials), with the brand bolt inside. z-20
          keeps it under the sticky mini header (z-30), which covers it once
          the visitor scrolls — same lifecycle as Linktree's badge. */}
      <button
        onClick={() => { setOpen(true); track(username, "links_badge_open"); }}
        aria-label="What is Swift Links?"
        className="absolute top-3.5 left-3.5 z-20 w-10 h-10 flex items-center justify-center rounded-[14px] bg-white/85 backdrop-blur-md border border-black/[0.06] shadow-[0_2px_10px_rgba(15,23,42,0.18)] transition-transform active:scale-95 hover:scale-105"
      >
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
          <path d="M13 2.5L4.5 13.5h6l-1.5 8 8.5-11h-6l1.5-8z" fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        // Portaled to <body> — the sheet's transformed/overflow ancestors
        // would otherwise cage this fixed overlay (same fix as the signup
        // nudge). Bottom sheet on phones, centered dialog on md+.
        <div
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-4 bg-black/40"
          role="dialog"
          aria-label="Create your own Swift Links"
          onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
        >
          <div
            className={`w-full max-w-sm rounded-[28px] overflow-hidden bg-white ${closing ? "sc-lbp-out" : "sc-lbp-in"}`}
            style={{
              border: "1px solid rgba(148,163,184,0.25)",
              boxShadow: "0 30px 70px -12px rgba(15,23,42,0.4), 0 6px 20px rgba(15,23,42,0.1)",
            }}
          >
            <div className="relative bg-gradient-to-b from-blue-50 via-violet-50/60 to-white px-6 pt-7 pb-1">
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/70 backdrop-blur text-slate-400 hover:text-slate-700 shadow-sm border border-slate-200/60 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
              {/* Inside the sheet the brand shows as the full tile — the
                  bolt-alone treatment is only for the corner chip. */}
              <div className="flex justify-start">
                <SwiftCardIcon size={44} />
              </div>
              <h2 className="mt-4 text-slate-900 text-[26px] font-extrabold leading-[1.15] tracking-tight">
                Create your own Swift Links
              </h2>
            </div>

            <div className="px-6 pt-2 pb-6">
              <p className="text-slate-500 text-[14px] leading-snug">
                Comes with a SwiftCard and Swift Signature — used by many business
                professionals. One link to share everything about you.
              </p>

              <Link
                href="/cards/new?src=links_promo_badge"
                // Start blank: wipe any leftover guest draft so the builder
                // always opens fresh (same as the signup nudge CTA).
                onClick={() => { track(username, "links_badge_cta_click"); resetGuestFlow(); }}
                className="relative overflow-hidden mt-5 flex items-center justify-center gap-1.5 w-full py-3.5 rounded-full text-[15px] font-bold text-white text-center bg-gradient-to-r from-blue-700 to-sky-500 transition-all active:scale-[0.98] hover:brightness-110"
                style={{ boxShadow: "0 10px 26px -6px rgba(37,99,235,0.55)" }}
              >
                <span className="sc-lbp-shine pointer-events-none absolute inset-0" />
                See how yours looks and get started for free
              </Link>

              <div className="flex justify-center mt-4">
                <a
                  href={`${appUrl}/?src=links_promo_badge`}
                  onClick={() => track(username, "links_badge_explore_click")}
                  className="text-[13px] font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors"
                >
                  Explore more about SwiftCard
                </a>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes sc-lbp-in {
              0%   { transform: translateY(110%); opacity: 0; }
              60%  { transform: translateY(-8px); opacity: 1; }
              100% { transform: translateY(0); opacity: 1; }
            }
            @keyframes sc-lbp-out {
              from { transform: translateY(0); opacity: 1; }
              to   { transform: translateY(30px); opacity: 0; }
            }
            .sc-lbp-in  { animation: sc-lbp-in 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
            .sc-lbp-out { animation: sc-lbp-out 0.22s ease-in forwards; }
            @keyframes sc-lbp-shine {
              0%, 55% { transform: translateX(-130%) skewX(-18deg); }
              85%, 100% { transform: translateX(230%) skewX(-18deg); }
            }
            .sc-lbp-shine {
              background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%);
              width: 60%;
              animation: sc-lbp-shine 3.4s ease-in-out infinite;
            }
            @media (prefers-reduced-motion: reduce) {
              .sc-lbp-in, .sc-lbp-out, .sc-lbp-shine { animation: none; }
            }
          `}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
