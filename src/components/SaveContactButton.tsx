"use client";

import { useState, useEffect } from "react";
import { getVisitorId } from "@/lib/visitor";
import { triggerSignupNudge } from "@/lib/nudge";

interface Person {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  phones?: { number: string; label: string; showOnCard: boolean }[];
  fax?: string;
  website: string;
  address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
}

const STORAGE_KEY = "swiftcard_shared";

function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function trackEvent(username: string, eventType: string, source: string) {
  const visitorId = getVisitorId();
  fetch("/api/card-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_owner_username: username, visitor_id: visitorId, event_type: eventType, source }),
  }).catch(() => {});
}

export default function SaveContactButton({
  person,
  username,
  source = "direct_link",
  cardOwner,
  ownerFirstName,
}: {
  person: Person;
  username?: string;
  source?: string;
  cardOwner?: string;
  ownerFirstName?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!cardOwner) return;
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (data[cardOwner]) setAlreadyShared(true);
    } catch { /* ignore */ }
  }, [cardOwner]);

  function downloadVCard() {
    if (username) trackEvent(username, "clicked_save_contact", source);

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${person.name}`,
      `N:${person.name.split(" ").slice(1).join(" ")};${person.name.split(" ")[0]};;;`,
    ];
    if (person.title)    lines.push(`TITLE:${person.title}`);
    if (person.company)  lines.push(`ORG:${person.company}`);
    if (person.email)    lines.push(`EMAIL;TYPE=WORK:${person.email}`);

    // All phone numbers, typed (mobile → CELL, office → WORK), then fax.
    const phones = (person.phones ?? []).filter((p) => p.number?.trim());
    if (phones.length) {
      for (const p of phones) {
        const type = p.label === "office" ? "WORK,VOICE" : "CELL,VOICE";
        lines.push(`TEL;TYPE=${type}:${p.number.trim()}`);
      }
    } else if (person.phone) {
      lines.push(`TEL:${person.phone}`);
    }
    if (person.fax?.trim()) lines.push(`TEL;TYPE=FAX:${person.fax.trim()}`);

    if (person.website)  lines.push(`URL:${normalizeUrl(person.website)}`);

    // Postal address (structured ADR: ;;street;city;state;zip;)
    const addr = person.address;
    if (addr && (addr.street || addr.city || addr.state || addr.zip)) {
      const street = [addr.street, addr.unit ? `Unit ${addr.unit}` : ""].filter(Boolean).join(" ");
      const esc = (v?: string) => (v ?? "").replace(/([,;\\])/g, "\\$1");
      lines.push(`ADR;TYPE=WORK:;;${esc(street)};${esc(addr.city)};${esc(addr.state)};${esc(addr.zip)};`);
    }
    if (person.linkedin)   lines.push(`URL;type=LinkedIn:${normalizeUrl(person.linkedin)}`);
    if (person.instagram)  lines.push(`X-SOCIALPROFILE;type=instagram:${person.instagram.replace(/^@/, "")}`);
    if (person.twitter)    lines.push(`X-SOCIALPROFILE;type=twitter:${person.twitter.replace(/^@/, "")}`);
    if (person.tiktok)     lines.push(`X-SOCIALPROFILE;type=tiktok:${person.tiktok.replace(/^@/, "")}`);
    lines.push("END:VCARD");

    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${person.name.replace(/ /g, "_")}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSaved(true);

    if (username) {
      trackEvent(username, "downloaded_vcard", source);
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, event_type: "contact_save" }),
      }).catch(() => {});
    }

    // Show the "share your info back" lead-capture sheet (card owner's). If it
    // won't show, invite the visitor to make their OWN card instead (signup nudge).
    if (cardOwner && !alreadyShared) {
      setTimeout(() => setShowSheet(true), 900);
    } else {
      setTimeout(() => triggerSignupNudge("vcard"), 900);
    }
  }

  async function shareBack(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !cardOwner) return;
    setStatus("loading");

    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        card_owner: cardOwner,
        source: "save_contact_conversion",
      }),
    });

    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      data[cardOwner] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }

    setAlreadyShared(true);
    setStatus("done");
    // After they share back, close the sheet and invite them to make their own card.
    setTimeout(() => { setShowSheet(false); triggerSignupNudge("vcard"); }, 1500);
  }

  return (
    <>
      <button
        onClick={downloadVCard}
        className="w-full active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm flex items-center justify-center gap-2"
        style={{ background: saved ? "#16a34a" : "#1D4ED8" }}
      >
        {saved ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved to Contacts!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Save Contact
          </>
        )}
      </button>

      {/* Conversion bottom sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.target === e.currentTarget && setShowSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-6 animate-slide-up"
            style={{ background: "#FAF7F2", borderTop: "1px solid #E4DDD4" }}
          >
            {status === "done" ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold text-base">{ownerFirstName ?? "They"}&apos;ll be in touch!</p>
                <p className="text-slate-500 text-sm mt-1">Your info has been sent.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-slate-900 font-bold text-base leading-snug">
                      Let {ownerFirstName ?? "them"} have yours too
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Share your information!
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSheet(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none shrink-0 ml-3"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={shareBack} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name *"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Your phone *"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <input
                    type="email"
                    placeholder="Your email (optional)"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full font-bold py-3 rounded-full text-white text-sm transition-all disabled:opacity-50"
                    style={{ background: "#1D4ED8" }}
                  >
                    {status === "loading" ? "Sending…" : `Share my info with ${ownerFirstName ?? "them"} →`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSheet(false)}
                    className="w-full text-slate-400 text-sm py-1.5 hover:text-slate-600 transition-colors"
                  >
                    No thanks
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
}
