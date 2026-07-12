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
type Status = "new_contact" | "touch" | "dissolved";
type Contact = {
  id: string; name: string; email: string; initials: string; source: string;
  created_at: string; message?: string; status: Status;
  last: string; time: string; events: Ev[]; messages: Msg[];
};

const STATUS_STYLES: Record<string, string> = {
  new_contact: "bg-gray-800 text-gray-400",
  touch: "bg-blue-950 text-blue-400",
  dissolved: "bg-gray-900 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = { new_contact: "New", touch: "In touch", dissolved: "Dissolved" };

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
  {
    id: "c4", name: "Tom Farrell", email: "tom@farrell.dev", initials: "TF", source: "qr_code",
    created_at: "2026-07-07T10:20:00", status: "touch", last: "Emailed · 3d ago", time: "3d",
    message: "Following up on the office space downtown — is it still available?",
    events: [
      { id: "e5", event_type: "viewed_card", source: "qr_code", created_at: "2026-07-07T10:18:00" },
      { id: "e6", event_type: "downloaded_vcard", source: "qr_code", created_at: "2026-07-07T10:20:00" },
    ],
    messages: [
      { id: "m5", direction: "out", channel: "email", body: "Hi Tom — great meeting you at the expo! I'll send over a few options for the downtown space this week.", status: "sent", created_at: "2026-07-07T10:25:00" },
    ],
  },
  {
    id: "c5", name: "Jordan Kim", email: "jordan@kimco.io", initials: "JK", source: "direct_link",
    created_at: "2026-07-10T08:30:00", status: "new_contact", last: "Shared their info · 6h ago", time: "6h",
    message: "Would love to chat about a partnership.",
    events: [
      { id: "e7", event_type: "viewed_card", source: "direct_link", created_at: "2026-07-10T08:28:00" },
    ],
    messages: [],
  },
  {
    id: "c6", name: "Priya Shah", email: "priya@northlight.studio", initials: "PS", source: "nfc_tap",
    created_at: "2026-06-28T15:00:00", status: "dissolved", last: "Viewed · 2w ago", time: "2w",
    events: [
      { id: "e8", event_type: "viewed_card", source: "nfc_tap", created_at: "2026-06-28T15:00:00" },
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

// ── Contacts box — a faithful copy of the real dashboard's Contacts section ──
// Same header (count + "Total leads"), the same Notifications / List / Pipeline
// view toggle, the same status + date filters, and the same three views:
// a list of leads, a drag-style pipeline kanban, and a notifications feed.
// Clicking any contact drives the Activity & Messages panel to its right.
type View = "notifications" | "list" | "pipeline";
const VIEW_TABS: { id: View; label: string }[] = [
  { id: "notifications", label: "Notifications" },
  { id: "list", label: "List" },
  { id: "pipeline", label: "Pipeline" },
];
const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "new_contact", label: "New Contact" },
  { id: "touch", label: "Touch" },
  { id: "dissolved", label: "Dissolved" },
];
const DATE_TABS = ["All", "30d", "7d", "Today"];
const PIPE_COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "new_contact", label: "New Contact", color: "#94a3b8" },
  { id: "touch", label: "Touch", color: "#60a5fa" },
  { id: "dissolved", label: "Dissolved", color: "#6b7280" },
];

function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return <span className="rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: "var(--rd-aurora)", width: size, height: size, fontSize: size >= 36 ? 12 : 10 }}>{initials}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-gray-800 py-8 text-center text-gray-600 text-[12px]">{label}</div>;
}

