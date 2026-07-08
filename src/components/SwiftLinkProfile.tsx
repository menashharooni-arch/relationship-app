"use client";

// Link-in-bio profile layout modeled on link.me: a full-bleed hero photo that a
// dark rounded "sheet" scrolls up over, big bold name + verified badge,
// @username, a brand-colored social icon row, then rich featured-link cards.
// Mobile-first (this lives in Instagram/TikTok/X bios) — on desktop the same
// column renders centered at phone width.

import { useEffect, useState } from "react";
import ConnectButton from "@/components/ConnectButton";
import SocialIcons, { type BrandSocial } from "@/components/SocialIcons";
import SwiftLinkButtons from "@/components/SwiftLinkButtons";

const SHEET = "#191a1a"; // link.me's dark sheet color
const PAGE = "#09090B"; // page background behind the column

type LinkItem = { emoji: string; label: string; url: string };

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function VerifiedBadge({ className = "w-[22px] h-[22px]" }: { className?: string }) {
  // Blue scalloped verified seal with a white check.
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-label="Verified">
      <path
        d="M12 1.5l2.35 2.03 3.08-.45 1.07 2.92 2.92 1.07-.45 3.08L23 12l-2.03 2.35.45 3.08-2.92 1.07-1.07 2.92-3.08-.45L12 23l-2.35-2.03-3.08.45-1.07-2.92-2.92-1.07.45-3.08L1 12l2.03-2.35-.45-3.08 2.92-1.07 1.07-2.92 3.08.45L12 1.5z"
        fill="#2196F3"
      />
      <path d="M7.5 12.2l3 3 6-6.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function SwiftLinkProfile({
  name,
  username,
  photoUrl,
  subtitle,
  bio,
  verified,
  socials,
  links,
  ownerPaid,
  appUrl,
}: {
  name: string;
  username: string;
  photoUrl: string | null;
  subtitle: string;
  bio: string;
  verified: boolean;
  socials: BrandSocial[];
  links: LinkItem[];
  ownerPaid: boolean;
  appUrl: string;
}) {
  // Mini header fades in once the hero photo scrolls out from under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 230);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const firstName = name.split(" ")[0] || username;
  const initials = initialsOf(name || username);

  return (
    <main className="min-h-[100dvh]" style={{ background: PAGE }}>
      <div
        className="relative mx-auto w-full max-w-[430px] min-h-[100dvh] md:min-h-0 md:my-8 md:rounded-[30px] md:overflow-hidden md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ background: SHEET }}
      >
        {/* Sticky mini header — zero-height wrapper so it draws over the hero */}
        <div className="sticky top-0 z-30 h-0">
          <div
            className={`flex items-center gap-2.5 px-4 h-[54px] transition-opacity duration-300 md:rounded-t-[30px] ${
              scrolled ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{ background: "rgba(25,26,26,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: "#2c2d2d" }}>
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white/80">{initials}</div>
              )}
            </div>
            <span className="text-white font-bold text-[15px] truncate">{name}</span>
            {verified && <VerifiedBadge className="w-4 h-4" />}
          </div>
        </div>

        {/* Hero — full-bleed photo the sheet scrolls over */}
        <div className="relative w-full aspect-square max-h-[520px] overflow-hidden md:rounded-t-[30px]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}
            >
              <span className="text-white/90 font-extrabold text-7xl tracking-wide">{initials}</span>
            </div>
          )}
          {/* Soft fade into the sheet */}
          <div
            className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
            style={{ background: `linear-gradient(180deg, rgba(25,26,26,0) 0%, ${SHEET} 100%)` }}
          />
        </div>

        {/* Sheet */}
        <div className="relative -mt-10 rounded-t-[30px] px-4 pt-7 pb-9 text-center" style={{ background: SHEET }}>
          {/* Name + verified badge */}
          <div className="flex items-center justify-center gap-1.5 px-2">
            <h1
              className="text-white font-extrabold overflow-hidden whitespace-nowrap text-ellipsis"
              style={{ fontSize: 32, letterSpacing: "0.25px", lineHeight: 1.15 }}
            >
              {name}
            </h1>
            {verified && <VerifiedBadge />}
          </div>
          <p className="text-white/50 text-[15px] mt-0.5">@{username}</p>

          {subtitle && <p className="text-white/60 text-[13px] font-medium mt-2">{subtitle}</p>}
          {bio && <p className="text-white/75 text-sm leading-relaxed mt-3 max-w-[340px] mx-auto whitespace-pre-wrap">{bio}</p>}

          {/* Social icons — brand-colored, deep-link into apps on mobile */}
          <SocialIcons socials={socials} />

          {/* Connect (lead capture) */}
          <div className="w-full mt-6">
            <ConnectButton cardOwner={username} ownerFirstName={firstName} />
          </div>

          {/* Featured links — rich preview cards */}
          <SwiftLinkButtons links={links} />

          {/* Footer — "Made with SwiftCard" attribution badge on Free only.
              Paid plans show nothing (the "View Swift Card" button was removed). */}
          {!ownerPaid && (
            <div className="flex justify-center mt-10">
              <a
                href={`${appUrl}/?src=badge`}
                className="flex items-center gap-1.5 text-white/40 text-[11px] hover:text-white/75 transition-colors"
              >
                <svg viewBox="0 0 100 100" className="w-3 h-3">
                  <polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" />
                </svg>
                Powered by SwiftCard.me
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
