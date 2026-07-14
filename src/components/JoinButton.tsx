"use client";

import { useState } from "react";

export default function JoinButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "declining" | "declined" | "error">("idle");
  const [error, setError] = useState("");

  async function handleDecline() {
    setStatus("declining");
    try {
      const res = await fetch("/api/office/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Couldn't decline. Try again.");
        setStatus("error");
        return;
      }
      setStatus("declined");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

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

  if (status === "declined") {
    return (
      <div className="w-full bg-gray-800 border border-gray-700 text-gray-300 font-medium py-3 rounded-full text-sm text-center">
        Invitation declined. You can close this page.
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
        disabled={status === "joining" || status === "declining"}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors text-sm"
      >
        {status === "joining" ? "Joining…" : "Accept invitation →"}
      </button>
      <button
        onClick={handleDecline}
        disabled={status === "joining" || status === "declining"}
        className="w-full mt-2 text-gray-500 hover:text-gray-300 disabled:opacity-50 text-xs py-2 transition-colors"
      >
        {status === "declining" ? "Declining…" : "Decline invitation"}
      </button>
    </div>
  );
}
