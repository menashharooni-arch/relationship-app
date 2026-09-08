"use client";

// "Share my contact information" on a contact's detail view. Small but
// noticeable: sits beside Call / Save to phone. Tapping it opens a four-way
// picker. Every option hands off to the OWNER'S OWN PHONE — nothing is sent
// through SwiftCard's Twilio number or email sender, and nothing is logged.
//
//   • Share by text   — opens Messages addressed to THIS contact with the
//                       message already written; the owner just presses send.
//   • Share by email  — opens Mail addressed to THIS contact with the subject,
//                       the message and the owner's signature already written.
//   • Share by both   — the text first; when the owner comes back the button
//                       reads "Now email →" and opens the email.
//   • Share from my phone — the OS share sheet with the bare card link, for
//                       WhatsApp / AirDrop / anything else. Not pre-addressed:
//                       navigator.share has no recipient field.
//
// The owner asked for exactly this (2026-09-08): a share should open the
// contact's thread on his phone, pre-filled, so the message goes from HIS
// number and HIS mailbox. That also side-steps the deliverability problems of
// mail sent on someone's behalf — a message from the owner's own address is
// never "via SwiftCard".
//
// Two things the platform will not allow, so this code does not pretend to:
//   1. A mailto: body is plain text. The Swift Signature IMAGE cannot ride in
//      it, so the email signs off with the same details as text (name, title ·
//      company, phone, email). The recipient gets the card picture the moment
//      they open the link.
//   2. Neither an sms: nor a mailto: hand-off tells us whether the owner sent
//      it, so none of these write to the contact's Activity & Messages thread.
//      Recording an unverified "Sent" is the exact bug the Twilio
//      delivery-status work removed.

import { useEffect, useRef, useState } from "react";
import { detectNativeApp } from "@/lib/platform";
import { warmSharePreview } from "@/lib/share-preview";

// Pinned to the SwiftCard domain, NOT window.location.origin — same reason
// LoginForm pins it. On a Vercel preview host, origin would hand the recipient
// a *.vercel.app link that 404s once the preview is torn down. The card link
// must be canonical wherever it is shared from.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

/** The card the contact belongs to — what the messages are signed with. */
export type CardSigner = {
  name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
};

type Props = {
  firstName: string;
  /** The contact's own channels — the sms:/mailto: hand-offs are addressed to these. */
  phone: string | null;
  email: string | null;
  /** Card slug the contact belongs to — the link every option hands over. */
  cardOwner: string | null;
  signer: CardSigner | null;
};

type Action = "sms" | "email" | "both" | "phone";

