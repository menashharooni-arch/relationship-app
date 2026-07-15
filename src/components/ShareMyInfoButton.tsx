"use client";

// "Share my contact information" on a contact's detail view. Small but
// noticeable: sits beside Call / Save to phone. Tapping it opens a three-way
// picker — Share by text / Share by email / Share by both — and sends a
// one-time message ("Save my contact information in the link below" + the
// owner's card link) through the same Twilio number / email sender the
// automations use. Options the contact has no channel for are disabled.

import { useEffect, useRef, useState } from "react";

type Props = {
  leadId: string;
  firstName: string;
  hasPhone: boolean;
  hasEmail: boolean;
};

type Channel = "sms" | "email" | "both";

export default function ShareMyInfoButton({ leadId, firstName, hasPhone, hasEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the picker on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function send(channel: Channel) {
    setOpen(false);
    setState("sending");
    try {
      const res = await fetch("/api/leads/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, channel }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
        setTimeout(() => setState("idle"), 4000);
      } else {
        setErrMsg((d as { error?: string }).error || "Couldn't send");
        setState("error");
        setTimeout(() => setState("idle"), 5000);
      }
    } catch {
      setErrMsg("Couldn't send");
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  const OPTIONS: { channel: Channel; label: string; enabled: boolean; hint: string }[] = [
    { channel: "email", label: "Share by email", enabled: hasEmail, hint: hasEmail ? `Emails your card to ${firstName}` : "No email on this contact" },
    { channel: "sms", label: "Share by text", enabled: hasPhone, hint: hasPhone ? `Texts your card to ${firstName}` : "No phone on this contact" },
    { channel: "both", label: "Share by both", enabled: hasPhone && hasEmail, hint: hasPhone && hasEmail ? "One text + one email" : "Needs both a phone and an email" },
  ];

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => state === "idle" && setOpen((v) => !v)}
        disabled={state === "sending"}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Share your contact information with ${firstName}`}
        className={`flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors ${
          state === "sent"
            ? "bg-emerald-600/20 border border-emerald-600/50 text-emerald-300"
            : state === "error"
              ? "bg-red-950/60 border border-red-800 text-red-300"
              : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {state === "sending" ? (
          "Sending…"
        ) : state === "sent" ? (
          <>Sent ✓</>
        ) : state === "error" ? (
          <span className="max-w-[120px] truncate" title={errMsg}>{errMsg}</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
            </svg>
            Share
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-30 w-56 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
        >
          <p className="px-3.5 pt-3 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
            Share my contact info
          </p>
          {OPTIONS.map((o) => (
            <button
              key={o.channel}
              role="menuitem"
              type="button"
              disabled={!o.enabled}
              onClick={() => send(o.channel)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-gray-800 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            >
              <span className={`block text-[13px] font-semibold ${o.enabled ? "text-gray-100" : "text-gray-600"}`}>{o.label}</span>
              <span className={`block text-[11px] ${o.enabled ? "text-gray-500" : "text-gray-700"}`}>{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
