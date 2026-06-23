"use client";

import { useState } from "react";

type Props = {
  url: string;
  title?: string;
  text?: string;
  label?: string;
  variant?: "primary" | "secondary";
};

export default function ShareButton({
  url,
  title = "My Kontact card",
  text = "Save my contact and connect with me instantly.",
  label = "Share Card",
  variant = "primary",
}: Props) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    // Use native share sheet if available (iOS, Android, some desktop browsers)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled — do nothing
        return;
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      // Last resort: prompt
      window.prompt("Copy your card link:", url);
    }
  }

  const isPrimary = variant === "primary";

  return (
    <button
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-full transition-colors text-sm"
      style={
        isPrimary
          ? { background: "linear-gradient(to right, #2563eb, #7c3aed)", color: "#fff" }
          : { background: "transparent", border: "1px solid #374151", color: "#d1d5db" }
      }
    >
      {status === "copied" ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Link copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
