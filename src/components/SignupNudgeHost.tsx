"use client";

import { useEffect, useState } from "react";
import { nudgeCopy } from "@/lib/referral";

// True if a SwiftCard session cookie is present — we never nudge logged-in users.
function isLoggedIn(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=]*-auth-token=/.test(document.cookie);
}

// Mounted once on public pages. Listens for `triggerSignupNudge(source)` events
// and shows ONE friendly signup popup per visitor per session, never blocking
// the action that triggered it and never to logged-in users.
export default function SignupNudgeHost() {
  const [source, setSource] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    function onNudge(e: Event) {
      const src = (e as CustomEvent).detail?.source ?? "default";
      if (isLoggedIn()) return;
      try {
        if (sessionStorage.getItem("sc_nudged")) return;
        sessionStorage.setItem("sc_nudged", "1");
      } catch { /* private mode — show once anyway */ }
      setSource(src);
    }
    window.addEventListener("sc:nudge", onNudge as EventListener);
    return () => window.removeEventListener("sc:nudge", onNudge as EventListener);
  }, []);

  if (!source) return null;
  const copy = nudgeCopy(source);

  function dismiss() {
    setClosing(true);
    setTimeout(() => setSource(null), 200);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="Create your own SwiftCard"
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur shadow-2xl px-4 py-3.5 flex items-center gap-3 transition-all duration-200"
        style={{ transform: closing ? "translateY(20px)" : "translateY(0)", opacity: closing ? 0 : 1 }}
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 100 100" className="w-4 h-4"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="#60a5fa" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold leading-tight">{copy.title}</p>
          <p className="text-gray-400 text-xs mt-0.5 leading-snug">{copy.sub}</p>
        </div>
        <a
          href={`/join?src=${encodeURIComponent(source)}`}
          className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-full transition-colors whitespace-nowrap"
        >
          {copy.cta}
        </a>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors -mr-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
        </button>
      </div>
    </div>
  );
}
