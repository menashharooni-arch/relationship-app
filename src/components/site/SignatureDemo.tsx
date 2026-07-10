"use client";

import { useState } from "react";
import CardScaler from "@/components/CardScaler";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// Email Signature showcase: a wide, realistic email whose signature is the REAL
// SwiftCard — the PhotoFirst template rendered exactly as we ship it, with the
// person's photo. Clicking the signature pops up that same SwiftCard (identical
// card + the real card-page experience: save, share, links).

const CARD_DATA: CardData = withoutSocials({
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  initials: "AM",
  photoUrl: "/marketing/demo-girl.jpg",
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alex-morgan",
});
const FIRST = "Alex";

function SectionNum({ n }: { n: number }) {
  return <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ background: "#1D4ED8" }}>{n}</span>;
}
const PANEL = "w-full rounded-2xl p-4 shadow-sm";
const panelStyle = { background: "#fff", border: "1px solid #E4DDD4" } as const;

// The SwiftCard exactly as a recipient gets it — same card, plus the real
// card-page sections.
function SwiftCardPopup({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  return (
    <div className="fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(4,7,15,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-sm my-6 rounded-3xl overflow-hidden shadow-2xl" style={{ background: "#FAF7F2" }}>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/45 text-white flex items-center justify-center text-lg leading-none">✕</button>
        <div className="px-4 pt-4 pb-6 flex flex-col gap-4">
          {/* The SwiftCard — identical PhotoFirst card as the signature */}
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <CardScaler><PhotoFirst data={CARD_DATA} /></CardScaler>
          </div>

          {/* 1 — Save contact */}
          <div className={PANEL} style={panelStyle}>
            <div className="flex items-center gap-2.5 mb-2"><SectionNum n={1} /><p className="text-slate-900 font-semibold text-[13px]">Save {FIRST}&apos;s contact</p></div>
            <button onClick={() => setSaved(true)} className="w-full rounded-full py-2.5 text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-colors" style={{ background: saved ? "#16a34a" : "#2563EB" }}>
              {saved ? (<><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>Saved to Contacts</>) : (<><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>Save {FIRST}&apos;s contact</>)}
            </button>
          </div>

          {/* 2 — Share your info */}
          <div className={PANEL} style={panelStyle}>
            <div className="flex items-center gap-2.5 mb-2"><SectionNum n={2} /><p className="text-slate-900 font-semibold text-[13px]">Share your info with {FIRST}</p></div>
            {shared ? (
              <div className="py-3 text-center">
                <div className="w-10 h-10 mx-auto mb-1.5 rounded-full bg-green-100 flex items-center justify-center"><svg viewBox="0 0 24 24" className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                <p className="text-slate-900 font-bold text-[13px]">Info shared!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {["Full name", "Email address", "Phone number"].map((ph) => (<div key={ph} className="h-9 rounded-lg bg-white flex items-center px-3 text-[12px] text-slate-400" style={{ border: "1px solid #E4DDD4" }}>{ph}</div>))}
                <button onClick={() => setShared(true)} className="mt-1 w-full h-10 rounded-lg text-white text-[12.5px] font-bold flex items-center justify-center" style={{ background: "#2563EB" }}>Share my info →</button>
              </div>
            )}
          </div>

          {/* 3 — Swift Links */}
          <div className={PANEL} style={panelStyle}>
            <div className="flex items-center gap-2.5 mb-3"><SectionNum n={3} /><p className="text-slate-900 font-semibold text-[13px]">Swift Links</p></div>
            <div className="flex flex-col gap-2">
              {[["Website", "#1D4ED8"], ["LinkedIn", "#0A66C2"], ["Instagram", "#E1306C"], ["TikTok", "#010101"]].map(([label, color]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: `${color}12`, color, border: `1px solid ${color}22` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="flex-1">{label}</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 opacity-50"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                </div>
              ))}
            </div>
          </div>

          {/* 4 — Share this card */}
          <div className={PANEL} style={panelStyle}>
            <div className="flex items-center gap-2.5 mb-3"><SectionNum n={4} /><p className="text-slate-900 font-semibold text-[13px]">Share this card</p></div>
            <div className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-full text-white text-[12.5px]" style={{ background: "linear-gradient(to right, #2563eb, #7c3aed)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M7.2 10.9a2.25 2.25 0 100 2.2m0-2.2l9.6-5.3m-9.6 7.5l9.6 5.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Share this card
            </div>
            <div className="w-full flex items-center justify-center gap-2 font-semibold py-2.5 mt-2 rounded-full text-[12.5px]" style={{ background: "#FAF7F2", border: "1px solid #E4DDD4", color: "#475569" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
              Show QR Code
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignatureDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {/* Works everywhere */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5" data-reveal="fade">
        <span className="text-slate-500 text-[15px] font-medium">Works on all platforms —</span>
        {["Gmail", "Outlook", "Yahoo", "Hotmail", "Apple Mail"].map((p) => (
          <span key={p} className="rd-pill rd-pill-l text-[13px]">{p}</span>
        ))}
        <span className="text-slate-500 text-[15px] font-medium">all of it.</span>
      </div>

      {/* Click hint — on top of the email box */}
      <p className="text-center text-[15px] font-semibold mb-4 flex items-center justify-center gap-1.5" style={{ color: "#2563EB" }} data-reveal="fade">
        Click the signature and see what happens
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </p>

      {/* Wide email mockup */}
      <div className="rd-card-l overflow-hidden max-w-3xl mx-auto" data-reveal="scale">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-100 bg-slate-50">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[12px] text-slate-400 font-medium">New Message</span>
        </div>
        <div className="p-6 sm:p-8 text-slate-700">
          <div className="text-[13px] space-y-1.5 pb-3 border-b border-slate-100">
            <p><span className="text-slate-400">To:</span> sarah@acme.com</p>
            <p><span className="text-slate-400">Subject:</span> Great connecting today</p>
          </div>
          <div className="pt-5 text-[14.5px] leading-relaxed space-y-3">
            <p>Hi Sarah,</p>
            <p>Really enjoyed chatting earlier. My details are in my signature below — feel free to reach out anytime.</p>
            <p>Best,</p>
          </div>

          {/* signature */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-[14px] text-slate-900 mb-2"><strong>Alex Morgan</strong> <span className="text-slate-500">| Coastline Realty</span></p>
            <div className="relative w-[300px] max-w-full transition-transform hover:-translate-y-0.5">
              <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_-14px_rgba(8,10,18,0.4)]" style={{ pointerEvents: "none", background: "#FAF7F2" }}>
                <CardScaler><PhotoFirst data={CARD_DATA} /></CardScaler>
              </div>
              <button onClick={() => setOpen(true)} aria-label="Open Alex Morgan's SwiftCard" className="absolute inset-0 z-10 rounded-2xl cursor-pointer" />
            </div>
            <button onClick={() => setOpen(true)} className="inline-block mt-2 text-[14px] font-bold no-underline" style={{ color: "#2563eb" }}>Contact me →</button>
          </div>
        </div>
      </div>

      {open && <SwiftCardPopup onClose={() => setOpen(false)} />}
    </div>
  );
}
