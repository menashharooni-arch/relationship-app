"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsNativeApp } from "@/lib/platform";
import NotificationBody from "@/components/NotificationBody";
import SeeWhoLink from "@/components/SeeWhoLink";
import { NATIVE_BODY_REMAP, NATIVE_HIDDEN_TYPES } from "@/lib/native-notification-copy";
import PushAskCallout, { usePushAsk } from "@/components/PushAskCallout";
import { pickAskCandidate } from "@/lib/push-ask";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  /** The known contact this row is about (warm-lead-alerts.sql). */
  lead_id?: string | null;
};

// Rows that NAME a contact the owner already knows (lib/contact-return-notify):
// they carry a "Wrong person?" so a misidentification is one tap to undo.
const NAMED_RETURN_TYPES = new Set(["contact_returned", "contact_engaged"]);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Notification types that are about a contact — clicking these rows opens the
// active card's contacts ("shared their info", "saved your contact", "viewed
// your card"). A view lands here too: when the viewer is someone we know, the
// row names them and the useful destination is that person's conversation, not
// a chart. When it is "Someone", the name match below finds nothing and the
// row opens the contacts list, which is still the right place to look.
// A reply too: "Dana replied" names the contact, and the conversation is the
// only useful place that row can lead.
const CONTACT_TYPES = new Set(["new_lead", "contact_saved", "card_viewed", "lead_reply", "contact_returned", "contact_engaged"]);

// Stamp the optimistic-op grace window. Lives at module scope so the React
// compiler doesn't treat the Date.now() call as render-time impurity — it only
// ever runs from event handlers.
function stampOp(ref: { current: number }) {
  ref.current = Date.now();
}

