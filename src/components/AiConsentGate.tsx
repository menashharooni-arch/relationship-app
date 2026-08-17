"use client";

import { useEffect, useState } from "react";
import { useIsNativeApp } from "@/lib/platform";
import type { AiConsent } from "@/lib/ai-consent";

/**
 * Asks permission before any of the user's data reaches the AI provider.
 *
 * Rewritten after App Review rejected 1.0.0 (3) under Guidelines 5.1.1(i) and
 * 5.1.2(i). The previous version failed every part of what Apple asked for: it
 * said "our AI provider" without naming one, described the data only as
 * "contact details you provide" while never mentioning that the scanner
 * uploads a photo of somebody ELSE's business card, and offered a single
 * "Got it" button — an acknowledgement, not permission.
 *
 * Now it names the recipient (resolved from the live provider, so it cannot go
 * stale — see lib/ai.ts aiProviderName), itemises what is sent, and offers a
 * real choice. "Don't allow" is stored and honoured server-side on every AI
 * route, so declining actually stops the data leaving.
 *
 * Still native-only: the web must not gain new visible UI, and a web user has
 * refused nothing. An explicit decline, however, is honoured on every platform.
 */
export default function AiConsentGate({
  consent,
  provider,
  copy,
}: {
  consent: AiConsent;
  /** Live provider name; null when no AI is configured, which hides the gate. */
  provider: string | null;
  copy: { title: string; what: string[]; who: string; control: string };
}) {
  const native = useIsNativeApp();
  const [decided, setDecided] = useState(consent !== "unset");
  const [saving, setSaving] = useState(false);

  // A declined account is NOT nagged on every screen — the choice is already
  // stored and enforced. It re-opens once per launch so someone who changes
  // their mind has a way back in without hunting for a setting.
  const [dismissedThisSession, setDismissed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop sync into locally-owned state
    setDecided(consent === "accepted");
  }, [consent]);

  const open = native && !!provider && !decided && !dismissedThisSession;

  async function choose(decision: "accepted" | "declined") {
    setSaving(true);
    setDecided(decision === "accepted");
    setDismissed(true);
    try {
      await fetch("/api/account/ai-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch {
      /* stored on the next successful call; the choice holds for this session */
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.8} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>

        <p id="ai-consent-title" className="text-center text-base font-bold text-white">
          {copy.title}
        </p>

        <p className="mt-3 text-[13px] font-semibold text-gray-300">What gets sent</p>
        <ul className="mt-1.5 space-y-1.5">
          {copy.what.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-snug text-gray-400">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-600" />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[13px] leading-relaxed text-gray-300">{copy.who}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{copy.control}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => choose("accepted")}
            disabled={saving}
            className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            Allow
          </button>
          <button
            type="button"
            onClick={() => choose("declined")}
            disabled={saving}
            className="w-full rounded-full py-3 text-sm font-semibold text-gray-400 transition-colors hover:text-white disabled:opacity-60"
          >
            Don&apos;t allow
          </button>
        </div>
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
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-300">
      AI draft
    </span>
  );
}
