"use client";

// "Text them my card" — sends YOUR card link to this contact's phone through
// the app's Twilio number (for when you have their number but they don't have
// yours). Two-tap: first tap arms it (shows confirm), second tap sends.

import { useState } from "react";

export default function ShareMyCardButton({ leadId, firstName }: { leadId: string; firstName: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/leads/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
        setTimeout(() => setState("idle"), 4000);
      } else {
        setErrMsg(d.error || "Couldn't send");
        setState("error");
        setTimeout(() => setState("idle"), 5000);
      }
    } catch {
      setErrMsg("Couldn't send");
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  if (state === "confirm" || state === "sending") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (state === "confirm") send(); }}
        onBlur={() => state === "confirm" && setState("idle")}
        disabled={state === "sending"}
        className="h-7 px-2 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-500 transition-colors shrink-0 text-[10px] font-bold text-white whitespace-nowrap"
        title={`Text your card to ${firstName}`}
      >
        {state === "sending" ? "Sending…" : `Text ${firstName}? ✓`}
      </button>
    );
  }
  if (state === "sent") {
    return (
      <span className="h-7 px-2 rounded-lg flex items-center bg-emerald-900/60 text-emerald-300 text-[10px] font-bold shrink-0 whitespace-nowrap" title="Sent">
        Sent ✓
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="h-7 px-2 rounded-lg flex items-center bg-red-950/60 text-red-300 text-[10px] shrink-0 max-w-[140px] truncate" title={errMsg}>
        {errMsg}
      </span>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setState("confirm"); }}
      title={`Share my card — texts your card link to ${firstName}'s phone`}
      className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-blue-900 transition-colors shrink-0"
    >
      {/* card + arrow icon */}
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-400">
        <path d="M2 5.5A1.5 1.5 0 013.5 4h9A1.5 1.5 0 0114 5.5v3.05a4.5 4.5 0 00-1.5-.05V7h-11v5.5a.5.5 0 00.5.5h6.05a4.52 4.52 0 00.4 1.5H2.5A1.5 1.5 0 011 13V5.5h1z" />
        <path d="M15.5 10a.75.75 0 01.75.75v1h1a.75.75 0 010 1.5h-1v1a.75.75 0 01-1.5 0v-1h-1a.75.75 0 010-1.5h1v-1a.75.75 0 01.75-.75z" />
        <path d="M2 5.5h12V7H2z" opacity=".55" />
      </svg>
    </button>
  );
}
