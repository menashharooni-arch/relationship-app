"use client";

import { useState } from "react";
import SwiftCardVisual from "./SwiftCardVisual";

// Email Signature showcase: a realistic email with a LIVE SwiftCard signature.
// Click the signature → the panel reveals exactly what a recipient can do
// (open the card, save the contact, call/email/message, visit links).

const ACTIONS = [
  { label: "Open Alex's SwiftCard", icon: "card", desc: "The full digital card, instantly" },
  { label: "Save to Contacts", icon: "save", desc: "One tap — name, number, email, photo" },
  { label: "Call · Email · Message", icon: "reach", desc: "Reach out without typing a thing" },
  { label: "Visit listings & links", icon: "link", desc: "Every professional link in one place" },
];

function ActionIcon({ kind }: { kind: string }) {
  const common = "w-4 h-4";
  if (kind === "card") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9.5h18" /></svg>;
  if (kind === "save") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (kind === "reach") return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M3 5.5C3 4.7 3.7 4 4.5 4h2.6a1 1 0 01.95.68l1 3a1 1 0 01-.5 1.2l-1.3.65a12 12 0 005.5 5.5l.65-1.3a1 1 0 011.2-.5l3 1a1 1 0 01.68.95v2.6c0 .8-.7 1.5-1.5 1.5A16.5 16.5 0 013 5.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M13.2 8.8a4.5 4.5 0 011.2 7.2l-2.5 2.5a4.5 4.5 0 01-6.4-6.4l1-1M10.8 15.2a4.5 4.5 0 01-1.2-7.2l2.5-2.5a4.5 4.5 0 016.4 6.4l-1 1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function SignatureDemo() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
      {/* Email client */}
      <div className="rd-card-l overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100 bg-slate-50">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[12px] text-slate-400 font-medium">New Message</span>
        </div>
        <div className="p-5 text-slate-700">
          <div className="text-[13px] space-y-1.5 pb-3 border-b border-slate-100">
            <p><span className="text-slate-400">To:</span> sarah@acme.com</p>
            <p><span className="text-slate-400">Subject:</span> Great connecting today</p>
          </div>
          <div className="pt-4 text-[14px] leading-relaxed space-y-3">
            <p>Hi Sarah,</p>
            <p>Really enjoyed chatting earlier. My details are in my signature below — feel free to reach out anytime.</p>
            <p>Best,</p>
          </div>
          {/* signature */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[14px] font-bold text-slate-900 mb-2">Alex Morgan <span className="font-normal text-slate-500">| Coastline Realty</span></p>
            <button
              onClick={() => setClicked(true)}
              className="group relative block w-[280px] max-w-full text-left transition-transform hover:-translate-y-0.5"
              aria-label="Open Alex Morgan's SwiftCard"
            >
              <SwiftCardVisual className="!rounded-2xl" />
              {/* clickable hint */}
              <span className="absolute -top-2 -right-2 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-lg" style={{ background: "var(--rd-aurora)" }}>Clickable ↗</span>
            </button>
            <p className="mt-2 text-[13px] font-semibold" style={{ color: "#5D6BFF" }}>Contact me →</p>
          </div>
        </div>
      </div>

      {/* What happens when they click */}
      <div className="rd-card-l p-6 sm:p-7 flex flex-col relative overflow-hidden" style={{ background: clicked ? "#0E1017" : "#fff" }}>
        <div className="rd-glow rd-glow-violet" style={{ width: 300, height: 300, right: "-20%", top: "-20%", opacity: clicked ? 0.5 : 0 }} />
        {!clicked ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(93,107,255,0.1)" }}>
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="#5D6BFF" strokeWidth={1.7}><path d="M9 11l3 3 8-8M4 12a8 8 0 108-8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-slate-900 font-bold text-[17px]">Click the signature</p>
            <p className="text-slate-500 text-[14px] mt-1 max-w-[280px]">Every email you send becomes a live advertisement for you. Here&apos;s what recipients can do in one tap.</p>
          </div>
        ) : (
          <div className="relative">
            <p className="rd-eyebrow" style={{ color: "#8B96FF" }}>Your signature, working for you</p>
            <p className="text-white font-bold text-[20px] mt-2 rd-h2">One click. Every way to reach you.</p>
            <div className="mt-5 space-y-2.5">
              {ACTIONS.map((a) => (
                <div key={a.label} className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: "var(--rd-aurora)" }}><ActionIcon kind={a.icon} /></span>
                  <span className="min-w-0">
                    <span className="block text-white text-[14px] font-semibold">{a.label}</span>
                    <span className="block text-white/50 text-[12.5px]">{a.desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setClicked(false)} className="mt-5 text-white/50 hover:text-white text-[13px] font-medium transition-colors">↺ Reset demo</button>
          </div>
        )}
      </div>
    </div>
  );
}
