"use client";

import { useState } from "react";
import SocialIcons from "@/components/SocialIcons";

// Marketing phone for the SwiftLinks section. A plain phone frame whose screen
// replicates the REAL SwiftLink profile (SwiftLinkProfile) — full-bleed hero
// photo, a dark sheet that scrolls up over it, name + verified badge, @handle,
// socials, connect, and link.me-style featured tiles (including a video tile) —
// and scrolls inside the phone exactly like the live page. Everything is
// display-only (pointer-events:none); only scrolling is live.

const SHEET = "#191a1a";
const PAGE = "#09090B";

const SOCIALS = [
  { label: "Website", href: "#", color: "#1D4ED8" },
  { label: "LinkedIn", href: "#", color: "#0A66C2" },
  { label: "Instagram", href: "#", color: "#E1306C" },
  { label: "TikTok", href: "#", color: "#010101" },
  { label: "X / Twitter", href: "#", color: "#000000" },
];

const FALLBACK = [
  "linear-gradient(135deg, #1d4ed8 0%, #4338ca 55%, #7c3aed 100%)",
  "linear-gradient(135deg, #0e7490 0%, #2563eb 60%, #4f46e5 100%)",
];

// Sample featured links — mix of a video, image previews, and gradient tiles,
// so the section shows how videos and rich links render (link.me album grid:
// odd count → first tile goes full-width + taller).
type Tile = { label: string; kind: "video" | "image" | "gradient"; img?: string; gi?: number; icon: string };
const TILES: Tile[] = [
  { label: "Neighborhood tour", kind: "video", img: "/marketing/ll-video.jpg", icon: "🎬" },
  { label: "See current listings", kind: "image", img: "/marketing/ll-listings.jpg", icon: "🏠" },
  { label: "From the blog", kind: "image", img: "/marketing/ll-blog.jpg", icon: "✍️" },
  { label: "Book a viewing", kind: "gradient", gi: 0, icon: "📅" },
  { label: "Read client reviews", kind: "gradient", gi: 1, icon: "⭐" },
];

function VerifiedBadge({ className = "w-[22px] h-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-label="Verified">
      <path d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z" fill="#2196F3" />
      <path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function FeaturedTile({ t, big }: { t: Tile; big: boolean }) {
  const hasImg = t.kind === "video" || t.kind === "image";
  return (
    <div className={`relative overflow-hidden rounded-[14px] mb-2.5 ${big ? "w-full h-[190px]" : "w-[calc(50%-6px)] h-[148px]"}`} style={{ background: "#242526" }}>
      {hasImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: FALLBACK[(t.gi ?? 0) % FALLBACK.length] }} />
      )}
      {/* bottom gradient so the title reads over any image */}
      <div className="absolute inset-x-0 bottom-0 h-[70%]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)" }} />
      {/* favicon circle, top-left */}
      <span className="absolute top-2 left-2 z-[6] w-[30px] h-[30px] rounded-full bg-white/95 shadow flex items-center justify-center">
        <span className="text-[15px] leading-none">{t.icon}</span>
      </span>
      {/* play button for video */}
      {t.kind === "video" && (
        <span className="absolute inset-0 z-[6] flex items-center justify-center">
          <span className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-[2px] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="#fff" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      )}
      {/* centered title */}
      <span className="absolute inset-x-0 bottom-[7px] z-[6] px-2 flex justify-center">
        <span className={`text-white font-semibold text-center leading-[1.3] ${big ? "text-[18px]" : "text-[15px]"}`} style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>{t.label}</span>
      </span>
      <span className="rd-ll-shine" aria-hidden="true" />
    </div>
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

        {/* Connect (display-only) */}
        <div className="w-full mt-6" style={{ pointerEvents: "none" }}>
          <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white shadow-sm" style={{ background: "#1D4ED8" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Connect with Alex
          </div>
        </div>

        {/* Featured links — link.me album grid (display-only) */}
        <div className="w-full mt-6 flex flex-wrap justify-between" style={{ pointerEvents: "none" }}>
          {TILES.map((t, i) => (
            <FeaturedTile key={t.label} t={t} big={i === 0} />
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <span className="inline-block px-4 py-2 text-white/40 text-xs">View SwiftCard →</span>
        </div>
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
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="flex flex-col items-center lg:items-end gap-3">
      <div className="flex items-center gap-1.5 text-white/45 text-[12px] font-medium">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M12 19l-4-4M12 19l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Scroll on phone to view
      </div>
      <div className="rd-phone w-[340px]">
        <div className="rd-phone-screen h-[610px]" style={{ background: PAGE }}>
          <div className="rd-notch" />
          {/* Sticky mini header — fades in once the hero scrolls away */}
          <div className="absolute top-0 inset-x-0 z-30 h-[50px] flex items-center gap-2.5 px-4 transition-opacity duration-300" style={{ background: "rgba(25,26,26,0.82)", backdropFilter: "blur(14px)", opacity: scrolled ? 1 : 0, pointerEvents: "none" }}>
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
  );
}
