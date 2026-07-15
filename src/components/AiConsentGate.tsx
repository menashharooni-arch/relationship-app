"use client";

import { useEffect, useState } from "react";
import { useIsNativeApp } from "@/lib/platform";

// Exact, mandated consent copy (App Store, Nov 2025 AI rules). Do not edit.
export const AI_CONSENT_COPY =
  "SwiftCard uses AI to draft your follow-up messages. Contact details you provide are processed by our AI provider to generate drafts.";

/**
 * One-time AI-consent notice, shown ONLY inside the native app before the user
 * first uses an AI feature (AI drafts, AI sequences, AI card scan). Acceptance
 * is stored on profiles.customization._aiConsentAccepted so it never shows again.
 *
 * Web: renders nothing (this is a native-only compliance surface).
 * Native: if the account hasn't accepted yet, shows a blocking notice with the
 * exact copy and a single "Got it" acknowledgment — no upsell, no pricing.
 *
 * Mount it on the screens where AI features live (Contacts, the scanner) and
 * pass the account's stored flag as `accepted`.
 */
export default function AiConsentGate({ accepted }: { accepted: boolean }) {
  const native = useIsNativeApp();
  const [done, setDone] = useState(accepted);
  const [saving, setSaving] = useState(false);

  // Only open on native for an account that hasn't accepted. Web + first paint
  // keep it closed, so there's no hydration mismatch.
  const open = native && !done;

  // Best-effort: if the flag couldn't be stored (offline), we still don't nag
  // within the same session once acknowledged.
  useEffect(() => {
    setDone(accepted);
  }, [accepted]);

  async function accept() {
    setSaving(true);
    setDone(true);
    try {
      await fetch("/api/account/ai-consent", { method: "POST" });
    } catch {
      /* stored on next successful call; already acknowledged this session */
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI notice"
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <p className="text-sm leading-relaxed text-gray-200 text-center">{AI_CONSENT_COPY}</p>
        <button
          type="button"
          onClick={accept}
          disabled={saving}
          className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 rounded-full text-sm transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * Small "AI draft" tag shown next to AI-generated message text. NATIVE-ONLY —
 * it must never appear on web (adding new visible web UI is forbidden). Renders
 * nothing on web and on the first client paint.
 */
export function AiDraftTag() {
  const native = useIsNativeApp();
  if (!native) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 text-blue-300 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
      AI draft
    </span>
  );
}
