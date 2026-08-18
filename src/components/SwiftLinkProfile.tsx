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
import { getLook, hexAlpha, normalizeIconShape, normalizeIconFill } from "@/lib/swiftlink-looks";

// Owner-picked "Social design": a named Look (every plan — Free gets the free
// pair, see lib/swiftlink-looks) plus optional Pro fine-tuning (bg/text/font)
// layered on top of it. No style at all → the default Look ("Paper", light).
export type SwiftLinkPageStyle = { look?: string; bg?: string; text?: string; font?: string; iconShape?: string; iconFill?: string };

type LinkItem = { emoji: string; label: string; url: string; size?: "featured" | "grid" | "compact"; kind?: "link" | "header" };

// Perceived lightness of a hex surface — decides whether neutral chrome
// (rings, hover wells) should be dark-on-light or light-on-dark when a Pro
// custom background replaces the Look's sheet.
function isLightHex(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
}

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
  logoUrl = null,
  subtitle,
  bio,
  verified,
  socials,
  links,
  appUrl,
  pageStyle,
  embedded = false,
  paidTiles = false,
}: {
  name: string;
  username: string;
  photoUrl: string | null;
  /** The card's logo, used for the hero ONLY when there is no headshot.
   *  Optional so any caller that has no logo keeps the initials fallback. */
  logoUrl?: string | null;
  subtitle: string;
  bio: string;
  verified: boolean;
  socials: BrandSocial[];
  links: LinkItem[];
  appUrl: string;
  /** Owner's "Social design" (Pro) — falls back to the stock dark look. */
  pageStyle?: SwiftLinkPageStyle;
  /** Rendered inside a live PREVIEW (card wizard/editor, mini-builders) rather
   *  than as the standalone page: flow at the container width with no full-page
   *  height/background/margins, and skip the scroll-driven mini header (there's
   *  no page scroll to drive it). Everything else — hero, bio, socials, link
   *  cards, footer — is byte-for-byte the real page, so the preview is exact. */
  embedded?: boolean;
  /** Paid owner: featured/grid image tiles + inline video. Defaults FALSE —
   *  fails closed to the Free rendering (every link compact). */
  paidTiles?: boolean;
}) {
  // Mini header fades in once the hero photo scrolls out from under it. Not in
  // a preview: there's no page scroll, so it would just sit invisible.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (embedded) return;
    const onScroll = () => setScrolled(window.scrollY > 230);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [embedded]);

  const firstName = name.split(" ")[0] || username;
  const initials = initialsOf(name || username);

  // Resolved page look: the named Look supplies the whole scheme, and the Pro
  // fine-tune keys (bg/text) override it individually where set.
  const look = getLook(pageStyle?.look);
  const sheetBg = pageStyle?.bg || look.sheet;
  const textColor = pageStyle?.text || look.text;
  const pageFont = pageStyle?.font;
  // A custom Pro background can flip the effective mode out from under the
  // Look, and the neutral chrome (rings, hovers, hero fade edge) must follow
  // the SURFACE, not the label — judge the sheet actually in use.
  const light = pageStyle?.bg ? isLightHex(pageStyle.bg) : look.mode === "light";

  return (
    <main className={embedded ? "" : "min-h-[100dvh]"} style={{ background: embedded ? "transparent" : look.page }}>
      <div
        className={`relative mx-auto w-full max-w-[430px] overflow-hidden ${
          embedded
            ? "rounded-[30px]"
            : "min-h-[100dvh] md:min-h-0 md:my-8 md:rounded-[30px] md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        }`}
        style={{ background: sheetBg, fontFamily: pageFont }}
      >
        {/* Sticky mini header — zero-height wrapper so it draws over the hero.
            Skipped in a preview (no page scroll to reveal it). */}
        {!embedded && (
          <div className="sticky top-0 z-30 h-0">
            <div
              className={`flex items-center gap-2.5 px-4 h-[54px] transition-opacity duration-300 md:rounded-t-[30px] ${
                scrolled ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ background: hexAlpha(sheetBg, 0.84), backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: light ? "rgba(17,24,39,0.08)" : "#2c2d2d" }}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] font-bold" style={{ color: textColor, opacity: 0.8 }}>{initials}</div>
                )}
              </div>
              <span className="font-bold text-[15px] truncate" style={{ color: textColor }}>{name}</span>
              {verified && <VerifiedBadge className="w-4 h-4" />}
            </div>
          </div>
        )}

        {/* Hero — full-bleed photo the sheet scrolls over.
            Fallback order: the card's headshot, then the card's LOGO, then the
            initials. A business card without a face is usually a company card,
            and its logo is the right identity to lead with. */}
        <div className="relative w-full aspect-square max-h-[520px] overflow-hidden rounded-t-[30px]">
          {photoUrl ? (
            // A headshot is a photo of a person: fill the square and crop, which
            // is what makes the link.me hero look right.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : logoUrl ? (
            // A LOGO is not a headshot and must not be treated like one.
            // object-cover would crop a wide wordmark down to its middle
            // letters, so it is object-CONTAIN, centred, on the same gradient
            // the initials use — the logo is shown whole, at its own aspect
            // ratio, never cut. p-[18%] keeps it clear of the rounded top
            // corners and of the sheet's fade at the bottom, so nothing eats
            // into it. A transparent PNG sits on the gradient; a square logo
            // reads as a centred emblem rather than a stretched background.
            <div
              // pb is a FIXED length, not a percentage, and that is the whole
              // point: the thing it clears — the fade below — is itself a fixed
              // h-32 (128px) at every width, so 128 + an 8px gap clears it
              // exactly, while any percentage only clears it at one width. It
              // was pb-[36%], which cleared the fade at 390px but let the bottom
              // ~13px of a square or tall logo sit inside it at 320px. Centred
              // uniformly (no extra bottom pad at all) a logo sank much further
              // in and its lower half washed out, reading as cut off.
              // Padding-top stays a percentage — it clears the rounded top
              // corners, which DO scale with width.
              // Measured at 320/390/430 (the hero is capped at max-w-[430px]):
              // wide 5:1, square 1:1 and tall 1:2 logos all sit fully clear of
              // the fade, uncropped, and the logo is bigger at 430 than 36% gave.
              className="absolute inset-0 flex items-center justify-center p-[18%] pb-[136px]"
              style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={name}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
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
            style={{ background: `linear-gradient(180deg, ${hexAlpha(sheetBg, 0)} 0%, ${sheetBg} 100%)` }}
          />
        </div>

        {/* Sheet */}
        <div className="relative -mt-10 rounded-t-[30px] px-4 pt-7 pb-9 text-center" style={{ background: sheetBg }}>
          {/* Name + verified badge */}
          {/* items-start so the badge sits with the FIRST line once the name
              wraps, rather than drifting to the vertical middle of a two-line
              block. */}
          <div className="flex items-start justify-center gap-1.5 px-2">
            <h1
              // The name WRAPS; it is never truncated. This used to be
              // "overflow-hidden whitespace-nowrap text-ellipsis", so a long
              // name was cut off with an ellipsis — the page is someone's
              // identity, and a clipped name is the one thing here that must
              // never happen. break-words additionally splits a single
              // unbroken token (a very long one-word name) instead of letting
              // it spill past the sheet.
              // min-w-0 is required for break-words to do anything here: a flex
              // item defaults to min-width:auto, so the box GROWS to fit an
              // unbreakable token instead of constraining the line, and the
              // word then runs past the sheet. Measured — without it a
              // 34-character single-word name still overflowed the edge.
              className="font-extrabold break-words min-w-0"
              style={{ fontSize: 32, letterSpacing: "0.25px", lineHeight: 1.15, color: textColor }}
            >
              {name}
            </h1>
            {/* shrink-0: the badge must keep its size and let the name take the
                remaining width, otherwise the flex row squeezes the badge. */}
            {verified && <span className="shrink-0 mt-1.5"><VerifiedBadge /></span>}
          </div>
          <p className="text-[15px] mt-0.5" style={{ color: textColor, opacity: 0.5 }}>@{username}</p>

          {subtitle && <p className="text-[13px] font-medium mt-2" style={{ color: textColor, opacity: 0.6 }}>{subtitle}</p>}
          {bio && <p className="text-sm leading-relaxed mt-3 max-w-[340px] mx-auto whitespace-pre-wrap" style={{ color: textColor, opacity: 0.75 }}>{bio}</p>}

          {/* Social icons — brand-colored, deep-link into apps on mobile */}
          <SocialIcons
            socials={socials}
            mode={light ? "light" : "dark"}
            shape={normalizeIconShape(pageStyle?.iconShape)}
            fill={normalizeIconFill(pageStyle?.iconFill)}
            accent={look.accent}
            accentText={look.accentText}
          />

          {/* Connect (lead capture) — the page's hero action, with a one-line
              value prompt so a first-time visitor knows what tapping DOES.
              The button used to sit unexplained; "Connect with Sam" reads as
              anything from a follow to a DM. */}
          <div className="w-full mt-6">
            <ConnectButton cardOwner={username} ownerFirstName={firstName} accent={look.accent} accentText={look.accentText} />
            <p className="text-[11.5px] mt-2" style={{ color: textColor, opacity: 0.5 }}>
              Share your details back — you&apos;ll land in {firstName}&apos;s contacts.
            </p>
          </div>

          {/* Featured links — rich preview cards */}
          <SwiftLinkButtons links={links} tileBg={look.tile} mode={light ? "light" : "dark"} textColor={textColor} paid={paidTiles} />

          {/* Faint link to this person's full SwiftCard (every plan) */}
          <div className="flex justify-center mt-10">
            <a
              href={`/card/${username}`}
              className={`inline-block px-4 py-2 text-xs rounded-lg transition-colors ${"" /* hover well must be visible on BOTH modes */}${light ? "hover:bg-black/[0.06]" : "hover:bg-white/10"}`}
              style={{ color: textColor, opacity: 0.5 }}
            >
              View SwiftCard →
            </a>
          </div>

          {/* Footer — "Made with swiftcard.me" attribution on EVERY profile,
              every plan (owner decision 2026-08-11, same call as the card
              page's badge — the two gates had drifted apart once already).
              Wording changed 2026-08-18 (owner request): the brand word is the
              DOMAIN, underlined, so visitors can tell it's a tappable link —
              plain "SwiftCard" read as a label and nobody knew to tap it. */}
          <div className="flex justify-center mt-5">
            <a
              href={`${appUrl}/?src=badge`}
              className="flex items-center gap-1.5 text-[11px] transition-opacity opacity-40 hover:opacity-75"
              style={{ color: textColor }}
            >
              <svg viewBox="0 0 100 100" className="w-3 h-3 shrink-0">
                <polygon points="57,15 38,52 50,52 43,85 62,48 50,48" fill="currentColor" />
              </svg>
              <span>Made with <span className="underline underline-offset-2">swiftcard.me</span></span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
