"use client";

import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { MiniQR } from "@/components/card-templates/types";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// Three white-screen iPhones showing the ways to share a SwiftCard:
//   1) Apple Wallet — the real SwiftCard on top, credit cards tucked below
//   2) QR code — exactly as the portal's "Show QR Code" sharing option looks
//   3) Share sheet — the iOS share button + app dropdown
// Everything is static/illustrative.

const CARD_DATA: CardData = withoutSocials({
  name: "Alex Morgan",
  title: "Realtor",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/demo-realty",
});
const CARD_URL = "https://swiftcard.me/card/demo-realty";

const TUCKED = [
  { grad: "linear-gradient(120deg,#1f2937,#374151)", tail: "2084" },
  { grad: "linear-gradient(120deg,#155e63,#0e7490)", tail: "7731" },
  { grad: "linear-gradient(120deg,#3b2f63,#5b21b6)", tail: "0090" },
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

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-3.5">
      <div className="rd-phone w-[212px]">
        <div className="rd-phone-screen h-[440px]" style={{ background: "#FFFFFF" }}>
          <div className="rd-notch" style={{ width: 60, height: 17 }} />
          <div className="absolute inset-0 flex flex-col">{children}</div>
        </div>
      </div>
      <span className="text-white/60 text-[13px] font-semibold">{label}</span>
    </div>
  );
}

// 1 — Apple Wallet
function WalletPhone() {
  return (
    <>
      <StatusBar />
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="text-slate-900 text-[24px] font-bold tracking-tight leading-none">Wallet</h3>
        <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
        </span>
      </div>
      {/* The real SwiftCard on top */}
      <div className="px-3.5 pt-4">
        <div className="rounded-[16px] overflow-hidden shadow-[0_12px_28px_-10px_rgba(15,23,42,0.45)] relative z-30" style={{ background: "#FAF7F2" }}>
          <CardScaler><ClassicPro data={CARD_DATA} /></CardScaler>
        </div>
      </div>

      <div className="flex-1" />

      {/* Credit cards tucked away at the bottom (Apple Wallet stacked look) */}
      <div className="px-3.5 pb-5 relative">
        {TUCKED.map((c, i) => (
          <div
            key={c.tail}
            className="rounded-[16px] px-4 pt-3 shadow-[0_-4px_14px_-6px_rgba(0,0,0,0.35)]"
            style={{ background: c.grad, marginTop: i === 0 ? 0 : -46, height: 66, zIndex: 20 - i }}
          >
            <div className="flex items-center justify-between">
              <span className="text-white/90 text-[11px] font-semibold tracking-wide">Card</span>
              <span className="text-white/55 text-[10px]">•••• {c.tail}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// 2 — QR code (exactly how the portal's "Show QR Code" option looks)
function QrPhone() {
  return (
    <>
      <StatusBar />
      <div className="flex-1 flex items-center justify-center px-3.5 pb-4">
        <div className="w-full rounded-[26px] overflow-hidden flex flex-col items-center shadow-xl" style={{ background: "#0d1b3e" }}>
          <div className="w-full flex items-center justify-between px-4 pt-4 pb-1">
            <p className="text-white font-bold text-[13px]">Scan to connect with Alex</p>
            <span className="text-slate-400 text-xl leading-none">×</span>
          </div>
          <div className="bg-white rounded-2xl p-3.5 mx-4 my-4 shadow-xl">
            <MiniQR size={140} url={CARD_URL} fg="#0d1b3e" />
          </div>
          <p className="text-[12px] font-medium pb-5 px-4 text-center" style={{ background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            swiftcard.me/card/demo-realty
          </p>
        </div>
      </div>
    </>
  );
}

// 3 — iOS share sheet (share button + app dropdown)
function AppIcon({ bg, children, label }: { bg: string; children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 w-[52px]">
      <span className="w-[52px] h-[52px] rounded-[13px] flex items-center justify-center text-white shadow-sm" style={{ background: bg }}>{children}</span>
      <span className="text-slate-600 text-[9px] font-medium truncate w-full text-center">{label}</span>
    </div>
  );
}
function SharePhone() {
  return (
    <>
      <StatusBar />
      {/* the trigger button */}
      <div className="px-4 pt-3">
        <div className="rounded-full py-3 flex items-center justify-center gap-2 text-white text-[13px] font-bold shadow-md" style={{ background: "linear-gradient(to right,#2563eb,#7c3aed)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M12 3v13M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Share this card
        </div>
      </div>

      <div className="flex-1" />

      {/* the share sheet, slid up from the bottom */}
      <div className="rounded-t-[22px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] pt-2.5 pb-4" style={{ background: "#F2F2F7" }}>
        <div className="w-9 h-1 rounded-full bg-slate-300 mx-auto mb-3" />
        {/* preview row */}
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[12px] font-bold" style={{ background: "var(--rd-aurora)" }}>AM</span>
          <span className="min-w-0 flex-1">
            <span className="block text-slate-900 text-[12px] font-bold leading-tight truncate">Alex Morgan&apos;s SwiftCard</span>
            <span className="block text-slate-400 text-[10px] truncate">swiftcard.me/card/demo-realty</span>
          </span>
          <span className="text-slate-400 text-[11px] font-medium">Options ›</span>
        </div>
        {/* app row */}
        <div className="flex gap-2.5 px-3 overflow-x-auto rd-scrollbar-none">
          <AppIcon bg="#34C759" label="Messages"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 3 5.6V21l3.6-2c1.1.3 2.2.4 3.4.4 5.5 0 10-3.6 10-8.4S17.5 3 12 3z" /></svg></AppIcon>
          <AppIcon bg="#0A84FF" label="Mail"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7l8.5 6 8.5-6" /></svg></AppIcon>
          <AppIcon bg="#1f2937" label="AirDrop"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 8a8 8 0 000 8M9.5 6a12 12 0 000 12M13 4.5a16 16 0 000 15" strokeLinecap="round" /></svg></AppIcon>
          <AppIcon bg="#5b21b6" label="Notes"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 4h10a2 2 0 012 2v9l-5 5H7a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M14 20v-4a1 1 0 011-1h4" /></svg></AppIcon>
          <AppIcon bg="#8E8E93" label="Copy"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></AppIcon>
        </div>
        {/* action list */}
        <div className="mx-3 mt-4 rounded-2xl bg-white overflow-hidden">
          {[["Copy Link", "M8 12h8"], ["Add to Home Screen", "M12 8v8M8 12h8"]].map(([label], i) => (
            <div key={label} className={`flex items-center justify-between px-4 py-3 ${i === 0 ? "border-b border-slate-100" : ""}`}>
              <span className="text-slate-800 text-[12px] font-medium">{label}</span>
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

export default function ShareWaysPhones() {
  return (
    <div className="flex gap-4 justify-start lg:justify-center overflow-x-auto rd-scrollbar-none pb-2 -mx-2 px-2">
      <Phone label="Apple Wallet"><WalletPhone /></Phone>
      <Phone label="QR code"><QrPhone /></Phone>
      <Phone label="Share sheet"><SharePhone /></Phone>
    </div>
  );
}
