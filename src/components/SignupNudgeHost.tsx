"use client";

import { useEffect, useRef, useState } from "react";
import { nudgeCopy } from "@/lib/referral";

// The hero: a tilted, floating "your card" mockup with a shine sweep — the
// popup SHOWS the product (the Blinq loop: you just used a card this smooth,
// here's yours). Pure CSS/SVG, no assets.
function HeroCardMockup() {
  return (
    <div className="relative flex justify-center pt-6 pb-4" aria-hidden="true">
      {/* Soft glow the card floats on */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-28 rounded-full bg-gradient-to-r from-blue-600/25 via-blue-500/25 to-sky-400/20 blur-2xl" />

      {/* Sparkles */}
      <svg viewBox="0 0 24 24" className="absolute left-[18%] top-3 w-3.5 h-3.5 text-blue-400 sc-twinkle"><path fill="currentColor" d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>
      <svg viewBox="0 0 24 24" className="absolute right-[16%] top-10 w-2.5 h-2.5 text-blue-400 sc-twinkle" style={{ animationDelay: "0.7s" }}><path fill="currentColor" d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>

      {/* The card */}
      <div className="sc-float relative w-[168px] -rotate-3">
        {/* back card for depth */}
        <div className="absolute inset-0 rotate-[5deg] rounded-2xl bg-slate-900/[0.08]" />
        <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-[0_18px_40px_-10px_rgba(30,41,99,0.35)] overflow-hidden">
          {/* shine sweep */}
          <div className="sc-shine pointer-events-none absolute inset-0 z-10" />
          <div className="h-11 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500" />
          <div className="px-3.5 pb-3.5">
            <div className="w-11 h-11 -mt-5 rounded-full bg-gradient-to-br from-white to-slate-100 border-[3px] border-white shadow-md flex items-center justify-center">
              <span className="text-[10px] font-black bg-gradient-to-r from-blue-700 to-sky-500 bg-clip-text text-transparent">YOU</span>
            </div>
            <p className="mt-1.5 text-[11px] font-extrabold text-slate-900 leading-tight tracking-tight">Your Name</p>
            <p className="text-[8.5px] text-slate-400 font-medium">Your Business</p>
            <div className="mt-2.5 flex items-center justify-between">
              <div className="h-[15px] px-2 rounded-full bg-blue-600 flex items-center">
                <span className="text-[7px] font-bold text-white tracking-wide">Save Contact</span>
              </div>
              {/* mini QR */}
              <svg viewBox="0 0 14 14" className="w-[18px] h-[18px] text-slate-800">
                <rect x="0" y="0" width="5" height="5" fill="currentColor" rx="1" />
                <rect x="9" y="0" width="5" height="5" fill="currentColor" rx="1" />
                <rect x="0" y="9" width="5" height="5" fill="currentColor" rx="1" />
                <rect x="7" y="7" width="2.5" height="2.5" fill="currentColor" />
                <rect x="11" y="10" width="3" height="3" fill="currentColor" />
                <rect x="9" y="11.5" width="1.5" height="1.5" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mounted once on public pages. Listens for `triggerSignupNudge(source)` events
// and shows ONE friendly signup popup per visitor per session, never blocking
// the action that triggered it. Deliberately does NOT gate on whether a
// SwiftCard session cookie is present — that check used to suppress the popup
// for anyone with a stale/leftover cookie (including the site owner testing
// their own card), which is why it only ever seemed to work in incognito.
// Exception: "share_info" (the connect/share follow-up) is a deliberate moment
// with its own once-per-session slot, so it still fires after a generic nudge.
//
// Design: a hero moment, not a banner — glowing product mockup up top, bold
// centered headline, gradient CTA with a shine sweep, trust row underneath.
export default function SignupNudgeHost() {
  const [source, setSource] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onNudge(e: Event) {
      const src = (e as CustomEvent).detail?.source ?? "default";
      try {
        const guard = src === "share_info" ? "sc_nudged_share" : "sc_nudged";
        if (sessionStorage.getItem(guard)) return;
        sessionStorage.setItem(guard, "1");
        // A share_info popup also uses up the generic slot — no double nudging.
        sessionStorage.setItem("sc_nudged", "1");
      } catch { /* private mode — show once anyway */ }
      // A newer nudge can arrive while an older one's dismiss-fade is still
      // scheduled — cancel that stale timer so it can't clear the new popup.
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      setClosing(false);
      setSource(src);
    }
    window.addEventListener("sc:nudge", onNudge as EventListener);
    return () => {
      window.removeEventListener("sc:nudge", onNudge as EventListener);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!source) return null;
  const copy = nudgeCopy(source);

  function dismiss() {
    setClosing(true);
    dismissTimer.current = setTimeout(() => setSource(null), 220);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="Create your own SwiftCard"
    >
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-[28px] overflow-hidden bg-white ${closing ? "sc-nudge-out" : "sc-nudge-in"}`}
        style={{
          border: "1px solid rgba(148,163,184,0.25)",
          boxShadow: "0 30px 70px -12px rgba(15,23,42,0.4), 0 6px 20px rgba(15,23,42,0.1)",
        }}
      >
        {/* Gradient wash behind the hero */}
        <div className="relative bg-gradient-to-b from-blue-50 via-violet-50/60 to-white">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white/70 backdrop-blur text-slate-400 hover:text-slate-700 shadow-sm border border-slate-200/60 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
          <HeroCardMockup />
        </div>

        <div className="px-6 pt-1 pb-5 text-center">
          <p className="text-slate-900 text-[19px] font-extrabold leading-tight tracking-tight">{copy.title}</p>
          <p className="text-slate-500 text-[13px] mt-1.5 leading-snug">{copy.sub}</p>

          <a
            href={`/cards/new?src=${encodeURIComponent(source)}`}
            className="relative overflow-hidden mt-4 flex items-center justify-center gap-1.5 w-full py-3.5 rounded-full text-[15px] font-bold text-white bg-gradient-to-r from-blue-700 to-sky-500 transition-all active:scale-[0.98] hover:brightness-110"
            style={{ boxShadow: "0 10px 26px -6px rgba(37,99,235,0.55)" }}
          >
            <span className="sc-shine pointer-events-none absolute inset-0" />
            {copy.cta}
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
          </a>

          {/* Trust row — answers the hesitation at the exact moment it happens.
              flex-wrap + gap (no literal dot separators) so it wraps cleanly to
              two centered lines on narrow phones instead of clipping. */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <svg viewBox="0 0 20 20" fill="#16a34a" className="w-3 h-3 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
              100% free to start
            </span>
            <span className="whitespace-nowrap">No credit card</span>
            <span className="whitespace-nowrap">Live in 60 seconds</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sc-nudge-in {
          0%   { transform: translateY(110%); opacity: 0; }
          60%  { transform: translateY(-8px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes sc-nudge-out {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(30px); opacity: 0; }
        }
        .sc-nudge-in  { animation: sc-nudge-in 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
        .sc-nudge-out { animation: sc-nudge-out 0.22s ease-in forwards; }

        @keyframes sc-float {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-5px) rotate(-3deg); }
        }
        .sc-float { animation: sc-float 3.2s ease-in-out infinite; }

        @keyframes sc-shine {
          0%, 55% { transform: translateX(-130%) skewX(-18deg); }
          85%, 100% { transform: translateX(230%) skewX(-18deg); }
        }
        .sc-shine {
          background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%);
          width: 60%;
          animation: sc-shine 3.4s ease-in-out infinite;
        }

        @keyframes sc-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.15); }
        }
        .sc-twinkle { animation: sc-twinkle 2.2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .sc-nudge-in, .sc-nudge-out, .sc-float, .sc-shine, .sc-twinkle { animation: none; }
        }
      `}</style>
    </div>
  );
}
