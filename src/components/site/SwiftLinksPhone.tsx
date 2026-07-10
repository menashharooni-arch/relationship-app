"use client";

import { useRef, useState } from "react";
import SocialIcons from "@/components/SocialIcons";

// Marketing phone for the SwiftLinks section. The screen replicates the REAL
// SwiftLink profile (SwiftLinkProfile) — full-bleed hero photo, a dark sheet
// that scrolls up over it, name + verified badge, @handle, socials, connect,
// and link.me-style featured tiles — and scrolls inside the phone exactly like
// the live page. The phone itself gets a restrained glow, floor shadow, a faint
// backing layer, and a subtle cursor tilt so it doesn't sit flat. All controls
// are display-only (pointer-events:none); only scrolling is live.

const SHEET = "#191a1a";
const PAGE = "#09090B";

const SOCIALS = [
  { label: "Website", href: "#", color: "#1D4ED8" },
  { label: "LinkedIn", href: "#", color: "#0A66C2" },
  { label: "Instagram", href: "#", color: "#E1306C" },
  { label: "TikTok", href: "#", color: "#010101" },
  { label: "X / Twitter", href: "#", color: "#000000" },
];

// link.me-style featured tiles (odd count → first tile goes full-width + taller).
const FALLBACK = [
  "linear-gradient(135deg, #1d4ed8 0%, #4338ca 55%, #7c3aed 100%)",
  "linear-gradient(135deg, #0e7490 0%, #2563eb 60%, #4f46e5 100%)",
  "linear-gradient(135deg, #0369a1 0%, #0d9488 60%, #0284c7 100%)",
];
const LINKS = ["Book a viewing", "See current listings", "Watch neighborhood tour"];

function VerifiedBadge({ className = "w-[22px] h-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-label="Verified">
      <path d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z" fill="#2196F3" />
      <path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Profile() {
  return (
    <div style={{ background: PAGE }}>
      {/* Hero — full-bleed photo the sheet scrolls over */}
      <div className="relative w-full aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marketing/demo-girl.jpg" alt="Alex Morgan" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none" style={{ background: `linear-gradient(180deg, rgba(25,26,26,0) 0%, ${SHEET} 100%)` }} />
      </div>

      {/* Sheet */}
      <div className="relative -mt-9 rounded-t-[26px] px-4 pt-6 pb-8 text-center" style={{ background: SHEET }}>
        <div className="flex items-center justify-center gap-1.5 px-2">
          <h3 className="text-white font-extrabold" style={{ fontSize: 26, letterSpacing: "0.25px", lineHeight: 1.15 }}>Alex Morgan</h3>
          <VerifiedBadge className="w-[19px] h-[19px]" />
        </div>
        <p className="text-white/50 text-[14px] mt-0.5">@alexmorgan</p>
        <p className="text-white/60 text-[12.5px] font-medium mt-2">Founder &amp; CEO&nbsp;&nbsp;·&nbsp;&nbsp;Morgan &amp; Co.</p>
        <p className="text-white/75 text-[13px] leading-relaxed mt-3 max-w-[300px] mx-auto">Building things people love. Tap a link below to connect, book, or take a look 👇</p>

        {/* Social icons (display-only) */}
        <div style={{ pointerEvents: "none" }}>
          <SocialIcons socials={SOCIALS} />
        </div>

        {/* Connect (lead capture) */}
        <div className="w-full mt-6" style={{ pointerEvents: "none" }}>
          <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white shadow-sm" style={{ background: "#1D4ED8" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Connect with Alex
          </div>
        </div>

        {/* Featured links — link.me album grid */}
        <div className="w-full mt-6 flex flex-wrap justify-between" style={{ pointerEvents: "none" }}>
          {LINKS.map((label, i) => {
            const big = i === 0; // odd count → first tile full-width
            return (
              <div key={label} className={`relative overflow-hidden rounded-[14px] mb-2.5 ${big ? "w-full h-[190px]" : "w-[calc(50%-6px)] h-[148px]"}`} style={{ background: "#242526" }}>
                <div className="absolute inset-0" style={{ background: FALLBACK[i % FALLBACK.length] }} />
                <div className="absolute inset-x-0 bottom-0 h-[70%]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)" }} />
                <span className="absolute inset-x-0 bottom-[7px] px-2 flex justify-center">
                  <span className={`text-white font-semibold text-center leading-[1.3] ${big ? "text-[18px]" : "text-[15px]"}`} style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>{label}</span>
                </span>
                <span className="rd-ll-shine" aria-hidden="true" />
              </div>
            );
          })}
        </div>

        {/* Faint link to the full SwiftCard */}
        <div className="flex justify-center mt-8">
          <span className="inline-block px-4 py-2 text-white/40 text-xs">View SwiftCard →</span>
        </div>
        {/* Attribution badge (Free) */}
        <div className="flex justify-center mt-2">
          <span className="flex items-center gap-1.5 text-white/40 text-[11px]">
            <svg viewBox="0 0 100 100" className="w-3 h-3"><polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" /></svg>
            Powered by SwiftCard.me
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SwiftLinksPhone() {
  const stage = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const MAX = 5; // very subtle
    el.style.transform = `rotateY(${px * MAX}deg) rotateX(${-py * MAX}deg)`;
  }
  function onLeave() {
    const el = stage.current;
    if (el) el.style.transform = "rotateY(0) rotateX(0)";
  }

  return (
    <div className="relative flex justify-center lg:justify-end" style={{ perspective: 1500 }}>
      <div className="relative" style={{ width: 340 }}>
        {/* restrained glow */}
        <div className="rd-glow rd-glow-cyan rd-drift-b" style={{ width: 380, height: 380, right: "-14%", top: "2%", opacity: 0.32, zIndex: 0 }} />
        {/* faint backing second-screen */}
        <div
          className="absolute rounded-[46px] border border-white/10"
          style={{ inset: 0, transform: "translate(22px, 18px) rotate(3deg)", background: "linear-gradient(160deg, rgba(77,168,245,0.10), rgba(34,211,238,0.04) 60%, transparent)", zIndex: 0 }}
          aria-hidden="true"
        />
        {/* soft floor shadow (grounded — outside the tilt) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-[50%]"
          style={{ bottom: -22, width: "76%", height: 34, background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)", filter: "blur(12px)", zIndex: 0 }}
          aria-hidden="true"
        />

        {/* tilt stage */}
        <div
          ref={stage}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="relative"
          style={{ transformStyle: "preserve-3d", transition: "transform .5s cubic-bezier(.2,.7,.2,1)", willChange: "transform", zIndex: 1 }}
        >
          <div className="rd-phone w-[340px]">
            <div className="rd-phone-screen h-[610px]" style={{ background: PAGE }}>
              <div className="rd-notch" />
              {/* Sticky mini header — fades in once the hero scrolls away */}
              <div className="absolute top-0 inset-x-0 z-30 h-[50px] flex items-center gap-2.5 px-4 transition-opacity duration-300" style={{ background: "rgba(25,26,26,0.82)", backdropFilter: "blur(14px)", opacity: scrolled ? 1 : 0 }}>
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/marketing/demo-girl.jpg" alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-white font-bold text-[14px] truncate">Alex Morgan</span>
                <VerifiedBadge className="w-4 h-4" />
              </div>
              <div className="absolute inset-0 overflow-y-auto rd-scrollbar-none" onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 190)}>
                <Profile />
              </div>
              <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 26%)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
