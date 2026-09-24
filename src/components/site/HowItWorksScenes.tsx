import PhoneFrame from "@/components/PhoneFrame";
import { WalletScreen, ShareSheetScreen } from "@/components/site/ShareWaysPhones";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import { SAMPLE_DATA, DEMO_HEADSHOT } from "@/components/card-templates/types";

// The three "How it works" pictures on the homepage. Each one copies a real
// screen rather than inventing one:
//   1. Share  — the two REAL screens from "Ways to share": the card as an
//               Apple Wallet pass, and the iOS share sheet mid-share. Both are
//               imported from ShareWaysPhones, so this step and that section
//               can never drift apart.
//   2. Save   — what "Save Contact" opens on an iPhone: the contact sheet with
//               the photo, name, title, and the details from the card.
//   3. Lead   — the real notification copy ("New contact: {name}" /
//               "{name} shared their info with you from your QR code.") and the
//               contact's Email automation card ("On · Medium · auto-sending
//               emails", ContactsClient).
// Purely presentational; everything is aria-hidden by the caller.

// The two phones in the Share step are the REAL screens from the "Ways to
// share" section (owner, 2026-09-17): the actual Apple Wallet pass on one and
// the actual iOS share sheet on the other, not drawings of them. Both are
// built for a 240px phone, so each is rendered at that size and scaled into
// this smaller stage — every detail survives, nothing is redrawn.
const STEP_PHONE_W = 240;
const STEP_SCALE = 0.5;

function StepPhone({ children, tilt = 0 }: { children: React.ReactNode; tilt?: number }) {
  return (
    <div style={{ width: STEP_PHONE_W * STEP_SCALE, height: 516 * STEP_SCALE }}>
      {/* The inner box must carry the phone's FULL width: without it the box
          inherits the scaled (half) width, the phone lays out inside 120px and
          the share sheet's rows wrap before the scale is even applied. */}
      <div className="origin-top-left" style={{ transform: `scale(${STEP_SCALE})`, width: STEP_PHONE_W }}>
        <PhoneFrame width={STEP_PHONE_W} statusBar={false} glare={false} tilt={tilt} screenStyle={{ height: 500, background: "#FFFFFF" }}>
          <div className="absolute inset-0 flex flex-col">{children}</div>
        </PhoneFrame>
      </div>
    </div>
  );
}

export function ShareScene() {
  return (
    <>
      {/* Rings pulse out from the QR on your screen. */}
      {[0, 1, 2].map((k) => <span key={k} className="hp-pulse" style={{ left: "33%", top: "48%", width: 70, height: 70, margin: "-35px 0 0 -35px" }} />)}
      {/* Left phone: your card in Apple Wallet — the real pass face. */}
      <div className="absolute top-2 left-[32%] -translate-x-1/2">
        <StepPhone tilt={-4}><WalletScreen /></StepPhone>
      </div>
      {/* Right phone: the iOS share sheet, mid-share. */}
      <div className="absolute top-6 left-[70%] -translate-x-1/2">
        <StepPhone tilt={6}><ShareSheetScreen /></StepPhone>
      </div>
    </>
  );
}

const ACTIONS = [
  { l: "message", d: "M4 5h16v11H8l-4 4z" },
  { l: "call", d: "M6.6 3.5l3 3-2 2.2a12 12 0 006.7 6.7l2.2-2 3 3-2.2 2.3C10.5 18.7 5.3 13.5 4.3 6z" },
  { l: "video", d: "M3 7h12v10H3zM15 11l6-4v10l-6-4" },
  { l: "mail", d: "M3 6h18v12H3zM3 7l9 6 9-6" },
];

