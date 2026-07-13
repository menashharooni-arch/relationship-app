"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearDraft, hasPendingDraft, loadDraft } from "@/lib/guest-draft";

// Mounted on the pages an authenticated user lands on after signing in with a
// pending guest draft (the editor wrappers, dashboard, onboarding). On mount it
// POSTs the localStorage draft to /api/drafts/claim, which creates the real
// `cards` row under the SESSION user, then routes the user into the editor for
// their now-saved card. Everything is idempotent server-side, so a double mount
// (duplicate OAuth callback, refresh, second tab) never duplicates the card.
export default function GuestDraftClaim() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev — guard so we only claim once.
    if (ranRef.current) return;
    if (!hasPendingDraft()) return;
    ranRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the "saving…" overlay while the one-time claim runs
    setVisible(true);

    const draft = loadDraft();
    if (!draft) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/drafts/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: draft.id,
            payload: draft.payload,
            images: draft.images,
            step: draft.step,
          }),
        });

        const data = await res.json().catch(() => ({} as Record<string, unknown>));

        if (cancelled) return;

        if (res.status === 401) {
          // Session vanished between landing and claim — send them to log in,
          // KEEPING the draft so nothing is lost. claim=1 so the editor re-runs
          // the claim on the post-auth return (a bare /cards/new never claims).
          const next = encodeURIComponent("/cards/new?claim=1");
          window.location.href = `/login?next=${next}&draft=1`;
          return;
        }

        if (res.status === 402) {
          // Free card limit reached — can't save another card. Discard the draft
          // to avoid a redirect loop and route to upgrade.
          clearDraft();
          router.push("/pricing?from=claim");
          return;
        }

        if (!res.ok || !data || typeof (data as { id?: unknown }).id !== "string") {
          // Bad payload / invalid draft / server error → discard and bail to the
          // dashboard rather than crash or loop.
          clearDraft();
          router.replace("/dashboard");
          return;
        }

        // Success — the card exists under this account now.
        clearDraft();
        const id = (data as { id: string }).id;
        const slug = (data as { slug?: string }).slug;
        const first = (data as { first?: boolean }).first;
        if (first) {
          // Brand-new account: send them through onboarding — choose a plan
          // (pay if Pro/Office), turn on notifications, then the dashboard + tour.
          router.replace(`/welcome${slug ? `?card=${encodeURIComponent(slug)}` : ""}`);
        } else {
          router.replace(`/cards/${id}/edit?claimed=1`);
        }
      } catch {
        if (cancelled) return;
        // Network error — keep the draft (they can retry by reloading) but don't
        // block the page behind the overlay forever.
        setVisible(false);
        ranRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
        <p className="text-sm font-medium text-gray-300">Saving your work…</p>
      </div>
    </div>
  );
}
