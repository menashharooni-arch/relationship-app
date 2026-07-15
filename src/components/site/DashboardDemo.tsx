"use client";

import { useState } from "react";

// Marketing-site replica of the real Pro /dashboard, inside a browser chrome.
// Mirrors the real page's structure and styling exactly:
//   • Traffic box full-width on top (Today / Week / Month / Locations)
//   • Quick Contacts (Notifications / Contacts toggle) on the left
//   • "Your Card" preview + Share panel on the right
// Purely presentational — all data is fictional; nothing is fetched.

// ── Traffic data per range ───────────────────────────────────────────────────
const TRAFFIC = {
  today: { label: "Today", card: "86", link: "41", pct: 12, period: "today", bars: [24, 18, 32, 28, 44, 38, 56, 48, 70, 62, 84, 100] },
  week: { label: "Week", card: "1,284", link: "742", pct: 23, period: "this week", bars: [38, 52, 44, 68, 58, 82, 100] },
  month: { label: "Month", card: "5,190", link: "3,020", pct: 31, period: "this month", bars: [30, 24, 38, 32, 46, 40, 34, 52, 44, 58, 50, 64, 56, 48, 70, 62, 76, 66, 58, 82, 72, 88, 78, 68, 92, 82, 96, 86, 90, 100] },
} as const;
type Range = keyof typeof TRAFFIC;

const LOCATIONS = [
  { location: "San Francisco, US", card: 142, link: 88 },
  { location: "New York, US", card: 96, link: 54 },
  { location: "Austin, US", card: 61, link: 40 },
  { location: "London, UK", card: 38, link: 29 },
];

// ── Quick Contacts data ──────────────────────────────────────────────────────
const TOTAL_LEADS = 12;

const LEADS = [
  { id: "l1", name: "Sarah Chen", company: "Acme Realty", phone: true, email: true },
  { id: "l2", name: "Marcus Webb", company: "Northgate Co.", phone: true, email: true },
  { id: "l3", name: "Elena Diaz", company: "Brightpath Studio", phone: false, email: true },
  { id: "l4", name: "Tom Farrell", company: "Farrell Development", phone: true, email: true },
  { id: "l5", name: "Jordan Kim", company: "Kimco Partners", phone: true, email: false },
];

const NOTIFICATIONS = [
  { id: "n1", title: "Sarah Chen shared their info with you", body: "Loved the listing on Cole St — can we set up a viewing this weekend?", ago: "2h ago", read: false },
  { id: "n2", title: "Someone saved your contact", body: "Your card was saved from your QR code.", ago: "6h ago", read: false },
  { id: "n3", title: "Marcus Webb shared their info with you", body: "Interested in the downtown condos — what's coming up?", ago: "1d ago", read: false },
  { id: "n4", title: "Weekly traffic report", body: "Your card was viewed 1,284 times this week — up 23%.", ago: "2d ago", read: true },
  { id: "n5", title: "Tom Farrell shared their info with you", body: "Following up on the office space downtown — is it still available?", ago: "3d ago", read: true },
];

