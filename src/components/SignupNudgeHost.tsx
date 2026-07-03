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

// Mounted once on public pages. Listens for `triggerSignupNudge(source)` events
// and shows ONE friendly signup popup per visitor per session, never blocking
// the action that triggered it and never to logged-in users.
// Exception: "share_info" (the connect/share follow-up) is a deliberate moment
// with its own once-per-session slot, so it still fires after a generic nudge.
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
    setTimeout(() => setSource(null), 200);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pointer-events-none"
      role="dialog"
      aria-label="Create your own SwiftCard"
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-3xl p-[1.5px] bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 shadow-[0_12px_45px_rgba(79,70,229,0.45)] transition-all duration-200"
        style={{ transform: closing ? "translateY(24px)" : "translateY(0)", opacity: closing ? 0 : 1 }}
      >
        <div className="relative rounded-[calc(1.5rem-1.5px)] bg-gray-950/95 backdrop-blur px-5 pt-5 pb-4">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-400/30 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 100 100" className="w-5 h-5"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="#93c5fd" /></svg>
            </div>
            <div className="min-w-0 pr-5">
              <p className="text-white text-[15px] font-bold leading-tight">{copy.title}</p>
              <p className="text-gray-400 text-xs mt-1 leading-snug">{copy.sub}</p>
            </div>
          </div>
          <a
            href={`/join?src=${encodeURIComponent(source)}&to=live`}
            className="flex items-center justify-center gap-1.5 w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 transition-colors shadow-lg shadow-blue-900/40"
          >
            {copy.cta} →
          </a>
          <p className="text-gray-500 text-[11px] text-center mt-2">Try it live first — no signup needed</p>
        </div>
      </div>
    </div>
  );
}