export default function NotificationsPanel({
  initial,
  card,
  leads = [],
}: {
  initial: Notification[];
  card?: string;
  leads?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isNative = useIsNativeApp();

  // A contact notification is about a lead — clicking it opens THAT contact on
  // the Contacts page. Notifications only store text, so match the lead by name
  // against the title/body (longest name wins, so "Ann" can't shadow "Ann Lee").
  // No match → the card's contacts list.
  //
  // A row that KNOWS its contact (lead_id, stamped by the server) opens them
  // directly — the name match is only for rows written before that existed.
  function openContactFor(n: Notification) {
    const hay = `${n.title} ${n.body ?? ""}`.toLowerCase();
    const match = n.lead_id
      ? { id: n.lead_id }
      : leads
          .filter((l) => l.name.trim() && hay.includes(l.name.trim().toLowerCase()))
          .sort((a, b) => b.name.length - a.name.length)[0];
    const base = card ? `/contacts?card=${encodeURIComponent(card)}` : "/contacts?";
    router.push(match ? `${base}${card ? "&" : ""}lead=${match.id}` : (card ? base : "/contacts"));
  }

  const [items, setItems] = useState<Notification[]>(initial);
  // The panel used to be a snapshot: rendered once from the server and never
  // updated, so a save that buzzed the phone didn't appear here until a full
  // reload, and rows marked read from the BELL kept their unread dot — which
  // read as notifications "coming back". Poll the same endpoint the bell
  // does, scoped to this card, and let server truth win.
  const lastOpRef = useRef(0);
  useEffect(() => {
    const poll = async () => {
      // Grace window: an optimistic local change (read/dismiss) may still be
      // in flight — polling over it would resurrect the old state for a beat.
      if (Date.now() - lastOpRef.current < 8000) return;
      // Nobody is looking: the visibility listener below polls on return.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/notifications${card ? `?card=${encodeURIComponent(card)}` : ""}`);
        if (!res.ok) return;
        const fresh: Notification[] = await res.json();
        setItems((prev) => {
          // Title too: an upgrade in place ("…and tapped your Calendly link")
          // keeps the id and the read flag, and must still show.
          const sig = (list: Notification[]) => list.map((n) => `${n.id}:${n.read ? 1 : 0}:${n.title}`).join(",");
          return sig(fresh) === sig(prev) ? prev : fresh;
        });
      } catch { /* ignore */ }
    };
    poll();
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Every 10s while the panel is on screen — "Priya just re-opened your
    // card" is worth seeing while it is still true. Hidden tabs skip (above).
    const id = setInterval(poll, 10000);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [card]);

  // "Wrong person?" — unbinds the browser(s) from this contact and removes the
  // alert (/api/leads/[id]/wrong-person). Optimistic, like dismiss.
  const [wrongAsked, setWrongAsked] = useState<string | null>(null);
  async function markWrongPerson(n: Notification) {
    if (!n.lead_id) return;
    stampOp(lastOpRef);
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setWrongAsked(null);
    await fetch(`/api/leads/${n.lead_id}/wrong-person`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: n.id }),
    }).catch(() => {});
  }

  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const unread = items.filter((n) => !n.read).length;
  const readCount = items.filter((n) => n.read).length;

  // Native app: drop the referral "claim your free month of Pro" promo
  // entirely (a selling incentive). Web shows every notification.
  const shown = items.filter((n) => !(isNative && n.type === "referral_claim") && !(isNative && NATIVE_HIDDEN_TYPES.has(n.type)));

  // "Get notifications like this on your phone" — under ONE row at most. Same
  // rules as the bell (lib/push-ask.ts), and never both at once: this list
  // outranks the bell, the dashboard's own box outranks both.
  const askId = pickAskCandidate(shown);
  const ask = usePushAsk("panel", askId, true);

  // "Tap here to get it" — the explicit claim for an earned referral month.
  async function claimReferral(id: string) {
    setClaiming(id);
    try {
      const res = await fetch("/api/referrals/claim", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setClaimResult((p) => ({ ...p, [id]: { ok: true, text: "Pro is active for the next month — enjoy!" } }));
        setRead(id, true);
        router.refresh(); // update the plan badge etc.
      } else {
        setClaimResult((p) => ({ ...p, [id]: { ok: false, text: d.error || "Couldn't claim — try again." } }));
      }
    } catch {
      setClaimResult((p) => ({ ...p, [id]: { ok: false, text: "Couldn't claim — try again." } }));
    }
    setClaiming(null);
  }

  async function setRead(id: string, read: boolean) {
    stampOp(lastOpRef);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    }).catch(() => {});
  }

  async function markAllRead() {
    lastOpRef.current = Date.now();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    // Scoped to THIS card (+ account-level rows) — the panel is per-card, so
    // bulk-reading here must never touch another card's notifications.
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card }),
    }).catch(() => {});
  }

  async function dismiss(id: string) {
    lastOpRef.current = Date.now();
    setItems((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function clearRead() {
    lastOpRef.current = Date.now();
    setItems((prev) => prev.filter((n) => !n.read));
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true, card }),
    }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-10 h-10 bg-gray-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <p className="font-semibold text-gray-300 text-sm mb-1">No notifications yet</p>
        <p className="text-gray-600 text-xs">New contacts, card saves, and activity show up here.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/40">
        <p className="text-xs text-gray-500">{unread} unread</p>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Mark all read
            </button>
          )}
          {readCount > 0 && (
            <button onClick={clearRead} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Clear read
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-800">
        {/* Native app: drop the referral "claim your free month of Pro" promo
            entirely (a selling incentive). Web shows every notification. */}
        {shown.map((n) => (
          <Fragment key={n.id}>
          <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? "" : "bg-blue-950/40"} ${n.id === askId && ask.show ? "border-b-0" : ""}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-700" : "bg-blue-500"}`} />
            <div
              className={`min-w-0 flex-1 ${CONTACT_TYPES.has(n.type) ? "cursor-pointer" : ""}`}
              onClick={CONTACT_TYPES.has(n.type) ? () => openContactFor(n) : undefined}
              role={CONTACT_TYPES.has(n.type) ? "button" : undefined}
            >
              {/* Through NotificationBody like the body: on a Free account a
                  returning contact's name arrives blocked out from the server
                  (lib/contact-privacy.ts) and is blurred here. */}
              <p className={`text-sm ${n.read ? "text-gray-300 font-medium" : "text-white font-semibold"} ${CONTACT_TYPES.has(n.type) ? "hover:text-blue-300 transition-colors" : ""}`}><NotificationBody text={n.title} /></p>
              {(() => {
                // Native-only: swap selling copy in stored bodies for a neutral
                // string. Web (isNative false, incl. server + first paint) shows
                // the stored body exactly as today.
                const displayBody = isNative && NATIVE_BODY_REMAP[n.type] ? NATIVE_BODY_REMAP[n.type] : n.body;
                // NotificationBody, not GateCopy directly: on a Free account the
                // place a view came from arrives already blocked out, and this
                // is what blurs it instead of printing ███ in the middle of a
                // sentence. Paid accounts render exactly as before.
                return displayBody && <p className="text-gray-400 text-xs mt-0.5 leading-relaxed"><NotificationBody text={displayBody} /></p>;
              })()}
              <SeeWhoLink text={`${n.title} ${n.body ?? ""}`} />
              {/* Referral month earned → the explicit tap-to-claim */}
              {n.type === "referral_claim" && (
                claimResult[n.id] ? (
                  <p className={`text-xs font-semibold mt-2 ${claimResult[n.id].ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {claimResult[n.id].text}
                  </p>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); claimReferral(n.id); }}
                    disabled={claiming === n.id}
                    className="mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                  >
                    {claiming === n.id ? "Activating…" : "Claim my free month of Pro"}
                  </button>
                )
              )}
              {NAMED_RETURN_TYPES.has(n.type) && n.lead_id && (
                wrongAsked === n.id ? (
                  <span className="flex items-center gap-2 mt-1.5 text-[0.6875rem]">
                    <span className="text-gray-400">Not them? We&apos;ll stop recognising that device.</span>
                    <button onClick={(e) => { e.stopPropagation(); markWrongPerson(n); }} className="font-semibold text-blue-400 hover:text-blue-300">Confirm</button>
                    <button onClick={(e) => { e.stopPropagation(); setWrongAsked(null); }} className="text-gray-500 hover:text-gray-300">Cancel</button>
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setWrongAsked(n.id); }}
                    className="mt-1.5 text-[0.6875rem] text-gray-500 hover:text-gray-300 underline underline-offset-2"
                  >
                    Wrong person?
                  </button>
                )
              )}
              {/* Clock-dependent text — a minute tick between SSR and hydration
                  makes the strings differ (React #418). Cosmetic, so suppress. */}
              <p suppressHydrationWarning className="text-gray-600 text-[0.6875rem] mt-1">{timeAgo(n.created_at)}</p>
            </div>
            <button
              onClick={() => setRead(n.id, !n.read)}
              title={n.read ? "Mark as unread" : "Mark as read"}
              aria-label={n.read ? "Mark as unread" : "Mark as read"}
              className={`shrink-0 text-[0.6875rem] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                n.read
                  ? "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
                  : "border-blue-700 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25"
              }`}
            >
              {n.read ? "Unread" : "Read"}
            </button>
            <button
              onClick={() => dismiss(n.id)}
              title="Dismiss"
              aria-label="Dismiss notification"
              className="shrink-0 p-1 text-gray-600 hover:text-gray-300 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* A SIBLING of the row, not inside it: the row's text is a button
              that opens the contact, and a tap on this switch must never
              also navigate away. */}
          {n.id === askId && <PushAskCallout ask={ask} tone="panel" />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
