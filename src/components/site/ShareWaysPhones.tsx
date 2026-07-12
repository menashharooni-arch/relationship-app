"use client";

import CardScaler from "@/components/CardScaler";
import ClassicPro from "@/components/card-templates/ClassicPro";
import { MiniQR } from "@/components/card-templates/types";
import { withoutSocials } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

// Three white-screen phones showing the ways to share a SwiftCard:
//   1) Apple Wallet — the real SwiftCard on top, credit cards tucked below
//   2) QR code — exactly as the portal's "Show QR Code" sharing option looks
//   3) Share sheet — the share button with the app dropdown

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
  { grad: "linear-gradient(120deg,#20263A,#39415F)", tail: "2084" },
  { grad: "linear-gradient(120deg,#16233F,#2C3A61)", tail: "7731" },
];

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-3">
      <div className="rd-phone w-[188px]">
        <div className="rd-phone-screen h-[380px]" style={{ background: "#FFFFFF" }}>
          <div className="rd-notch" style={{ width: 54, height: 15 }} />
          <div className="absolute inset-0 overflow-hidden">{children}</div>
        </div>
      </div>
      <span className="text-white/55 text-[12.5px] font-semibold">{label}</span>
    </div>
  );
}

// 1 — Apple Wallet
function WalletPhone() {
  return (
    <div className="absolute inset-0 px-3 pt-8 pb-3 flex flex-col" style={{ background: "#FFFFFF" }}>
      <p className="text-slate-900 text-[17px] font-bold tracking-tight mb-3">Wallet</p>
      {/* The real SwiftCard on top */}
      <div className="rounded-[14px] overflow-hidden shadow-md z-30" style={{ background: "#FAF7F2" }}>
        <CardScaler><ClassicPro data={CARD_DATA} /></CardScaler>
      </div>
      {/* Credit cards tucked below */}
      <div className="relative -mt-2">
        {TUCKED.map((c, i) => (
          <div key={c.tail} className="rounded-[14px] px-3 pt-2 shadow-lg" style={{ background: c.grad, marginTop: i === 0 ? 0 : -40, height: 54, zIndex: 20 - i }}>
            <div className="flex items-center justify-between">
              <span className="text-white/85 text-[10px] font-semibold">Card</span>
              <span className="text-white/50 text-[9px]">•••• {c.tail}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-auto text-center text-slate-400 text-[9px]">Illustrative cards — not real accounts</p>
    </div>
  );
}

// 2 — QR code (exactly how the portal's Show QR Code option looks)
function QrPhone() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-3 pt-8 pb-3" style={{ background: "#FFFFFF" }}>
      <div className="w-full rounded-3xl overflow-hidden flex flex-col items-center" style={{ background: "#0d1b3e" }}>
        <div className="w-full flex items-center justify-between px-4 pt-4 pb-1">
          <p className="text-white font-bold text-[12px]">Scan to connect with Alex</p>
          <span className="text-slate-400 text-lg leading-none">×</span>
        </div>
        <div className="bg-white rounded-2xl p-3 mx-4 my-3 shadow-xl">
          <MiniQR size={118} url={CARD_URL} fg="#0d1b3e" />
        </div>
        <p className="text-[11px] font-medium pb-4 px-4 text-center" style={{ background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          swiftcard.me/card/demo-realty
        </p>
      </div>
    </div>
  );
}

// 3 — Share button + app dropdown (iOS-style share sheet)
function AppIcon({ bg, children, label }: { bg: string; children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white shadow-sm" style={{ background: bg }}>{children}</span>
      <span className="text-slate-600 text-[9px] font-medium">{label}</span>
    </div>
  );
}
function SharePhone() {
  return (
    <div className="absolute inset-0 flex flex-col justify-end" style={{ background: "#FFFFFF" }}>
      {/* faint page behind the sheet */}
      <div className="absolute top-8 inset-x-0 px-4">
        <div className="rounded-full py-2.5 flex items-center justify-center gap-2 text-white text-[12px] font-bold" style={{ background: "linear-gradient(to right,#2563eb,#7c3aed)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M7.2 10.9a2.25 2.25 0 100 2.2m0-2.2l9.6-5.3m-9.6 7.5l9.6 5.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Share this card
        </div>
      </div>

      {/* share sheet */}
      <div className="relative rounded-t-[22px] shadow-[0_-10px_40px_rgba(0,0,0,0.18)] pb-4 pt-3" style={{ background: "#F2F2F7" }}>
        <div className="w-9 h-1 rounded-full bg-slate-300 mx-auto mb-3" />
        {/* card preview row */}
        <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold" style={{ background: "var(--rd-aurora)" }}>AM</span>
          <span className="min-w-0">
            <span className="block text-slate-900 text-[11px] font-bold leading-tight">Alex Morgan&apos;s SwiftCard</span>
            <span className="block text-slate-400 text-[9px] truncate">swiftcard.me/card/demo-realty</span>
          </span>
        </div>
        {/* app row */}
        <div className="flex gap-3 px-3 overflow-hidden">
          <AppIcon bg="#34C759" label="Messages"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.2 1.1 4.2 3 5.6V21l3.5-2c1.1.3 2.3.5 3.5.5 5.5 0 10-3.6 10-8s-4.5-8.5-10-8.5z" /></svg></AppIcon>
          <AppIcon bg="#0A84FF" label="Mail"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg></AppIcon>
          <AppIcon bg="#111827" label="AirDrop"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 8a8 8 0 000 8M9.5 6a12 12 0 000 12M13 4.5a16 16 0 000 15" strokeLinecap="round" /></svg></AppIcon>
          <AppIcon bg="#8E8E93" label="Copy"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M13.2 8.8a4.5 4.5 0 011.2 7.2l-2.5 2.5a4.5 4.5 0 01-6.4-6.4l1-1M10.8 15.2a4.5 4.5 0 01-1.2-7.2l2.5-2.5a4.5 4.5 0 016.4 6.4l-1 1" strokeLinecap="round" strokeLinejoin="round" /></svg></AppIcon>
        </div>
        {/* list rows */}
        <div className="mx-3 mt-3 rounded-2xl bg-white overflow-hidden">
          {[["Copy Link", "M13.2 8.8a4.5 4.5 0 011.2 7.2"], ["Add to Home Screen", "M12 5v14M5 12h14"]].map(([label], i) => (
            <div key={label} className={`flex items-center justify-between px-3.5 py-2.5 ${i === 0 ? "border-b border-slate-100" : ""}`}>
              <span className="text-slate-800 text-[11px] font-medium">{label}</span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
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
