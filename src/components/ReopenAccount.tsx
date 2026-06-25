"use client";

import { useState } from "react";

export default function ReopenAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reopen() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/reopen", { method: "POST" });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Couldn't reopen your account. Please try again.");
    } catch {
      setError("Couldn't reopen your account. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-xs">
      <button
        type="button"
        onClick={reopen}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full text-sm transition-colors"
      >
        {loading ? "Reopening…" : "Reopen my account"}
      </button>
      {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}