/** "Hi john@acme.com," is worse than "Hi," — greet by nothing rather than noise. */
function greetingName(firstName: string): string {
  const w = (firstName || "").trim();
  return /^[\p{L}'’-]{2,}$/u.test(w) ? w : "";
}

/**
 * The text the owner sends. The link is the LAST line on its own: iMessage
 * renders the rich card preview for a link at the start or end of a message,
 * and drops it for one buried in the middle.
 */
export function shareTextBody(opts: { firstName: string; ownerName: string; cardUrl: string }): string {
  const first = greetingName(opts.firstName);
  return `${first ? `Hi ${first}! ` : ""}${opts.ownerName} here - save my contact information in the link below.\n${opts.cardUrl}`;
}

/** Subject + plain-text body for the mailto: hand-off, signature included. */
export function shareEmail(opts: { firstName: string; signer: CardSigner | null; ownerName: string; cardUrl: string }): { subject: string; body: string } {
  const first = greetingName(opts.firstName);
  const s = opts.signer;
  const signature = [
    opts.ownerName,
    [s?.title, s?.company].filter(Boolean).join(" · "),
    s?.phone,
    s?.email,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  const body = [
    first ? `Hi ${first},` : "Hi,",
    "",
    "Save my contact information in the link below. It opens my digital business card, and you can add me to your phone with one tap.",
    "",
    opts.cardUrl,
    "",
    ...signature,
  ].join("\r\n"); // RFC 6068: line breaks in a mailto: body are %0D%0A
  return { subject: `Contact information from ${opts.ownerName}`, body };
}

/** sms: deep link addressed to one number with the message pre-filled.
 *  `?&body=` is the form both iOS (wants `&`) and Android (wants `?`) accept. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function ShareMyInfoButton({ firstName, phone, email, cardOwner, signer }: Props) {
  const [open, setOpen] = useState(false);
  // "emailNext" is the second half of "Share by both": the text has been
  // handed off, and the button now offers the email.
  const [state, setState] = useState<"idle" | "copied" | "emailNext">("idle");
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

  // The "Now email →" offer should not sit there forever if the owner moves on.
  useEffect(() => {
    if (state !== "emailNext") return;
    const t = setTimeout(() => setState("idle"), 90_000);
    return () => clearTimeout(t);
  }, [state]);

  const hasPhone = !!phone;
  const hasEmail = !!email;
  // The link carries ?shared=1: the owner pressed Share on a contact they
  // already HAVE, so the card page tells the recipient their info has already
  // been shared instead of asking them to fill the share-back form.
  const cardUrl = cardOwner ? `${APP_URL}/${cardOwner}?shared=1` : null;
  const ownerName = signer?.name?.trim() || "SwiftCard user";

  // Open the contact's thread in Messages, message already written. Nothing
  // is awaited first: the navigation must ride on the tap itself.
  function openText() {
    if (!phone || !cardUrl) return;
    warmSharePreview(cardUrl);
    window.location.assign(smsHref(phone, shareTextBody({ firstName, ownerName, cardUrl })));
  }

  // Open a new email to the contact in the owner's mail app — subject, message
  // and signature already written.
  function openEmail() {
    if (!email || !cardUrl) return;
    warmSharePreview(cardUrl);
    const { subject, body } = shareEmail({ firstName, signer, ownerName, cardUrl });
    window.location.assign(mailtoHref(email, subject, body));
  }

  function shareText() {
    setOpen(false);
    setState("idle");
    openText();
  }

  function shareEmailNow() {
    setOpen(false);
    setState("idle");
    openEmail();
  }

  // Two apps cannot open from one tap. The text goes first; the button then
  // turns into the email offer for when the owner is back.
  function shareBoth() {
    setOpen(false);
    openText();
    setState("emailNext");
  }

  // Hand the card link to the device's own share sheet. Nothing is sent by us
  // and nothing is logged — the owner picks the app and the recipient, and we
  // never learn whether they went through with it.
  async function sharePhone() {
    setOpen(false);
    if (!cardOwner) return;
    const url = `${APP_URL}/${cardOwner}?shared=1`;
    warmSharePreview(url);

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
    { action: "email", label: "Share by email", enabled: hasEmail && !!cardUrl, hint: hasEmail ? `Opens an email to ${firstName}, ready to send` : "No email on this contact" },
    { action: "sms", label: "Share by text", enabled: hasPhone && !!cardUrl, hint: hasPhone ? `Opens a text to ${firstName}, ready to send` : "No phone on this contact" },
    { action: "both", label: "Share by both", enabled: hasPhone && hasEmail && !!cardUrl, hint: hasPhone && hasEmail ? "The text first, then the email" : "Needs both a phone and an email" },
    // Enabled regardless of what channels the CONTACT has — this shares from
    // the owner's own phone, so it only needs a card link to hand over.
    { action: "phone", label: "Share from my phone", enabled: !!cardOwner, hint: cardOwner ? "Opens your phone's share sheet" : "No card linked to this contact" },
  ];

  const run = (action: Action) => {
    if (action === "sms") shareText();
    else if (action === "email") shareEmailNow();
    else if (action === "both") shareBoth();
    else sharePhone();
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (state === "emailNext" ? shareEmailNow() : state === "idle" && setOpen((v) => !v))}
        aria-expanded={open}
        aria-haspopup="menu"
        title={state === "emailNext" ? `Now open the email to ${firstName}` : `Share your contact information with ${firstName}`}
        className={`flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors ${
          state === "copied"
            ? "bg-emerald-600/20 border border-emerald-600/50 text-emerald-300"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {state === "copied" ? (
          <>Link copied!</>
        ) : state === "emailNext" ? (
          <>Now email →</>
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
              onClick={() => run(o.action)}
              // The phone option is separated: the three above are addressed
              // to this contact, this one lets the owner pick any app.
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
