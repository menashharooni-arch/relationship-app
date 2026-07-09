"use client";

import { useState, useEffect } from "react";

// A one-time, dismissible "refer a friend" nudge at a happy moment — right after
// a free user captures their very first contact. The full referral card with the
// link lives just below on the dashboard.
export default function FirstLeadNudge({ leadCount, isPro }: { leadCount: number; isPro: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPro || leadCount !== 1) return;
    try {
      if (localStorage.getItem("sc_firstlead_nudge")) return;
    } catch { /* private mode */ }
    setShow(true);
  }, [leadCount, isPro]);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem("sc_firstlead_nudge", "1"); } catch { /* ignore */ }
    setShow(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3.5 mb-5 bg-emerald-950/30 border border-emerald-800/40">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base shrink-0">🎉</span>
        <p className="text-sm text-emerald-100/90 leading-snug">
          Your first contact! Know someone who&apos;d love this? <strong className="text-emerald-200">Refer a friend</strong> — they get a free month, and you get one when they upgrade.
        </p>
      </div>
      <button onClick={dismiss} className="text-emerald-300/60 hover:text-emerald-200 text-xs font-medium shrink-0">
        Dismiss
      </button>
    </div>
  );
}
