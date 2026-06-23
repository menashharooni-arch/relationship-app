"use client";

import { useState } from "react";

export default function JoinButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleJoin() {
    setStatus("joining");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="w-full bg-green-900/30 border border-green-700/50 text-green-300 font-semibold py-3 rounded-full text-sm text-center">
        Joined! Redirecting to your dashboard…
      </div>
    );
  }

  return (
    <div>
      {status === "error" && (
        <p className="text-red-400 text-xs text-center mb-3">{error}</p>
      )}
      <button
        onClick={handleJoin}
        disabled={status === "joining"}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "joining" ? "Joining…" : "Accept invitation →"}
      </button>
    </div>
  );
}
