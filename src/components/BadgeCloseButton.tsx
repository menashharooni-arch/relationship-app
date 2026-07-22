"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Visitors land here via the "Made with SwiftCard" badge on a shared card
// page (?src=badge) — a full-page navigation away from the card, not an
// in-page overlay. On mobile that left them stuck with no obvious way back
// to the card they were viewing. This renders a small faded close button
// only in that context, letting them bail back to the card in one tap.
function CloseButton() {
  const params = useSearchParams();
  if (params.get("src") !== "badge") return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }}
      aria-label="Close and go back"
      className="fixed top-4 right-4 z-50 w-9 h-9 rounded-full bg-black/20 hover:bg-black/35 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export default function BadgeCloseButton() {
  return (
    <Suspense fallback={null}>
      <CloseButton />
    </Suspense>
  );
}
