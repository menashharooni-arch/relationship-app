"use client";

import { useState } from "react";
import Link from "next/link";

export default function UpgradeButton({ variant = "banner" }: { variant?: "banner" | "inline" }) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const { url, error } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        console.error("Checkout error:", error);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  if (variant === "inline") {
    return (
      <div className="rounded-2xl p-5 mt-2" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1a2744 100%)", border: "1px solid #2d4a7a" }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 20 20" fill="#60a5fa" className="w-4 h-4">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 8l-3.293-3.293A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Unlock unlimited leads</p>
            <p className="text-blue-300 text-xs mt-0.5 leading-relaxed">You&apos;ve hit the free limit. Go Pro for $8/mo — unlimited leads, analytics, no branding.</p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
        >
          {loading ? "Loading…" : "Upgrade to Pro · $8/mo →"}
        </button>
        <p className="text-center text-blue-400/60 text-[10px] mt-2">Cancel anytime · No contracts</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap"
    >
      {loading ? "…" : "Upgrade · $8/mo →"}
    </button>
  );
}

export function UpgradeLink({ className }: { className?: string }) {
  return (
    <Link href="/pricing" className={className ?? "text-xs text-blue-400 hover:text-blue-300 font-semibold"}>
      Upgrade →
    </Link>
  );
}
