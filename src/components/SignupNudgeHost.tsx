"use client";

import { useEffect, useState } from "react";
import { nudgeCopy } from "@/lib/referral";

// True if a SwiftCard session cookie is present — we never nudge logged-in users.
function isLoggedIn(): boolean {
  if (typeof document === "undefined") return false;
  // Match the Supabase auth cookie, including chunked variants (…-auth-token.0).
  // The trailing "=" is intentionally omitted so the ".0" suffix doesn't break it.
  return /(?:^|;\s*)sb-[^=;]*-auth-token/.test(document.cookie);
}

// A tiny self-drawn "your card" mockup — the popup SHOWS the product instead of
// describing it (the Blinq-style loop: you just used a card, here's yours).
// Pure CSS/SVG, no assets, renders identically everywhere.
function MiniCardMockup() {
  return (
    <div className="relative w-[84px] shrink-0 select-none" aria-hidden="true">
      {/* Back card, peeking out for depth */}
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl bg-slate-900/10" />
      {/* The card */}
      <div className="relative rounded-xl bg-white border border-slate-200 shadow-[0_6px_18px_rgba(15,23,42,0.14)] overflow-hidden">
        <div className="h-6 bg-gradient-to-r from-blue-600 to-blue-500" />
        <div className="px-2 pb-2">
          <div className="w-7 h-7 -mt-3.5 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-sm flex items-center justify-center">
            <span className="text-[7px] font-extrabold text-blue-700 tracking-tight">YOU</span>
          </div>
          <div className="mt-1.5 h-[5px] w-10 rounded-full bg-slate-700/80" />
          <div className="mt-1 h-[4px] w-7 rounded-full bg-slate-300" />
          <div className="mt-2 flex items-end justify-between">
            <div className="h-[11px] w-8 rounded-full bg-blue-600" />
            {/* mini QR */}
            <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 text-slate-800">
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
  );
}

// Mounted once on public pages. Listens for `triggerSignupNudge(source)` events
// and shows ONE friendly signup popup per visitor per session, never blocking
// the action that triggered it and never to logged-in users.
// Exception: "share_info" (the connect/share follow-up) is a deliberate moment
// with its own once-per-session slot, so it still fires after a generic nudge.
//
// Design: matches the card pages' warm ivory system (#FAF7F2 / #E4DDD4 / blue
// #1D4ED8) so it reads as part of the card, not a third-party ad — with a mini
// card mockup (show the product), one line of value, and a trust row.
export default function SignupNudgeHost() {
  const [source, setSource] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    function onNudge(e: Event) {
      const src = (e as CustomEvent).detail?.source ?? "default";
      if (isLoggedIn()) return;
      try {
        const guard = src === "share_info" ? "sc_nudged_share" : "sc_nudged";
        if (sessionStorage.getItem(guard)) return;
        sessionStorage.setItem(guard, "1");
        // A share_info popup also uses up the generic slot — no double nudging.
        sessionStorage.setItem("sc_nudged", "1");
      } catch { /* private mode — show once anyway */ }
      setClosing(false);
      setSource(src);
    }
    window.addEventListener("sc:nudge", onNudge as EventListener);
    return () => window.removeEventListener("sc:nudge", onNudge as EventListener);
  }, []);

  if (!source) return null;
  const copy = nudgeCopy(source);

  function dismiss() {
    setClosing(true);
    setTimeout(() => setSource(null), 220);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="Create your own SwiftCard"
    >
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-3xl overflow-hidden ${closing ? "sc-nudge-out" : "sc-nudge-in"}`}
        style={{
          background: "#FAF7F2",
          border: "1px solid #E4DDD4",
          boxShadow: "0 24px 60px -12px rgba(15,23,42,0.35), 0 4px 16px rgba(15,23,42,0.08)",
        }}
      >
        <div className="relative px-5 pt-5 pb-4">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-900/5 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>

          <div className="flex items-center gap-4 mb-4">
            <MiniCardMockup />
            <div className="min-w-0 pr-4">
              <p className="text-slate-900 text-[16px] font-bold leading-snug tracking-tight">{copy.title}</p>
              <p className="text-slate-500 text-[13px] mt-1 leading-snug">{copy.sub}</p>
            </div>
          </div>

          <a
            href={`/join?src=${encodeURIComponent(source)}`}
            className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-full text-sm font-bold text-white transition-all active:scale-[0.98] hover:brightness-110"
            style={{ background: "#1D4ED8", boxShadow: "0 8px 20px -6px rgba(29,78,216,0.45)" }}
          >
            {copy.cta}
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
          </a>

          {/* Trust row — answers the hesitation at the exact moment it happens */}
          <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 20 20" fill="#16a34a" className="w-3 h-3"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
              Free to start
            </span>
            <span className="text-slate-300">·</span>
            <span>No credit card</span>
            <span className="text-slate-300">·</span>
            <span>Ready in a minute</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sc-nudge-in {
          0%   { transform: translateY(110%); opacity: 0; }
          60%  { transform: translateY(-6px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes sc-nudge-out {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(30px); opacity: 0; }
        }
        .sc-nudge-in  { animation: sc-nudge-in 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
        .sc-nudge-out { animation: sc-nudge-out 0.22s ease-in forwards; }
        @media (prefers-reduced-motion: reduce) {
          .sc-nudge-in, .sc-nudge-out { animation: none; }
        }
      `}</style>
    </div>
  );
}
