"use client";

import { useState, useEffect } from "react";
import { getVisitorId, getVisitorInfo, hasSharedWith, markSharedWith, hasSavedContact, markSavedContact } from "@/lib/visitor";
import { triggerSignupNudge } from "@/lib/nudge";
import { buildVCard, type VCardPhoto } from "@/lib/vcard";
import { openFileViaSystemBrowser } from "@/lib/native-file";

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
  /** THIS card owner's headshot — embedded in the saved contact when present. */
  photoUrl?: string | null;
}

// Fetch the card owner's headshot and base64-encode it for embedding. Routed
// through the SSRF-guarded same-origin image proxy so cross-origin Supabase /
// avatar URLs read cleanly (and CORS-taint can't block the read). Best-effort:
// any failure (offline, non-image, timeout) resolves to null so the contact
// still saves — just without the photo. Capped so a slow image never hangs the
// save.
async function fetchHeadshotPhoto(url: string): Promise<VCardPhoto | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`/api/img-proxy?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    // ~700KB embedded ceiling — keeps the .vcf importable on iOS/Android.
    if (blob.size > 700_000) return null;
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(blob);
    });
    const m = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/i);
    if (!m || !m[2]) return null;
    return { base64: m[2], mime: m[1] || blob.type };
  } catch {
    return null;
  }
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
  suppressTracking = false,
}: {
  person: Person;
  username?: string;
  source?: string;
  cardOwner?: string;
  ownerFirstName?: string;
  /** True when the OWNER is viewing their own card — the download still works,
      but no activity event or analytics are recorded (self-noise). */
  suppressTracking?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!cardOwner) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
    if (hasSharedWith(cardOwner)) setAlreadyShared(true);
    if (hasSavedContact(cardOwner)) setSaved(true);
    // Pre-fill from an earlier share anywhere on SwiftCard — never ask twice.
    const v = getVisitorInfo();
    if (v) setForm({ name: v.name, phone: v.phone, email: v.email });
  }, [cardOwner]);

  // Every dismissal path (X, backdrop, "No thanks") still earns the visitor a
  // friendly "create your free card" invite — the moment is already theirs.
  function closeSheet() {
    setShowSheet(false);
    triggerSignupNudge("vcard");
  }

  async function downloadVCard() {
    // Guard against a double-tap while the headshot is still fetching — one save
    // per click, no duplicate downloads or duplicate activity entries.
    if (downloading) return;
    // Conversion moment: the visitor just engaged — show the "create your free
    // card" popup right away (once per session). The save still completes
    // behind it, so the card owner never loses the contact save.
    triggerSignupNudge("vcard");
    setDownloading(true);
    try {
    // Native shell: a Blob/anchor download no-ops in WKWebView. Hand the user
    // to the server vCard over the system browser sheet, where iOS shows the
    // real "Add to Contacts" preview. Only fires in the app (username known);
    // the web path below is unchanged. Record the save first so the owner
    // still gets the activity/notification even though we navigate away.
    if (username && (await openFileViaSystemBrowser(`/api/card/${encodeURIComponent(username)}/vcard`))) {
      setSaved(true);
      markSavedContact(cardOwner);
      if (!suppressTracking) {
        trackEvent(username, "downloaded_vcard", source);
        fetch("/api/analytics/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, event_type: "contact_save" }),
        }).catch(() => {});
      }
      if (cardOwner && !alreadyShared && !hasSharedWith(cardOwner)) {
        setTimeout(() => setShowSheet(true), 900);
      }
      return;
    }
    // One action = one activity entry. We record the save once (below, as
    // "downloaded_vcard" → "saved your contact"); the extra "clicked_save_contact"
    // event was creating a duplicate line in each contact's conversation timeline.
    // Escaping + field ordering live in the shared buildVCard (src/lib/vcard.ts),
    // used by the server lead export too so contacts save identically everywhere.

    // Embed THIS card owner's headshot when they have one. Best-effort — a failed
    // fetch just omits the photo and the contact still saves.
    const photo = person.photoUrl ? await fetchHeadshotPhoto(person.photoUrl) : null;

    const vcard = buildVCard(
      {
        name: person.name,
        title: person.title,
        company: person.company,
        email: person.email,
        phone: person.phone,
        phones: person.phones,
        fax: person.fax,
        website: person.website,
        address: person.address,
        linkedin: person.linkedin,
        instagram: person.instagram,
        twitter: person.twitter,
        tiktok: person.tiktok,
      },
      photo,
    );

    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${person.name.replace(/ /g, "_")}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSaved(true);
    markSavedContact(cardOwner);

    // Owners testing their own card still get the download, but nothing is
    // recorded — no "saved your contact" event/notification to themselves.
    if (username && !suppressTracking) {
      trackEvent(username, "downloaded_vcard", source);
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, event_type: "contact_save" }),
      }).catch(() => {});
    }

    // Show the "share your info back" lead-capture sheet (card owner's). If it
    // won't show, invite the visitor to make their OWN card instead (signup nudge).
    // Live check too — they may have shared via another form since mount.
    if (cardOwner && !alreadyShared && !hasSharedWith(cardOwner)) {
      setTimeout(() => setShowSheet(true), 900);
    } else {
      setTimeout(() => triggerSignupNudge("vcard"), 900);
    }
    } finally {
      setDownloading(false);
    }
  }

  async function shareBack(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !cardOwner) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/leads", {
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
      if (!res.ok) throw new Error("lead capture failed");
    } catch {
      // Don't mark as shared or advance the UI on a failed capture — the
      // visitor's info would otherwise be silently lost.
      setStatus("idle");
      return;
    }

    markSharedWith(cardOwner, form);
    setAlreadyShared(true);
    setStatus("done");
    // After they share back, close the sheet and invite them to make their own card.
    setTimeout(() => { setShowSheet(false); triggerSignupNudge("vcard"); }, 1500);
  }

  return (
    <>
      <button
        onClick={downloadVCard}
        className={`w-full text-white font-semibold py-3 px-6 rounded-full transition-colors text-sm flex items-center justify-center gap-2 ${saved ? "" : "active:bg-blue-800"}`}
        style={{ background: saved ? "#16a34a" : "#1D4ED8" }}
      >
        {saved ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
      {/* Small, unobtrusive pointer to the phone's confirm step */}
      {saved && (
        <p className="text-center text-[11px] mt-1.5" style={{ color: "#94a3b8" }}>
          Save — then tap &ldquo;Create New Contact&rdquo;
        </p>
      )}

      {/* Conversion bottom sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.target === e.currentTarget && closeSheet()}
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
                <p className="text-slate-900 font-bold text-base">Info shared!</p>
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
                    onClick={closeSheet}
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
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  />
                  <input
                    type="tel"
                    placeholder="Your phone *"
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
                    onClick={closeSheet}
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
