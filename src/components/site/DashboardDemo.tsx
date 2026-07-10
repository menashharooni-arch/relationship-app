"use client";

import { useState } from "react";
import AnalyticsPanel from "./AnalyticsPanel";

// Interactive dashboard preview inside a browser chrome. Scrollable, with a
// clickable card switcher and view tabs — realistic product behavior, no data.

const CARDS = [
  { label: "Coastline Realty", user: "alexmorgan", accent: "#5D6BFF" },
  { label: "Personal", user: "alex", accent: "#22D3EE" },
  { label: "Speaking", user: "alex-talks", accent: "#F65B9E" },
];

export default function DashboardDemo() {
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<"traffic" | "contacts">("traffic");

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

      <div className="max-h-[520px] overflow-y-auto rd-scrollbar-none p-4 sm:p-5">
        {/* top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg" style={{ background: "var(--rd-aurora)" }} />
            <span className="text-white font-bold text-[14px]">SwiftCard</span>
            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">Pro</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[12px]">
            {["Dashboard", "Contacts", "Settings"].map((t, i) => (
              <span key={t} className={`px-2.5 py-1 rounded-lg ${i === 0 ? "bg-white/10 text-white" : "text-white/45"}`}>{t}</span>
            ))}
          </div>
        </div>

        {/* My Cards */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 mb-4">
          <p className="text-white font-semibold text-[13px] mb-3">My Cards</p>
          <div className="flex flex-wrap gap-2">
            {CARDS.map((c, i) => (
              <button
                key={c.user}
                onClick={() => setActive(i)}
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border transition-all"
                style={{ background: active === i ? "rgba(93,107,255,0.12)" : "rgba(255,255,255,0.03)", borderColor: active === i ? "rgba(93,107,255,0.4)" : "rgba(255,255,255,0.08)" }}
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: c.accent }}>{c.label[0]}</span>
                <span className="text-left">
                  <span className="block text-white text-[12.5px] font-medium leading-tight">{c.label}</span>
                  <span className="block text-white/40 text-[10.5px]">/{c.user}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* view tabs */}
        <div className="flex items-center gap-1 mb-3">
          {(["traffic", "contacts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg capitalize ${tab === t ? "bg-white/10 text-white" : "text-white/45"}`}>{t}</button>
          ))}
        </div>

        {tab === "traffic" ? (
          <AnalyticsPanel />
        ) : (
          <div className="rounded-[26px] border border-white/10 bg-[#0E1017] p-4 space-y-2">
            {[
              ["Sarah Chen", "sarah@acme.com", "Saved your contact", "2m"],
              ["Marcus Webb", "m.webb@northgate.co", "Shared their info", "18m"],
              ["Elena Diaz", "elena@brightpath.io", "Viewed your card", "1h"],
              ["Tom Farrell", "tom@farrell.dev", "Saved your contact", "3h"],
            ].map(([name, email, action, time]) => (
              <div key={name} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: "var(--rd-aurora)" }}>{(name as string).split(" ").map((w) => w[0]).join("")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-white text-[13px] font-semibold">{name}</span>
                  <span className="block text-white/40 text-[11px] truncate">{email} · {action}</span>
                </span>
                <span className="text-white/30 text-[11px] shrink-0">{time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
