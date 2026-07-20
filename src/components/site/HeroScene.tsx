"use client";

import { useRef } from "react";
import { MiniQR } from "@/components/card-templates/MiniQR";

// Flagship hero scene — recreates a "two phones tapping" moment entirely from
// our own components (no third-party photography):
//   • BOTTOM phone (dark): Apple Wallet with a SwiftCard pass on top and a few
//     clearly-fictional credit cards tucked underneath.
//   • TOP-RIGHT phone: the page someone lands on when they open a SwiftCard link
//     — profile, Save-contact, and quick links.
// The whole stage tilts toward the cursor in real 3D. Everything is static/local
// so it never touches analytics.

// Clearly illustrative — no real card brands or numbers.
const CARDS = [
  { grad: "linear-gradient(120deg,#20263A,#39415F)", tail: "2084" },
  { grad: "linear-gradient(120deg,#16233F,#2C3A61)", tail: "7731" },
  { grad: "linear-gradient(120deg,#2A2036,#4A3A63)", tail: "0090" },
];

function WalletPhone() {
  return (
    <div className="rd-phone w-full">
      <div className="rd-phone-screen h-[430px]" style={{ background: "#05060A" }}>
        <div className="rd-notch" style={{ width: 60, height: 17 }} />
        <div className="absolute inset-0 px-3.5 pt-9 pb-3.5 flex flex-col">
          <p className="text-white text-[16px] font-bold tracking-tight mb-3">Wallet</p>

          {/* SwiftCard pass — on top */}
          <div className="relative rounded-[18px] overflow-hidden shadow-2xl z-30" style={{ background: "var(--rd-aurora)" }}>
            <div className="absolute inset-0 opacity-25" style={{ background: "radial-gradient(120% 100% at 20% -10%, rgba(255,255,255,0.6), transparent 55%)" }} />
            <div className="relative p-3">
              <div className="flex items-center justify-between">
                <span className="text-white/90 text-[9px] font-bold tracking-[0.18em] uppercase">SwiftCard</span>
                <span className="text-white/80 text-[9px] font-semibold">Morgan & Co.</span>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-white text-[14px] font-extrabold leading-tight">Alex Morgan</p>
                  <p className="text-white/80 text-[9.5px]">Founder &amp; CEO</p>
                </div>
                <div className="rounded-md bg-white p-1">
                  <MiniQR size={34} url="https://swiftcard.me/card/alexmorgan" fg="#0B1022" />
                </div>
              </div>
            </div>
          </div>

          {/* Fictional cards tucked underneath (peeking top edges) */}
          <div className="relative -mt-2">
            {CARDS.map((c, i) => (
              <div
                key={c.tail}
                className="rounded-[18px] px-3 pt-2 shadow-xl border border-white/5"
                style={{ background: c.grad, marginTop: i === 0 ? 0 : -44, height: 58, zIndex: 20 - i }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white/85 text-[10px] font-semibold">Card</span>
                  <span className="text-white/45 text-[9px]">•••• {c.tail}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-center gap-1.5 text-white/35 text-[9px]">
            Illustrative cards — not real accounts
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkPhone() {
  return (
    <div className="rd-phone w-full">
      <div className="rd-phone-screen h-[430px]" style={{ background: "#FCFAF4" }}>
        <div className="rd-notch" style={{ width: 60, height: 17 }} />
        <div className="absolute inset-0 overflow-hidden">
          {/* cover */}
          <div className="h-[74px]" style={{ background: "var(--rd-aurora)" }}>
            <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(120% 120% at 30% -30%, rgba(255,255,255,0.5), transparent 55%)" }} />
          </div>

          <div className="px-3.5 -mt-8 relative">
            <div className="w-[54px] h-[54px] rounded-full border-[3px] border-white shadow-md flex items-center justify-center text-white text-[16px] font-black" style={{ background: "linear-gradient(135deg,#2563EB,#4DA8F5)" }}>
              AM
            </div>
            <p className="mt-2 text-slate-900 text-[15px] font-extrabold tracking-tight leading-tight">Alex Morgan</p>
            <p className="text-slate-500 text-[10.5px]">Founder &amp; CEO · Morgan & Co.</p>

            {/* Save contact */}
            <button className="mt-3 w-full rounded-full py-2.5 text-white text-[12px] font-bold flex items-center justify-center gap-1.5" style={{ background: "#2563EB" }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21v-8H5v8M5 3h11l3 3v3M9 3v4h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Save Alex&apos;s contact
            </button>

            {/* connect row */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[["in", "#0A66C2"], ["IG", "#E1306C"], ["Web", "#2563EB"]].map(([label, color]) => (
                <div key={label} className="h-8 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: `${color}14`, color, border: `1px solid ${color}33` }}>{label}</div>
              ))}
            </div>

            {/* link buttons */}
            <div className="mt-2.5 space-y-1.5">
              {["Book a viewing", "See current listings"].map((label) => (
                <div key={label} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 border" style={{ background: "#fff", borderColor: "rgba(18,26,58,0.10)" }}>
                  <span className="text-slate-800 text-[12px] font-semibold">{label}</span>
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-slate-400" fill="currentColor"><path fillRule="evenodd" d="M5.2 14.8a1 1 0 010-1.4L11.6 7H6a1 1 0 010-2h8a1 1 0 011 1v8a1 1 0 01-2 0V8.4l-6.4 6.4a1 1 0 01-1.4 0z" clipRule="evenodd" /></svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroScene() {
  const stage = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 9;
    el.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg)`;
  }
  function onLeave() {
    const el = stage.current;
    if (el) el.style.transform = "rotateY(0) rotateX(0)";
  }

  return (
    <div className="relative w-full flex justify-center lg:justify-end" style={{ perspective: 1500 }}>
      {/* ambient blue glows */}
      <div className="rd-glow rd-glow-blue rd-drift-a" style={{ width: 440, height: 440, right: "-4%", top: "-10%", opacity: 0.5 }} />
      <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 320, height: 320, left: "-6%", bottom: "-8%", opacity: 0.4 }} />

      <div
        ref={stage}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="sc-phone-bob relative w-[360px] sm:w-[440px] h-[500px] sm:h-[540px]"
        style={{ transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.2,.7,.2,1)", willChange: "transform" }}
      >
        {/* BOTTOM — dark Apple Wallet phone (SwiftCard on top, cards tucked below) */}
        <div className="absolute left-[2%] bottom-0 w-[214px] sm:w-[230px]" style={{ transform: "translateZ(20px) rotate(-9deg)" }}>
          <WalletPhone />
        </div>

        {/* TOP-RIGHT — opened SwiftCard link page */}
        <div className="absolute right-[2%] top-0 w-[206px] sm:w-[222px]" style={{ transform: "translateZ(70px) rotate(7deg)" }}>
          <LinkPhone />
        </div>

        {/* tap spark between the two phones */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0B1022]/90 px-3 py-2 shadow-xl" style={{ transform: "translate(-50%,-50%) translateZ(110px)" }}>
          <div className="flex items-center gap-2 text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M6 8a8 8 0 000 8M9.5 6a12 12 0 000 12M13 4.5a16 16 0 000 15" strokeLinecap="round" /></svg>
            <span className="text-[12px] font-semibold whitespace-nowrap">One tap</span>
          </div>
        </div>
      </div>
    </div>
  );
}
