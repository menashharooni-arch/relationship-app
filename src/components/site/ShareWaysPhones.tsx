"use client";

import { QRCodeSVG } from "qrcode.react";
import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// Three white-screen iPhones showing the ways to share a SwiftCard:
//   1) Apple Wallet — the real SwiftCard on top, credit cards tucked below
//   2) QR code — the EXACT "Show QR Code" modal from the live card (QRCodeSVG)
//   3) Share sheet — the iOS share button + full share sheet
// Everything is static/illustrative.

const CARD_DATA: CardData = withoutSocials({
  name: "Alex Morgan",
  title: "Founder & CEO",
  company: "Morgan & Co.",
  phone: "(555) 123-4567",
  email: "alex@morganandco.com",
  website: "www.morganandco.com",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
});
const CARD_URL = "https://swiftcard.me/card/alexmorgan";

const TUCKED = [
  { grad: "linear-gradient(120deg,#1a1a2e,#3a3a5c)", tail: "2084", network: "VISA" },
  { grad: "linear-gradient(120deg,#0f766e,#0e7490)", tail: "7731", network: "amex" },
  { grad: "linear-gradient(120deg,#c2410c,#ea580c)", tail: "0090", network: "MC" },
];

// iOS-style status bar (dark glyphs for a white screen).
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-2.5 pb-1 text-[11px] font-semibold text-slate-900">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="w-[15px] h-3" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4.5" width="3" height="7.5" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" /></svg>
        <svg viewBox="0 0 20 14" className="w-[17px] h-3.5" fill="currentColor"><path d="M10 3c2.5 0 4.8 1 6.5 2.6l1.4-1.5A11.5 11.5 0 0010 1 11.5 11.5 0 002.1 4.1l1.4 1.5A9.4 9.4 0 0110 3z" /><path d="M10 7c1.4 0 2.7.5 3.7 1.4l1.4-1.5A7.4 7.4 0 0010 5a7.4 7.4 0 00-5.1 1.9l1.4 1.5A5.4 5.4 0 0110 7z" /><circle cx="10" cy="11.5" r="1.6" /></svg>
        <svg viewBox="0 0 26 13" className="w-[22px] h-3" fill="none"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" /><rect x="23.5" y="4" width="2" height="5" rx="1" fill="currentColor" opacity="0.5" /></svg>
      </div>
    </div>
  );
}

function Phone({ label, labelClass, children }: { label: string; labelClass: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-3.5 snap-center">
      <div className="rd-phone w-[240px]">
        <div className="rd-phone-screen h-[500px]" style={{ background: "#FFFFFF" }}>
          <div className="rd-notch" style={{ width: 48, height: 18 }} />
          <div className="absolute inset-0 flex flex-col">{children}</div>
        </div>
      </div>
      <span className={`${labelClass} text-[13px] font-semibold`}>{label}</span>
    </div>
  );
}

