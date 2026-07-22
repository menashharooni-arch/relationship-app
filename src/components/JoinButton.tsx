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
      // Straight into the REAL card builder — the same 4-step wizard everyone
      // uses (Card info → Card design → Socials → Social design). The wizard's
      // ?add=1 path resolves their office context server-side: branding fields
      // (company/logo/website/phone/fax/address) render as "Managed by your
      // organization" and Card design locks when the admin locked it. (Owner
      // decision, Jul 2026 — replaced the old simplified /welcome/team form.)
      setTimeout(() => { window.location.href = "/cards/new?add=1"; }, 900);
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="w-full bg-green-900/30 border border-green-700/50 text-green-300 font-semibold py-3 rounded-full text-sm text-center">
        You&apos;re in! Let&apos;s build your card…
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