// ── Traffic box — matches the real dashboard's Traffic section ───────────────
function TrafficBox() {
  const [range, setRange] = useState<Range | "locations">("week");
  const d = range === "locations" ? null : TRAFFIC[range];

  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Traffic</p>
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
          {([
            { id: "today", label: "Today" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
            { id: "locations", label: "Locations" },
          ] as const).map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${range === r.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {d ? (
        <div>
          {/* Stat tiles — side by side */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "SwiftCard views", value: d.card, accent: "#818cf8" },
              { label: "Swift Link views", value: d.link, accent: "#22d3ee" },
            ].map((m) => (
              <div key={m.label} className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-3.5 min-w-0">
                <p className="text-gray-400 text-xs font-medium truncate">{m.label}</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-0.5">{m.value}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: m.accent }}>
                  ▲ {d.pct}% {d.period}
                </p>
              </div>
            ))}
          </div>

          {/* Bar graph — newest bucket highlighted */}
          <div className="flex items-end gap-1 h-20 mt-4" aria-hidden="true">
            {d.bars.map((v, i) => {
              const last = i === d.bars.length - 1;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-md min-w-0"
                  style={{
                    height: `${Math.max(6, v)}%`,
                    background: last ? "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)" : "#343e6b",
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {LOCATIONS.map((loc) => (
            <div key={loc.location} className="bg-gray-800/40 border border-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-gray-100 text-sm font-semibold truncate">{loc.location}</p>
                <p className="text-white text-sm font-bold tabular-nums shrink-0">{loc.card + loc.link} <span className="text-gray-500 font-medium text-[11px]">views</span></p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-gray-500">SwiftCard <span className="text-gray-200 font-semibold tabular-nums">{loc.card}</span></span>
                <span className="text-gray-500">Swift Links <span className="text-gray-200 font-semibold tabular-nums">{loc.link}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Basic stats footer */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-800/70 text-[11px]">
        <span className="text-gray-500">Contacts <span className="text-gray-200 font-semibold tabular-nums">{TOTAL_LEADS}</span></span>
        <span className="text-gray-500">Best day <span className="text-gray-200 font-semibold">Jul 8</span> · 302</span>
      </div>
    </div>
  );
}

// ── Contact row action button — mirrors QuickContactList's ActionButton ──────
function ActionButton({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="flex items-center justify-center w-9 h-9 rounded-full border transition-colors shrink-0"
      style={{ borderColor: `${color}40`, background: `${color}14`, color }}
    >
      {children}
    </span>
  );
}

// ── Contacts view — mirrors QuickContactList rows ────────────────────────────
function ContactsView() {
  return (
    <div className="space-y-2">
      {LEADS.map((l) => (
        <div key={l.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800/80 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700/60 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
              {l.name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{l.name}</p>
              <p className="text-gray-500 text-[11px] truncate">{l.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {l.phone && (
              <ActionButton label={`Call ${l.name}`} color="#22c55e">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </ActionButton>
            )}
            {l.phone && (
              <ActionButton label={`Text ${l.name}`} color="#3b82f6">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </ActionButton>
            )}
            {l.email && (
              <ActionButton label={`Email ${l.name}`} color="#a78bfa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
                </svg>
              </ActionButton>
            )}
          </div>
        </div>
      ))}
      <span className="block w-full text-center text-xs font-semibold text-gray-400 border border-gray-800 rounded-full py-2.5">
        Show more ({TOTAL_LEADS - LEADS.length} more)
      </span>
    </div>
  );
}

// ── Notifications view — mirrors NotificationsPanel ──────────────────────────
function NotificationsView() {
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;
  return (
    <div className="border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/40">
        <p className="text-xs text-gray-500">{unread} unread</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-400">Mark all read</span>
          <span className="text-xs text-gray-500">Clear read</span>
        </div>
      </div>
      <div className="divide-y divide-gray-800">
        {NOTIFICATIONS.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? "" : "bg-blue-950/40"}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-gray-700" : "bg-blue-500"}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${n.read ? "text-gray-300 font-medium" : "text-white font-semibold"}`}>{n.title}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>
              <p className="text-gray-600 text-[11px] mt-1">{n.ago}</p>
            </div>
            <span
              className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border ${
                n.read ? "border-gray-700 text-gray-500" : "border-blue-700 bg-blue-600/15 text-blue-300"
              }`}
            >
              {n.read ? "Unread" : "Read"}
            </span>
            <span className="shrink-0 p-1 text-gray-600" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quick Contacts section — mirrors the real dashboard's left column ────────
function QuickContactsSection() {
  const [view, setView] = useState<"notifications" | "list">("notifications");
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-white font-semibold text-sm">Quick Contacts</h3>
          <span className="text-white font-bold text-lg tabular-nums">{TOTAL_LEADS}</span>
          <span className="text-gray-500 text-[11px] font-medium">Total leads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add
          </span>
          <span className="text-xs text-gray-500 border border-gray-800 px-3 py-1.5 rounded-lg">Export</span>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center bg-gray-800/80 rounded-lg p-0.5">
          {([
            { id: "notifications", label: "Notifications" },
            { id: "list", label: "Contacts" },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${view === v.id ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">View all in Contacts →</span>
      </div>

      {view === "notifications" ? <NotificationsView /> : <ContactsView />}
    </div>
  );
}

// ── Right column — Your Card preview + Share panel ───────────────────────────
function CardSharePanel() {
  return (
    <div className="flex flex-col gap-4">
      {/* Your card */}
      <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Your Card</p>
          <span className="text-xs text-blue-400 font-medium">Edit</span>
        </div>
        <p className="text-gray-600 text-[11px] mb-3 leading-relaxed">Exactly what people get when you share.</p>

        {/* Static mock card preview */}
        <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
          <div className="h-16" style={{ background: "var(--rd-aurora)" }} />
          <div className="px-4 pb-4 -mt-6">
            <div className="w-12 h-12 rounded-full bg-gray-800 border-2 border-gray-950 flex items-center justify-center text-sm font-bold text-white mb-2">
              AR
            </div>
            <p className="text-white text-sm font-bold">Alex Rivera</p>
            <p className="text-gray-500 text-[11px]">Realtor · Bay Area Homes</p>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 text-gray-600 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" /></svg>
                alex@bayareahomes.com
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 text-gray-600 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                (415) 555-0134
              </div>
            </div>
            <div className="mt-3 rounded-full bg-blue-600 text-white text-[11px] font-semibold text-center py-2">
              Save contact
            </div>
          </div>
        </div>
      </div>

      {/* Share */}
      <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 space-y-2">
        <span
          className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-full text-sm text-white"
          style={{ background: "linear-gradient(to right, #2563eb, #7c3aed)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </span>
        <span className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-300 bg-gray-800 border border-gray-700 rounded-full py-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
          Other ways to share
        </span>
      </div>
    </div>
  );
}

export default function DashboardDemo() {
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
        {/* Traffic — full width, like the real /dashboard */}
        <TrafficBox />

        {/* Main: contacts + card panel (real page: lg:grid-cols-[1fr_300px]) */}
        <div className="grid grid-cols-[1fr_260px] gap-5">
          <QuickContactsSection />
          <CardSharePanel />
        </div>
      </div>
    </div>
  );
}