// 1 — Apple Wallet
function WalletPhone() {
  return (
    <>
      <StatusBar />
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="text-slate-900 text-[26px] font-bold tracking-tight leading-none">Wallet</h3>
        <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </span>
      </div>
      {/* The real SwiftCard on top */}
      <div className="px-4 pt-4">
        <div className="rounded-[16px] overflow-hidden shadow-[0_12px_28px_-10px_rgba(15,23,42,0.45)] relative z-30" style={{ background: "#FAF7F2" }}>
          <CardScaler><ClassicPro data={CARD_DATA} /></CardScaler>
        </div>
      </div>

      <div className="flex-1" />

      {/* Credit cards tucked away at the bottom (Apple Wallet stacked look) */}
      <div className="px-4 pb-6 relative">
        {TUCKED.map((c, i) => (
          <div
            key={c.tail}
            className="rounded-[16px] shadow-[0_-4px_14px_-6px_rgba(0,0,0,0.35)]"
            style={{ background: c.grad, marginTop: i === 0 ? 0 : -42, height: 62, zIndex: 20 - i }}
          >
            {/* Only the top strip of each card shows; keep the label row inside it,
                digits right-aligned and tabular so they line up card to card. */}
            <div className="flex items-center justify-between px-4 h-[22px] pt-2">
              <span className="text-white/60 text-[11px] font-medium tabular-nums tracking-[0.12em] leading-none">•••• {c.tail}</span>
              <span className="text-white text-[11px] font-bold italic tracking-tight leading-none">{c.network}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// 2 — QR code — the exact "Show QR Code" modal from the live card
function QrPhone() {
  return (
    <>
      <StatusBar />
      <div className="flex-1 flex items-center justify-center px-4 pb-6">
        <div className="w-full max-w-[210px] rounded-3xl overflow-hidden flex flex-col items-center shadow-xl" style={{ background: "#0d1b3e" }}>
          <div className="w-full flex items-center justify-between px-5 pt-4 pb-1">
            <p className="text-white font-bold text-[15px] leading-tight">Scan to connect with Alex</p>
            <span className="text-slate-400 text-xl leading-none">×</span>
          </div>
          <div className="bg-white rounded-2xl p-4 mx-5 my-4 shadow-xl">
            <QRCodeSVG value={CARD_URL} size={150} bgColor="#ffffff" fgColor="#0d1b3e" level="M" />
          </div>
          <p className="text-[13px] font-medium pb-5 px-5 text-center" style={{ background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            swiftcard.me/card/alexmorgan
          </p>
        </div>
      </div>
    </>
  );
}

// 3 — iOS share sheet (share button + full sheet). Kept at a realistic scale so
// it reads like an actual screenshot rather than a zoomed-in mock.
function AppIcon({ bg, children, label }: { bg: string; children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-[46px]">
      <span className="w-[46px] h-[46px] rounded-[11px] flex items-center justify-center text-white shadow-sm" style={{ background: bg }}>{children}</span>
      <span className="text-slate-600 text-[8.5px] font-medium truncate w-full text-center">{label}</span>
    </div>
  );
}
function ContactBubble({ initials, name, color }: { initials: string; name: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-[46px]">
      <span className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white text-[14px] font-semibold shadow-sm" style={{ background: color }}>{initials}</span>
      <span className="text-slate-600 text-[8.5px] font-medium truncate w-full text-center">{name}</span>
    </div>
  );
}
function SharePhone() {
  const actions = ["Copy Link", "Add to Home Screen", "Save to Files"];
  return (
    <>
      <StatusBar />
      {/* the trigger button */}
      <div className="px-4 pt-3">
        <div className="rounded-full py-2.5 flex items-center justify-center gap-2 text-white text-[12px] font-bold shadow-md" style={{ background: "linear-gradient(to right,#2563eb,#7c3aed)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Share this card
        </div>
      </div>

      <div className="flex-1" />

      {/* the share sheet, slid up from the bottom */}
      <div className="rounded-t-[22px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] pt-2 pb-3" style={{ background: "#F2F2F7" }}>
        <div className="w-9 h-1 rounded-full bg-slate-300 mx-auto mb-2.5" />
        {/* preview row */}
        <div className="mx-2.5 mb-3 flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: "var(--rd-aurora)" }}>AM</span>
          <span className="min-w-0 flex-1">
            <span className="block text-slate-900 text-[11px] font-bold leading-tight truncate">Alex Morgan&apos;s SwiftCard</span>
            <span className="block text-slate-400 text-[9px] truncate">swiftcard.me/card/alexmorgan</span>
          </span>
          <span className="text-slate-400 text-[10px] font-medium shrink-0">Options ›</span>
        </div>
        {/* AirDrop / contacts row */}
        <div className="flex gap-2 px-2.5 mb-2.5 overflow-x-auto rd-scrollbar-none">
          <ContactBubble initials="JS" name="Jordan" color="#0A84FF" />
          <ContactBubble initials="PR" name="Priya" color="#FF375F" />
          <ContactBubble initials="MW" name="Marcus" color="#30D158" />
          <AppIcon bg="#1f2937" label="AirDrop"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 8a8 8 0 000 8M9.5 6a12 12 0 000 12M13 4.5a16 16 0 000 15" strokeLinecap="round" /></svg></AppIcon>
        </div>
        {/* app row */}
        <div className="flex gap-2 px-2.5 mb-1 overflow-x-auto rd-scrollbar-none">
          <AppIcon bg="linear-gradient(180deg,#3ee15a,#12bf3a)" label="Messages"><svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 3 5.6V21l3.6-2c1.1.3 2.2.4 3.4.4 5.5 0 10-3.6 10-8.4S17.5 3 12 3z" /></svg></AppIcon>
          <AppIcon bg="linear-gradient(180deg,#3cb0ff,#0a7cff)" label="Mail"><svg viewBox="0 0 24 24" className="w-[21px] h-[21px]" fill="currentColor"><path d="M4 5.5h16A1.5 1.5 0 0121.5 7v.3L12 13.4 2.5 7.3V7A1.5 1.5 0 014 5.5z" /><path d="M2.5 9.2l8.9 5.7c.37.24.86.24 1.23 0l8.87-5.7V17a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 17V9.2z" /></svg></AppIcon>
          <AppIcon bg="#25D366" label="WhatsApp"><svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="currentColor"><path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.3A10 10 0 1012 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2 1.3 2.3 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.5.3 0 .2 0 .8-.2 1.4z" /></svg></AppIcon>
          <AppIcon bg="#0A66C2" label="LinkedIn"><svg viewBox="0 0 24 24" className="w-[20px] h-[20px]" fill="currentColor"><path d="M6.94 8.5H4V20h2.94V8.5zM5.47 3.75A1.72 1.72 0 105.47 7.2a1.72 1.72 0 000-3.45zM20 20h-2.94v-5.6c0-1.33-.02-3.05-1.86-3.05-1.86 0-2.15 1.45-2.15 2.95V20H10.1V8.5h2.82v1.57h.04c.4-.75 1.36-1.54 2.8-1.54 3 0 3.55 1.97 3.55 4.53V20z" /></svg></AppIcon>
          <AppIcon bg="radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)" label="Instagram"><svg viewBox="0 0 24 24" className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" /></svg></AppIcon>
          <AppIcon bg="linear-gradient(180deg,#9aa0aa,#6b7280)" label="Copy"><svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></AppIcon>
        </div>
        {/* action list */}
        <div className="mx-2.5 mt-3 rounded-2xl bg-white overflow-hidden">
          {actions.map((label, i) => (
            <div key={label} className={`flex items-center justify-between px-3.5 py-2.5 ${i < actions.length - 1 ? "border-b border-slate-100" : ""}`}>
              <span className="text-slate-800 text-[11.5px] font-medium">{label}</span>
              <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 7h9v9M17 7L7 17" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ShareWaysPhones({ light = false }: { light?: boolean }) {
  const labelClass = light ? "text-slate-500" : "text-white/60";
  return (
    // snap-x: on a phone only ~1.4 of the three phones fit, so a free scroll
    // stops mid-phone and looks cut off. Snap centers one phone per swipe like
    // a deliberate carousel. Desktop fits all three, so snapping never engages.
    <div className="max-w-full flex gap-4 justify-start lg:justify-center overflow-x-auto snap-x snap-mandatory lg:snap-none rd-scrollbar-none pb-2 px-2">
      <Phone label="Apple Wallet" labelClass={labelClass}><WalletPhone /></Phone>
      <Phone label="QR code" labelClass={labelClass}><QrPhone /></Phone>
      <Phone label="Share sheet" labelClass={labelClass}><SharePhone /></Phone>
    </div>
  );
}
