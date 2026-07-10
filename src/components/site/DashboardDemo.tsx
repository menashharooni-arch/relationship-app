"use client";

import { useState } from "react";
import { getSourceLabel } from "@/lib/source-labels";

// Interactive dashboard preview inside a browser chrome — a dark 2×2 board:
//   • Traffic (Today/Week/Month, interchangeable)   top-left
//   • Top locations                                  top-right
//   • Contacts (clickable)                           bottom-left
//   • Activity & Messages for the selected contact   bottom-right
// The conversation panel is a faithful copy of the real portal's contact
// conversation (ContactsClient) — same layout, bubbles, and labels. All data is
// fictional; nothing is fetched.

// ── Conversation helpers, mirrored from the real ContactsClient ──────────────
const EVENT_ICONS: Record<string, string> = { viewed_card: "👁", downloaded_vcard: "💾", shared_info: "✅" };
const ACTIVITY_PHRASES: Record<string, string> = {
  viewed_card: "viewed your card",
  downloaded_vcard: "saved your contact",
  shared_info: "shared their info with you",
};
function formatShort(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Ev = { id: string; event_type: string; source: string | null; created_at: string };
type Msg = { id: string; direction: "in" | "out"; channel: string | null; body: string; status: string | null; created_at: string };
type Contact = {
  id: string; name: string; email: string; initials: string; source: string;
  created_at: string; message?: string; status: "new_contact" | "touch";
  last: string; time: string; events: Ev[]; messages: Msg[];
};

const STATUS_STYLES: Record<string, string> = {
  new_contact: "bg-gray-800 text-gray-400",
  touch: "bg-blue-950 text-blue-400",
};
const STATUS_LABEL: Record<string, string> = { new_contact: "New", touch: "In touch" };

const CONTACTS: Contact[] = [
  {
    id: "c1", name: "Sarah Chen", email: "sarah@acme.com", initials: "SC", source: "email_signature",
    created_at: "2026-07-08T14:12:00", status: "touch", last: "Replied · 1d ago", time: "1d",
    message: "Loved the listing on Cole St — can we set up a viewing this weekend?",
    events: [
      { id: "e1", event_type: "viewed_card", source: "email_signature", created_at: "2026-07-08T14:10:00" },
      { id: "e2", event_type: "downloaded_vcard", source: "email_signature", created_at: "2026-07-08T14:12:00" },
    ],
    messages: [
      { id: "m1", direction: "out", channel: "email", body: "Hi Sarah — great connecting today! Here's my card again so my details are handy. Happy to line up a viewing whenever works for you.", status: "sent", created_at: "2026-07-08T14:16:00" },
      { id: "m2", direction: "in", channel: null, body: "Sounds great — Saturday morning works for me.", status: null, created_at: "2026-07-09T09:34:00" },
      { id: "m3", direction: "out", channel: "sms", body: "Perfect. I'll text you the address Saturday AM. Talk soon!", status: "sent", created_at: "2026-07-09T09:41:00" },
    ],
  },
  {
    id: "c2", name: "Marcus Webb", email: "m.webb@northgate.co", initials: "MW", source: "direct_link",
    created_at: "2026-07-09T16:40:00", status: "new_contact", last: "Shared their info · 18h ago", time: "18h",
    message: "Interested in the downtown condos — what's coming up?",
    events: [
      { id: "e3", event_type: "viewed_card", source: "direct_link", created_at: "2026-07-09T16:38:00" },
    ],
    messages: [
      { id: "m4", direction: "out", channel: "email", body: "Hi Marcus — thanks for reaching out! I'll pull a few downtown condo options together and send them over this week.", status: "sent", created_at: "2026-07-09T16:45:00" },
    ],
  },
  {
    id: "c3", name: "Elena Diaz", email: "elena@brightpath.io", initials: "ED", source: "swift_links",
    created_at: "2026-07-10T11:02:00", status: "new_contact", last: "Viewed your card · 2h ago", time: "2h",
    events: [
      { id: "e4", event_type: "viewed_card", source: "swift_links", created_at: "2026-07-10T11:02:00" },
    ],
    messages: [],
  },
];

// ── Traffic data per range ───────────────────────────────────────────────────
const TRAFFIC = {
  Today: { card: "86", link: "41", delta: "▲ 12% vs yesterday", bars: [18, 26, 20, 34, 28, 42, 36, 50, 44, 58, 52, 70, 64, 82] },
  Week: { card: "1,284", link: "742", delta: "▲ 23% this week", bars: [30, 42, 38, 55, 47, 68, 60, 74, 66, 88, 79, 96, 84, 100] },
  Month: { card: "5,190", link: "3,020", delta: "▲ 31% this month", bars: [40, 34, 52, 46, 62, 54, 72, 64, 84, 74, 92, 82, 96, 100] },
} as const;
type Range = keyof typeof TRAFFIC;

const LOCATIONS = [
  { city: "San Francisco, US", card: 142, link: 88 },
  { city: "New York, US", card: 96, link: 54 },
  { city: "Austin, US", card: 61, link: 40 },
  { city: "London, UK", card: 38, link: 29 },
];

const PANEL = "rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5";

function TrafficPanel() {
  const [range, setRange] = useState<Range>("Week");
  const d = TRAFFIC[range];
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-[15px]">Traffic</p>
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.05] p-0.5">
          {(Object.keys(TRAFFIC) as Range[]).map((t) => (
            <button key={t} onClick={() => setRange(t)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${range === t ? "bg-blue-600 text-white" : "text-white/45 hover:text-white/70"}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[["SwiftCard views", d.card, "#5D6BFF"], ["Swift Link views", d.link, "#22D3EE"]].map(([label, val, c]) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-white/[0.02] p-3.5">
            <p className="text-white/45 text-[11px]">{label}</p>
            <p className="text-white text-[26px] font-bold tabular-nums mt-0.5">{val}</p>
            <p className="text-[11px] font-semibold mt-0.5" style={{ color: c as string }}>{d.delta}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-[5px] h-[92px]">
        {d.bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[3px] transition-all duration-300" style={{ height: `${h}%`, background: i === d.bars.length - 1 ? "var(--rd-aurora)" : "rgba(93,107,255,0.35)" }} />
        ))}
      </div>
    </div>
  );
}

function LocationsPanel() {
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-[15px]">Locations</p>
        <span className="text-white/40 text-[11px]">Card · Link</span>
      </div>
      <div className="space-y-3.5">
        {LOCATIONS.map((l) => (
          <div key={l.city}>
            <div className="flex items-center justify-between text-[12.5px] mb-1.5">
              <span className="text-white/80">📍 {l.city}</span>
              <span className="text-white/40 tabular-nums">{l.card + l.link}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden flex">
              <div style={{ width: `${(l.card / 230) * 100}%`, background: "#5D6BFF" }} />
              <div style={{ width: `${(l.link / 230) * 100}%`, background: "#22D3EE" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsPanel({ contacts, selectedId, onSelect }: { contacts: Contact[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-[15px]">Contacts</p>
        <span className="text-white/40 text-[11px]">{contacts.length} people</span>
      </div>
      <div className="space-y-2">
        {contacts.map((c) => {
          const on = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all text-left"
              style={{ background: on ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.02)", borderColor: on ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.06)" }}
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: "var(--rd-aurora)" }}>{c.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-white text-[13px] font-semibold truncate">{c.name}</span>
                <span className="block text-white/40 text-[11px] truncate">{c.last}</span>
              </span>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Faithful copy of the real portal's contact conversation (Activity & Messages).
function ConversationPanel({ selected }: { selected: Contact }) {
  const fname = selected.name.split(" ")[0] || "They";
  const items: { at: string; key: string; kind: "event" | "in" | "out"; icon?: string; text?: string; source?: string | null; body?: string; channel?: string | null; status?: string | null }[] = [];
  for (const ev of selected.events) {
    items.push({ at: ev.created_at, key: `ev-${ev.id}`, kind: "event", icon: EVENT_ICONS[ev.event_type] ?? "·", text: `${fname} ${ACTIVITY_PHRASES[ev.event_type] ?? ev.event_type.replace(/_/g, " ")}`, source: ev.source });
  }
  items.push({ at: selected.created_at, key: "shared", kind: "event", icon: "✅", text: `${fname} shared their info with you`, source: selected.source });
  if (selected.message) items.push({ at: selected.created_at, key: "note", kind: "in", body: selected.message });
  for (const m of selected.messages) {
    items.push(m.direction === "in"
      ? { at: m.created_at, key: `m-${m.id}`, kind: "in", body: m.body }
      : { at: m.created_at, key: `m-${m.id}`, kind: "out", body: m.body, channel: m.channel, status: m.status });
  }
  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Activity &amp; Messages</p>
        <span className="text-[10px] text-gray-600">Auto-tracked · read-only</span>
      </div>
      <div className="space-y-3 overflow-y-auto rd-scrollbar-none" style={{ maxHeight: 320 }}>
        {items.map((it) => {
          if (it.kind === "out") {
            const isSms = it.channel === "sms";
            return (
              <div key={it.key} className="flex flex-col items-end">
                <div className={`max-w-[85%] text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${isSms ? "bg-emerald-600" : "bg-blue-600"}`}>{it.body}</div>
                <span className="text-gray-600 text-[10px] mt-1 pr-1 flex items-center gap-1.5">
                  <span className={`px-1.5 py-px rounded font-semibold ${isSms ? "bg-emerald-900/50 text-emerald-300" : "bg-blue-900/50 text-blue-300"}`}>{isSms ? "💬 Text" : "✉ Email"}</span>
                  <span>{it.status === "not_configured" ? "Not sent" : it.status === "failed" ? "Failed" : "Sent"} · {formatShort(it.at)}</span>
                </span>
              </div>
            );
          }
          if (it.kind === "in") {
            return (
              <div key={it.key} className="flex flex-col items-start">
                <div className="max-w-[85%] bg-gray-800 text-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">{it.body}</div>
                <span className="text-gray-600 text-[10px] mt-1 pl-1">{formatShort(it.at)}</span>
              </div>
            );
          }
          return (
            <div key={it.key} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs shrink-0">{it.icon}</div>
              <p className="text-gray-300 text-[13px]">{it.text}</p>
              {it.source && it.source !== "direct_link" && (
                <span className="text-[10px] text-blue-400">via {getSourceLabel(it.source)}</span>
              )}
              <span className="text-gray-600 text-[11px] ml-auto shrink-0">{formatShort(it.at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardDemo() {
  const [selectedId, setSelectedId] = useState(CONTACTS[0].id);
  const selected = CONTACTS.find((c) => c.id === selectedId) ?? CONTACTS[0];

  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0A0B10] shadow-2xl overflow-hidden">
      {/* browser chrome */}
      <div className="flex items-center gap-2 px-4 h-11 border-b border-white/8 bg-[#0E1017]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 max-w-[280px] h-6 rounded-md bg-white/[0.05] flex items-center px-3 gap-1.5">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
          <span className="text-white/40 text-[11px]">swiftcard.me/dashboard</span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid lg:grid-cols-2 gap-4">
          <TrafficPanel />
          <LocationsPanel />
          <ContactsPanel contacts={CONTACTS} selectedId={selectedId} onSelect={setSelectedId} />
          <ConversationPanel selected={selected} />
        </div>
      </div>
    </div>
  );
}
