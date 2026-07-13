"use client";

import { useState } from "react";
import SwiftCardVisual from "./SwiftCardVisual";
import { DEMO_LINK_SOCIALS } from "./demo-data";

// Interactive phone demo. Two variants share one scrollable phone frame:
//   "card" — how a SwiftCard looks the moment someone opens it (save contact +
//            share-your-info flow), all local state, NEVER hits analytics.
//   "link" — how a SwiftLink profile looks (bio, socials, link buttons).
// Everything is fake/local so demo interactions can never count as real traffic.

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-slate-800">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="w-4 h-3" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4" width="3" height="8" rx="1" /><rect x="10" y="1" width="3" height="11" rx="1" opacity="0.4" /></svg>
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 13a10 10 0 0114 0l-1.5 1.5a8 8 0 00-11 0zm-3-3a14 14 0 0120 0l-1.5 1.5a12 12 0 00-17 0z" /></svg>
        <svg viewBox="0 0 26 13" className="w-6 h-3.5" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="22" height="12" rx="3" /><rect x="2" y="2" width="17" height="9" rx="1.5" fill="currentColor" /><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" /></svg>
      </div>
    </div>
  );
}

function CardExperience() {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  return (
    <div className="px-4 pt-2 pb-8" style={{ background: "#FAF7F2" }}>
      <div className="mx-auto max-w-[300px]">
        <SwiftCardVisual className="!shadow-[0_20px_40px_-24px_rgba(8,10,18,0.4)]" />

        {/* Save + share row */}
        <button
          onClick={() => setSaved(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-full py-3 text-white text-[13px] font-bold transition-colors"
          style={{ background: saved ? "#16a34a" : "#5D6BFF" }}
        >
          {saved ? (
            <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>Saved to Contacts</>
          ) : (
            <><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>Save Alex&apos;s contact</>
          )}
        </button>

        {/* Connect row */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[["LinkedIn", "#0A66C2"], ["Instagram", "#E1306C"], ["Website", "#5D6BFF"]].map(([label, color]) => (
            <div key={label} className="h-9 rounded-xl flex items-center justify-center text-[11px] font-bold" style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}>{label}</div>
          ))}
        </div>

        {/* Share your info */}
        <div className="mt-3 rounded-2xl p-3.5" style={{ background: "#EDE5D8", border: "1px solid #D4C8B8" }}>
          {shared ? (
            <div className="py-4 text-center">
              <div className="w-11 h-11 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p className="text-slate-900 font-bold text-[14px]">Info shared!</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">Share your info with Alex</p>
              <div className="space-y-1.5">
                {["Full name", "Email address", "Phone number"].map((ph) => (
                  <div key={ph} className="h-9 rounded-lg bg-white border border-[#D4C8B8] flex items-center px-3 text-[12px] text-slate-400">{ph}</div>
                ))}
                <button onClick={() => setShared(true)} className="mt-1 w-full h-10 rounded-lg text-white text-[12.5px] font-bold flex items-center justify-center gap-1" style={{ background: "#5D6BFF" }}>Share my info →</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkExperience() {
  const [tapped, setTapped] = useState<string | null>(null);
  return (
    <div className="pb-8 min-h-full" style={{ background: "linear-gradient(180deg,#0E1017,#181D28)" }}>
      {/* cover + avatar */}
      <div className="relative h-[110px]" style={{ background: "linear-gradient(120deg,#7A5CFF,#22D3EE)" }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(120% 120% at 30% -30%, rgba(255,255,255,0.5), transparent 55%)" }} />
      </div>
      <div className="px-5 -mt-10">
        <div className="w-[80px] h-[80px] rounded-full border-[3px] border-[#0E1017] overflow-hidden bg-slate-800 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/headshot.jpg" alt="Alex Morgan" className="w-full h-full object-cover" />
        </div>
        <p className="mt-3 text-white text-[19px] font-extrabold tracking-tight">Alex Morgan</p>
        <p className="text-white/50 text-[13px]">Founder & Principal · Coastline Realty</p>
        <p className="mt-2.5 text-white/70 text-[13px] leading-relaxed">Helping people find the right home on the coast for 12 years. Book a viewing below</p>

        {/* socials */}
        <div className="mt-4 flex gap-2">
          {DEMO_LINK_SOCIALS.map((s) => (
            <button key={s.label} onClick={() => setTapped(s.label)} className="flex-1 h-10 rounded-xl border border-white/12 bg-white/[0.05] flex items-center justify-center transition-colors hover:bg-white/[0.1]" style={{ color: s.color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            </button>
          ))}
        </div>

        {/* link buttons */}
        <div className="mt-3 space-y-2.5">
          {[["Book a viewing", "#5D6BFF"], ["See current listings", "#22D3EE"], ["Watch neighborhood tour", "#7A5CFF"]].map(([label, color]) => (
            <button
              key={label}
              onClick={() => setTapped(label as string)}
              className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98]"
              style={{ background: tapped === label ? `${color}22` : "rgba(255,255,255,0.05)", borderColor: tapped === label ? `${color}66` : "rgba(255,255,255,0.1)" }}
            >
              <span className="text-white text-[14px] font-semibold">{label}</span>
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-white/40" fill="currentColor"><path fillRule="evenodd" d="M5.2 14.8a1 1 0 010-1.4L11.6 7H6a1 1 0 010-2h8a1 1 0 011 1v8a1 1 0 01-2 0V8.4l-6.4 6.4a1 1 0 01-1.4 0z" clipRule="evenodd" /></svg>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-white/30 text-[11px]">
          <span className="w-3 h-3 rounded-full" style={{ background: "var(--rd-aurora)" }} />
          Powered by SwiftCard
        </div>
      </div>
    </div>
  );
}

export default function PhoneShowcase({ variant = "card", className = "" }: { variant?: "card" | "link"; className?: string }) {
  return (
    <div className={`rd-phone w-[300px] ${className}`} aria-hidden={false}>
      <div className="rd-phone-screen h-[600px]" style={{ background: variant === "link" ? "#0E1017" : "#FAF7F2" }}>
        <div className="rd-notch" />
        <div className="absolute inset-0 overflow-y-auto rd-scrollbar-none">
          <StatusBar />
          {variant === "card" ? <CardExperience /> : <LinkExperience />}
        </div>
        {/* glass sheen */}
        <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 26%)" }} />
      </div>
    </div>
  );
}