function ListView({ contacts, selectedId, onSelect }: { contacts: Contact[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-950/50 border border-gray-800 px-3 py-2">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>
        <span className="text-gray-500 text-[11px]">Search contacts…</span>
      </div>
      {contacts.length === 0 ? <EmptyState label="No contacts match this filter" /> : (
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
                <Avatar initials={c.initials} />
                <span className="min-w-0 flex-1">
                  <span className="block text-white text-[13px] font-semibold truncate">{c.name}</span>
                  <span className="block text-blue-400 text-[11px] truncate">{c.email}</span>
                </span>
                <span className="shrink-0 text-white/25 text-[10px]">{c.time}</span>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PipelineView({ contacts, selectedId, onSelect }: { contacts: Contact[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto rd-scrollbar-none pb-1">
      {PIPE_COLUMNS.map((col) => {
        const cards = contacts.filter((c) => c.status === col.id);
        return (
          <div key={col.id} className="w-[150px] shrink-0 rounded-2xl bg-gray-950/40 border border-gray-800 p-2">
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-white/80 text-[11px] font-semibold">{col.label}</span>
              <span className="ml-auto text-white/30 text-[10px]">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 py-5 text-center text-gray-600 text-[10px]">Drop here</div>
              ) : cards.map((c) => {
                const on = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="w-full text-left rounded-xl p-2.5 border transition-all cursor-grab"
                    style={{ background: on ? "rgba(37,99,235,0.12)" : "#111827", borderColor: on ? "rgba(37,99,235,0.5)" : "#1f2937" }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar initials={c.initials} size={7} />
                      <span className="text-white text-[12px] font-semibold truncate">{c.name}</span>
                    </div>
                    <p className="text-blue-400 text-[10px] mt-1.5 truncate">{c.email}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotificationsView({ contacts, onSelect }: { contacts: Contact[]; onSelect: (id: string) => void }) {
  const feed = [...contacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (feed.length === 0) return <EmptyState label="No notifications" />;
  return (
    <div className="space-y-2">
      {feed.map((c, i) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border border-gray-800 bg-gray-950/40 hover:bg-gray-800/50 text-left transition-colors"
        >
          <span className="relative shrink-0">
            <Avatar initials={c.initials} />
            {i < 2 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-gray-900" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-white text-[13px] font-semibold truncate">{c.name}</span>
            <span className="block text-white/40 text-[11px] truncate">{c.last}</span>
          </span>
          {c.source && c.source !== "direct_link" && <span className="shrink-0 text-[10px] text-blue-400">via {getSourceLabel(c.source)}</span>}
        </button>
      ))}
    </div>
  );
}

function ContactsPanel({ contacts, selectedId, onSelect }: { contacts: Contact[]; selectedId: string; onSelect: (id: string) => void }) {
  const [view, setView] = useState<View>("list");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("All");
  const shown = status === "all" ? contacts : contacts.filter((c) => c.status === status);

  return (
    <div className={PANEL}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="text-white font-semibold text-[15px]">Contacts</p>
          <span className="text-white font-bold text-[15px] tabular-nums">{contacts.length}</span>
          <span className="text-white/35 text-[11px]">Total leads</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1.5">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add
          </span>
          <span className="rounded-lg border border-gray-700 text-gray-300 text-[11px] font-medium px-2.5 py-1.5">Export</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
          {VIEW_TABS.map((t) => (
            <button key={t.id} onClick={() => setView(t.id)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${view === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}>{t.label}</button>
          ))}
        </div>
        {STATUS_TABS.map((t) => (
          <button key={t.id} onClick={() => setStatus(t.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${status === t.id ? "bg-blue-600 text-white" : "bg-gray-800/60 text-gray-400 hover:text-gray-200"}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center bg-gray-800/50 rounded-lg p-0.5">
          {DATE_TABS.map((d) => (
            <button key={d} onClick={() => setDate(d)} className={`px-2 py-1 rounded-md text-[10.5px] font-medium transition-colors ${date === d ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "notifications" ? (
        <NotificationsView contacts={shown} onSelect={onSelect} />
      ) : view === "pipeline" ? (
        <PipelineView contacts={shown} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <ListView contacts={shown} selectedId={selectedId} onSelect={onSelect} />
      )}
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
