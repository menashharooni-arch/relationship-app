"use client";

import { useState } from "react";

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
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

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors whitespace-nowrap"
    >
      {loading ? "Loading…" : "Upgrade to Pro"}
    </button>
  );
}
