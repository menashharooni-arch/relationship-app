"use client";

import { useState } from "react";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Couldn't open the billing portal.");
    } catch {
      setError("Couldn't open the billing portal.");
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="w-full text-center text-xs font-semibold text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full py-2.5 transition-colors disabled:opacity-50"
      >
        {loading ? "Opening…" : "Manage subscription & payment"}
      </button>
      {error && <p className="text-red-400 text-xs mt-1.5 text-center">{error}</p>}
    </div>
  );
}