export function SaveScene() {
  return (
    <>
    <div className="absolute top-5 left-1/2 -translate-x-1/2">
      <PhoneFrame width={176} glare={false}>
        <div className="bg-[#F2F2F7] pb-16">
          <div className="flex items-center justify-between px-3 pt-1 text-[7px]">
            <span className="text-[#007AFF]">Cancel</span>
            <span className="text-[#007AFF] font-semibold">Done</span>
          </div>
          <div className="flex flex-col items-center pt-2">
            <div className="relative">
              {/* Lazy: an eager <img> in a server component becomes a preload
                  hint in the homepage's RSC payload, so every page that
                  prefetched "/" (any logo link) downloaded this 119KB photo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEMO_HEADSHOT} alt="" loading="lazy" decoding="async" className="w-[52px] h-[52px] rounded-full object-cover" />
              <span className="hp-pop hp-pop-2 absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#34C759] grid place-items-center ring-2 ring-[#F2F2F7]">
                <svg viewBox="0 0 20 20" className="w-2.5 h-2.5 text-white" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
              </span>
            </div>
            <p className="text-[11px] font-semibold text-black mt-1.5">{SAMPLE_DATA.name}</p>
            <p className="text-[7px] text-[#6b6b70]">{SAMPLE_DATA.title} · {SAMPLE_DATA.company}</p>
          </div>
          <div className="grid grid-cols-4 gap-1 px-2.5 mt-2.5">
            {ACTIONS.map((a) => (
              <div key={a.l} className="bg-white rounded-[6px] py-1.5 flex flex-col items-center gap-0.5">
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="#007AFF"><path d={a.d} /></svg>
                <span className="text-[5.5px] text-[#007AFF]">{a.l}</span>
              </div>
            ))}
          </div>
          <div className="mx-2.5 mt-2 bg-white rounded-[7px] divide-y divide-[#e5e5ea]">
            <div className="px-2 py-1.5"><p className="text-[5.5px] text-black">mobile</p><p className="text-[7.5px] text-[#007AFF]">{SAMPLE_DATA.phone}</p></div>
            <div className="px-2 py-1.5"><p className="text-[5.5px] text-black">email</p><p className="text-[7.5px] text-[#007AFF] truncate">{SAMPLE_DATA.email}</p></div>
            <div className="px-2 py-1.5"><p className="text-[5.5px] text-black">homepage</p><p className="text-[7.5px] text-[#007AFF] truncate">{SAMPLE_DATA.cardUrl}</p></div>
          </div>
        </div>
      </PhoneFrame>
    </div>
      {/* The confirmation, over the sheet */}
      <div className="hp-pop hp-pop-2 absolute left-1/2 -translate-x-1/2 bottom-5 flex items-center gap-1.5 rounded-full bg-[#1c1c1e]/90 px-3 py-1.5 shadow-xl whitespace-nowrap">
        <svg viewBox="0 0 20 20" className="w-3 h-3 text-[#34C759]" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
        <span className="text-white text-[0.68rem] font-semibold">Added to Contacts</span>
      </div>
    </>
  );
}

export function LeadScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 px-5">
      {/* Lock-screen notification */}
      <div className="hp-pop rounded-[18px] bg-white/85 backdrop-blur px-3 py-2.5 shadow-[0_14px_34px_-14px_rgba(11,16,34,.35)] ring-1 ring-black/5">
        <div className="flex items-start gap-2.5">
          <span className="shrink-0 mt-0.5"><SwiftCardIcon size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] font-semibold text-slate-900 truncate">New contact: Sarah Chen</p>
              <span className="text-[0.62rem] text-slate-400 shrink-0">now</span>
            </div>
            <p className="text-[0.68rem] text-slate-600 leading-snug">Sarah Chen shared their info with you from your QR code.</p>
          </div>
        </div>
      </div>
      {/* The contact's follow-up automation, switched on */}
      <div className="hp-pop hp-pop-2 rounded-[14px] bg-white px-3 py-2.5 ring-1 ring-blue-500/25 shadow-[0_14px_34px_-18px_rgba(37,99,235,.45)]">
        <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Follow-up Automations</p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.74rem] font-semibold text-slate-900">Email automation</p>
            <p className="text-[0.64rem] text-slate-500">On · Medium · auto-sending emails</p>
          </div>
          <span className="relative w-8 h-[18px] rounded-full bg-blue-600 shrink-0" aria-hidden="true">
            <span className="absolute top-[2px] right-[2px] w-[14px] h-[14px] rounded-full bg-white shadow" />
          </span>
        </div>
        <p className="mt-1.5 text-[0.6rem] text-slate-400">3 touches · tomorrow 10:06 AM, 2 weeks 1:22 PM, 4 weeks 11:45 AM</p>
      </div>
    </div>
  );
}
