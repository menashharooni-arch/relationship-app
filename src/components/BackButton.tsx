"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Pages that should never show the back button.
const HIDDEN_PATHS = ["/", "/dashboard"];
// Public-facing surfaces (card + Swift Links) never show it either.
const HIDDEN_PREFIXES = ["/card/", "/links/"];

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    // Only show when this tab actually has a previous page to go back to.
    if (typeof window !== "undefined" && window.history.length > 1) {
      setHasHistory(true);
    }
  }, []);

  if (!hasHistory) return null;
  if (HIDDEN_PATHS.includes(pathname)) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back to the previous page"
      className="fixed top-3 left-3 z-50 flex items-center gap-1.5 rounded-full pl-2.5 pr-3.5 py-2 text-sm font-medium text-white border border-white/15 shadow-lg backdrop-blur transition-colors hover:brightness-125"
      style={{ background: "rgba(15,23,42,0.82)" }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
