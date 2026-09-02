"use client";

// Link-in-bio profile layout modeled on link.me: a full-bleed hero photo that a
// dark rounded "sheet" scrolls up over, big bold name + verified badge,
// @username, a brand-colored social icon row, then rich featured-link cards.
// Mobile-first (this lives in Instagram/TikTok/X bios) — on desktop the same
// column renders centered at phone width.

import { useEffect, useState } from "react";
import ConnectButton from "@/components/ConnectButton";
import SocialIcons, { type BrandSocial } from "@/components/SocialIcons";
import { SwiftCardIcon } from "@/components/SwiftCardLogo";
import SwiftLinkButtons from "@/components/SwiftLinkButtons";
import { getLook, hexAlpha, normalizeIconShape, normalizeIconFill, normalizeHeroStyle, normalizeHeroContent, normalizeButtonStyle } from "@/lib/swiftlink-looks";

// Owner-picked "Social design": a named Look (every plan — Free gets the free
// pair, see lib/swiftlink-looks) plus optional Pro fine-tuning (bg/text/font)
// layered on top of it. No style at all → the default Look ("Paper", light).
// heroStyle ("cover"/"avatar") and buttonStyle/buttonColor are the 2026-09-01
// Linktree-informed additions — see lib/swiftlink-looks for the vocabulary.
export type SwiftLinkPageStyle = { look?: string; bg?: string; text?: string; font?: string; iconShape?: string; iconFill?: string; heroStyle?: string; heroContent?: string; buttonStyle?: string; buttonColor?: string };

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
  showCardLink = true,
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
  /** Owner toggle (Social design step): the faint "View SwiftCard →" link at
   *  the bottom. ON by default — hiding it is the owner's explicit choice. */
  showCardLink?: boolean;
}) {
  // Header layout: "cover" (default — the original full-photo hero the sheet
  // slides over), "banner" (the same at a third of the screen), "avatar"
  // (compact circle on the sheet) or "none" (one flat page, no header).
  const heroStyle = normalizeHeroStyle(pageStyle?.heroStyle);
  const heroBanner = heroStyle === "banner";
  const heroAvatar = heroStyle === "avatar";
  // Avatar and none both start the sheet at the very top of the page.
  const flatTop = heroStyle === "avatar" || heroStyle === "none";

  // What the header SHOWS — the owner's explicit pick, falling down the auto
  // chain (headshot → logo → initials) whenever the picked asset doesn't
  // exist, so the header can never render empty.
  const heroContent = normalizeHeroContent(pageStyle?.heroContent);
  const hero =
    heroContent === "initials" ? { kind: "initials" as const, url: null } :
    heroContent === "photo" && photoUrl ? { kind: "photo" as const, url: photoUrl } :
    heroContent === "logo" && logoUrl ? { kind: "logo" as const, url: logoUrl } :
    photoUrl ? { kind: "photo" as const, url: photoUrl } :
    logoUrl ? { kind: "logo" as const, url: logoUrl } :
    { kind: "initials" as const, url: null };

  // Mini header fades in once the hero scrolls out from under it. Not in a
  // preview: there's no page scroll, so it would just sit invisible. Shorter
  // headers get proportionally earlier thresholds.
  const scrollThreshold = heroStyle === "cover" ? 230 : heroBanner ? 150 : heroAvatar ? 96 : 60;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (embedded) return;
    const onScroll = () => setScrolled(window.scrollY > scrollThreshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [embedded, scrollThreshold]);

  const firstName = name.split(" ")[0] || username;
  const initials = initialsOf(name || username);

  // Resolved page look: the named Look supplies the whole scheme, and the Pro
  // fine-tune keys (bg/text) override it individually where set.
  const look = getLook(pageStyle?.look);
  const sheetBg = pageStyle?.bg || look.sheet;
  const textColor = pageStyle?.text || look.text;
  const pageFont = pageStyle?.font;
  // Gradient and Aura are properties of the LOOK's surface, so a Pro custom
  // background (which replaces that surface) turns them off — otherwise the
  // custom color would paint over half the effect and leave the rest orphaned.
  const sheetTo = pageStyle?.bg ? undefined : look.sheetTo;
  const auraOn = !pageStyle?.bg && !!look.aura && !!photoUrl;
  // The one color the sheet's chrome (hero fade end-stop, glass tint) meets:
  // solid for normal looks, a translucent tint of the same hex for Aura so
  // the blurred photo glows through.
  const sheetMeet = auraOn ? hexAlpha(sheetBg, 0.42) : sheetBg;
  // A custom Pro background can flip the effective mode out from under the
  // Look, and the neutral chrome (rings, hovers, hero fade edge) must follow
  // the SURFACE, not the label — judge the sheet actually in use.
  const light = pageStyle?.bg ? isLightHex(pageStyle.bg) : look.mode === "light";

  return (
    <main className={embedded ? "" : "min-h-[100dvh]"} style={{ background: embedded ? "transparent" : look.page }}>
      <style>{`@media (max-width: 767px) { .sc-sl-sheet { zoom: 0.92; } }`}</style>
      <div
        className={`sc-sl-sheet relative mx-auto w-full max-w-[430px] overflow-hidden ${
          embedded
            ? "rounded-[30px]"
            : "min-h-[100dvh] md:min-h-0 md:my-8 md:rounded-[30px] md:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        }`}
        style={{ background: sheetBg, fontFamily: pageFont }}
      >
        {/* Aura — the owner's own photo, blurred and dimmed, as the page
            atmosphere behind everything (the glass sheet included). First
            child so every sibling paints above it; scale-125 hides the blur's
            washed-out edges outside the rounded clip. */}
        {auraOn && (
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl!} alt="" className="absolute inset-0 w-full h-full object-cover scale-125" style={{ filter: "blur(48px) saturate(1.25)" }} />
            <div className="absolute inset-0" style={{ background: "rgba(8,8,12,0.5)" }} />
          </div>
        )}

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

        {/* Hero — the photo the sheet scrolls over ("cover", or "banner" at a
            third of the screen; "avatar" renders a compact circle inside the
            sheet instead, "none" renders nothing). What it shows is the
            resolved `hero` above — the owner's pick, or the auto chain:
            headshot, then the card's LOGO, then the initials. A business card
            without a face is usually a company card, and its logo is the
            right identity to lead with. */}
        {(heroStyle === "cover" || heroBanner) && (
        <div className={`relative w-full overflow-hidden rounded-t-[30px] ${heroBanner ? "h-[260px]" : "aspect-square max-h-[520px]"}`}>
          {hero.kind === "photo" ? (
            // A headshot is a photo of a person: fill the frame and crop, which
            // is what makes the link.me hero look right.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
          ) : hero.kind === "logo" ? (
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
              className={`absolute inset-0 flex items-center justify-center ${heroBanner ? "p-[8%] pb-[104px]" : "p-[18%] pb-[136px]"}`}
              style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url}
                alt={name}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}
            >
              <span className={`text-white/90 font-extrabold tracking-wide ${heroBanner ? "text-5xl" : "text-7xl"}`}>{initials}</span>
            </div>
          )}
          {/* Soft fade into the sheet — ends at exactly the surface the sheet
              opens with: the solid sheet hex normally, the same hex's glass
              tint on Aura, and a gradient look's 0% stop IS the sheet hex. */}
          <div
            className={`absolute inset-x-0 bottom-0 pointer-events-none ${heroBanner ? "h-24" : "h-32"}`}
            style={{ background: `linear-gradient(180deg, ${hexAlpha(sheetBg, 0)} 0%, ${sheetMeet} 100%)` }}
          />
        </div>
        )}

        {/* Sheet — with the avatar/none headers there's no hero above it, so
            it starts at the very top: no -mt overlap, a touch more padding. */}
        <div
          className={`relative rounded-t-[30px] px-4 pb-9 text-center ${flatTop ? "pt-10" : "-mt-10 pt-7"}`}
          style={{
            background: auraOn
              ? sheetMeet
              : sheetTo
                ? `linear-gradient(180deg, ${sheetBg} 0%, ${sheetTo} 100%)`
                : sheetBg,
            ...(auraOn ? { backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" } : {}),
          }}
        >
          {/* Compact circular avatar — the "avatar" header style. Shows the
              same resolved `hero`: headshot (cropped), or logo (contained, on
              a white plate so any mark reads), or initials on the indigo
              gradient. */}
          {heroAvatar && (
            <div className="flex justify-center mb-4">
              <div className={`w-28 h-28 rounded-full overflow-hidden shrink-0 ring-4 ${light ? "ring-black/[0.06]" : "ring-white/15"}`}>
                {hero.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero.url} alt={name} className="w-full h-full object-cover" />
                ) : hero.kind === "logo" ? (
                  <div className="w-full h-full bg-white flex items-center justify-center p-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hero.url} alt={name} className="max-w-full max-h-full w-auto h-auto object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(160deg, #181538 0%, #2A2466 60%, #4338ca 100%)" }}>
                    <span className="text-white/90 font-extrabold text-4xl tracking-wide">{initials}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {/* The @username line under the name was removed (owner order
              2026-08-26) — the slug reads as "first-last-company" noise; the
              name above and the subtitle below carry the identity. */}

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

          {/* Connect (lead capture) — the page's hero action. Its one-line
              value prompt below the button was removed 2026-08-18 on the
              owner's request; the button stands alone. */}
          <div className="w-full mt-6">
            <ConnectButton cardOwner={username} ownerFirstName={firstName} accent={look.accent} accentText={look.accentText} />
          </div>

          {/* Featured links — rich preview cards */}
          <SwiftLinkButtons
            links={links}
            tileBg={look.tile}
            mode={light ? "light" : "dark"}
            textColor={textColor}
            paid={paidTiles}
            buttonStyle={normalizeButtonStyle(pageStyle?.buttonStyle)}
            buttonColor={pageStyle?.buttonColor}
            accent={look.accent}
            accentText={look.accentText}
          />

          {/* Faint link to this person's full SwiftCard — owner-toggleable from
              the Social design step (hideCardLink in customization). */}
          {showCardLink && (
            <div className="flex justify-center mt-10">
              <a
                href={`/${username}`}
                className={`inline-block px-4 py-2 text-xs rounded-lg transition-colors ${"" /* hover well must be visible on BOTH modes */}${light ? "hover:bg-black/[0.06]" : "hover:bg-white/10"}`}
                style={{ color: textColor, opacity: 0.5 }}
              >
                View SwiftCard →
              </a>
            </div>
          )}

          {/* Footer — "Made with swiftcard.me" attribution on EVERY profile,
              every plan (owner decision 2026-08-11, same call as the card
              page's badge — the two gates had drifted apart once already).
              Wording changed 2026-08-18 (owner request): the brand word is the
              DOMAIN, underlined, so visitors can tell it's a tappable link —
              plain "SwiftCard" read as a label and nobody knew to tap it. */}
          <div className="flex justify-center mt-5">
            <a
              href={`${appUrl}/?src=badge`}
              className="flex items-center gap-2 text-[13px] transition-opacity opacity-50 hover:opacity-80"
              style={{ color: textColor }}
            >
              <span className="shrink-0 rounded-[4px] overflow-hidden flex"><SwiftCardIcon size={16} /></span>
              <span>Made with <span className="underline underline-offset-2">swiftcard.me</span></span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
