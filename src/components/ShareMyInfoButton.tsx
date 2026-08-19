"use client";

// "Share my contact information" on a contact's detail view. Small but
// noticeable: sits beside Call / Save to phone. Tapping it opens a four-way
// picker.
//
// The first three — text / email / both — send a one-time message ("Save my
// contact information in the link below" + the owner's card link) through the
// same Twilio number / email sender the automations use. Options the contact
// has no channel for are disabled.
//
// The fourth, "Share from my phone", is different in kind: it sends nothing
// server-side. It opens the device's own share sheet with the card link, so the
// message goes from the OWNER'S number/apps instead of the SwiftCard sender.
// Same path as the dashboard ShareButton (Capacitor in the native shell,
// navigator.share on the web, copy-link as the desktop fallback).
//
// NOTE: the share sheet cannot be pre-addressed to this contact. navigator.share
// takes only {title,text,url,files} — there is no recipient field, and the
// suggested-contacts row is populated by the OS from the user's own message
// history, not by the page. Pre-filling a specific number needs an `sms:` deep
// link, which trades away every non-SMS app in the sheet. Deliberately NOT
// logged to lead_messages either: we can't observe whether the owner actually
// completed the share, and recording an unverified "sent" is the exact failure
// the Twilio delivery-status work removed.

import { useEffect, useRef, useState } from "react";
import { detectNativeApp } from "@/lib/platform";

// Pinned to the SwiftCard domain, NOT window.location.origin — same reason
// LoginForm pins it. On a Vercel preview host, origin would hand the recipient
// a *.vercel.app link that 404s once the preview is torn down, and it would
// disagree with the link the share-card route sends for the other three
// options. The card link must be canonical wherever it is shared from.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

type Props = {
  leadId: string;
  firstName: string;
  hasPhone: boolean;
  hasEmail: boolean;
  /** Card slug the contact belongs to — the link the phone share hands off. */
  cardOwner: string | null;
  /** Called after a send the SERVER accepted, so the Activity & Messages panel
   *  can re-read the thread it just wrote to. Not called for the phone share:
   *  that one sends nothing server-side and logs nothing, so there is nothing
   *  new to read back. */
  onSent?: () => void;
};

type Channel = "sms" | "email" | "both";
type Action = Channel | "phone";

export default function ShareMyInfoButton({ leadId, firstName, hasPhone, hasEmail, cardOwner, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "copied" | "error">("idle");
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
        // The route logged this to the contact's thread; tell the panel to
        // re-read it so the message appears now rather than on the next visit.
        onSent?.();
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

  // Hand the card link to the device's own share sheet. Nothing is sent by us
  // and nothing is logged — the owner picks the app and the recipient, and we
  // never learn whether they went through with it.
  async function sharePhone() {
    setOpen(false);
    if (!cardOwner) return;
    const url = `${APP_URL}/${cardOwner}?shared=1`;

    // Native shell: WKWebView often lacks navigator.share.
    if (detectNativeApp()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ url });
        return;
      } catch { /* fall through to the web paths */ }
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      // Bare URL only — iMessage and most messengers render the rich card
      // preview only when the message is just the link.
      try { await navigator.share({ url }); } catch { /* cancelled */ }
      return;
    }
    // Desktop: no share sheet to open, so put the link on the clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      window.prompt("Copy your card link:", url);
    }
  }

  const OPTIONS: { action: Action; label: string; enabled: boolean; hint: string }[] = [
    { action: "email", label: "Share by email", enabled: hasEmail, hint: hasEmail ? `Emails your card to ${firstName}` : "No email on this contact" },
    { action: "sms", label: "Share by text", enabled: hasPhone, hint: hasPhone ? `Texts your card to ${firstName}` : "No phone on this contact" },
    { action: "both", label: "Share by both", enabled: hasPhone && hasEmail, hint: hasPhone && hasEmail ? "One text + one email" : "Needs both a phone and an email" },
    // Enabled regardless of what channels the CONTACT has — this shares from
    // the owner's own phone, so it only needs a card link to hand over.
    { action: "phone", label: "Share from my phone", enabled: !!cardOwner, hint: cardOwner ? "Opens your phone's share sheet" : "No card linked to this contact" },
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
          state === "sent" || state === "copied"
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
        ) : state === "copied" ? (
          <>Link copied!</>
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
              key={o.action}
              role="menuitem"
              type="button"
              disabled={!o.enabled}
              onClick={() => (o.action === "phone" ? sharePhone() : send(o.action))}
              // The phone option is separated: the three above send from
              // SwiftCard, this one hands off to the owner's own apps.
              className={`w-full text-left px-3.5 py-2.5 hover:bg-gray-800 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors ${
                o.action === "phone" ? "border-t border-gray-800" : ""
              }`}
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
