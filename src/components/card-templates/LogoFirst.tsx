// LogoFirst — Navy & Ring
// Style: Deep navy card, the company mark held in a ring on the left, hairline
// rule, uppercase name and contact column on the right.
// Includes: Logo (hero), name, title, company, phone, email, website, address, QR
// Best for: firms that lead with a brand mark rather than a face — agencies,
// practices, contractors, funds, anyone whose logo is the recognisable thing.

import React from "react";
import { MiniQR as QR } from "./MiniQR";
import type { CardData } from "./types";
import {
  cardAspect, ContactRows, fitFactor, fitName, fitTitle, fitCompany, heroGrow,
  qrSize, templateStyle, isDarkBg, infoPaletteFrom,
} from "./shared";

const NAVY   = "#2C3A52";
const INK    = "#141B26";
// Left panel share of the card width.
//
// 0.43 looked right and measured wrong. The right column has to hold the
// contact rows AND the QR side by side, and at 0.43 the rows were left ~120px
// at a 390px card — narrow enough that a one-line address wrapped to four or
// five lines and pushed the block out of the card. Every 390px overflow in the
// audit traced back to that, and none survived the change.
const PANEL  = 0.39;

/** Perceived brightness (YIQ), 0-255. Null for anything unparseable. */
function yiq(hex?: string | null): number | null {
  const m = (hex || "").match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

/**
 * The accent draws the RING and the contact icons, so unlike a text colour it
 * has no background of its own to sit on — a white accent on a bone card leaves
 * an invisible ring and invisible icons.
 *
 * Both the background and the accent are freely chosen by the owner (and Free
 * accounts get snapped to the preset lists, which contain both light and dark
 * options for each), so the combination is reachable in normal use, not just by
 * a crafted value. When the two are too close in brightness, fall back to the
 * side that contrasts.
 */
function safeRingAccent(accent: string | undefined, bg: string, dark: boolean): string {
  const fallback = dark ? "#FFFFFF" : NAVY;
  if (!accent) return fallback;
  const a = yiq(accent);
  const b = yiq(bg);
  if (a === null || b === null) return fallback;
  return Math.abs(a - b) < 60 ? fallback : accent;
}

export default function LogoFirst({ data }: { data: CardData }) {
  const style = templateStyle(data);
  const bg = style.bgColor ?? NAVY;
  const dark = isDarkBg(bg);
  // On a dark card the ring and accents read as near-white; on a light one they
  // fall back to the navy so the template keeps its identity either way. The
  // guard also catches an EXPLICIT accent that matches the background.
  const accent = safeRingAccent(style.accentColor, bg, dark);
  const nameColor = style.textColor ?? (dark ? "#FFFFFF" : INK);
  const infoPal = style.infoColor
    ? infoPaletteFrom(style.infoColor)
    : dark
      ? { strong: "#FFFFFF", mid: "#E6EBF3", soft: "#C2CCDC", muted: "#A6B2C6" }
      : { strong: INK, mid: "#2C3A52", soft: "#5A6B85", muted: "#7A8AA3" };

  const initials =
    data.initials ??
    (data.company || data.name || "").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const f = fitFactor(data);          // density: more contact rows → everything shrinks together
  const grow = heroGrow(f);           // hero type grows a little on sparse cards
  const ruleColor = dark ? "rgba(255,255,255,0.20)" : "rgba(20,27,38,0.14)";

  // Company sits under the name as a single line, and it truncates — so a long
  // one has to be SHRUNK to fit rather than cut. fitCompany sizes it by its
  // longest word against the identity block's usable width: 390 x 0.61, less
  // the rule and the 31px of horizontal padding, rounded down. The narrower of
  // the two real layout widths is the one to budget, so the same size holds at
  // 460 with room to spare.
  const companyFit = fitCompany(10.5, data.company, 26, 190, 0, false);

  return (
    <div
      className="sc-card relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: cardAspect(data),
        background: bg,
        fontFamily: style.fontFamily,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Left: the mark, inside a ring that HUGS it ──────────────────────
          The ring is an inline-flex wrapper with a fully-round border, so it
          shrink-wraps whatever it contains and takes that thing's proportions:
          a square crest gets a circle (the reference look), a 4:1 wordmark gets
          a pill, a tall mark gets an upright capsule. That is the whole trick,
          and it is why this template survives any logo shape without ever
          cropping one — a fixed circle would have to shrink a wide mark to its
          own diameter to avoid overlapping the stroke.

          It has to be pure CSS: card templates are SERVER-RENDERED and must
          never use a hook, so measuring the image's aspect ratio on load is not
          available here. */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: `${PANEL * 100}%`, padding: "15px 12px 15px 17px" }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            padding: data.logoUrl ? 15 : 17,
            borderRadius: 9999,
            border: `1.4px solid ${accent}`,
            opacity: 0.98,
            // A floor in both directions so an undersized logo file still gets a
            // ring with presence instead of a 46px speck. Both numbers sit below
            // every shape a normal logo produces (the flattest, an 8:1 wordmark,
            // still measures 154x45), so this only ever engages for a mark that
            // would have looked lost.
            minWidth: 58,
            minHeight: 58,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt="logo"
              style={{
                // TWO MAXES, deliberately — not a fixed height.
                //
                // A fixed height scales a small mark up, which is tempting: a
                // 16x16 logo otherwise renders at 16x16. It was tried and
                // reverted, because with `height` set the browser only
                // constrains the WIDTH when max-width binds — a 4:1 wordmark
                // came out in a 124x92 box instead of 124x31, and the ring
                // hugged the box, not the mark. That trades the one property
                // this template is built on for a case CSS can't fix anyway:
                // upscaling an unknown-ratio bitmap either blurs it or breaks
                // the ratio, and there is no third option without measuring the
                // image, which a server-rendered template cannot do.
                //
                // So a small logo renders crisp and small. The ring's own
                // minimum below keeps that looking composed rather than broken.
                maxWidth: 124 * (0.94 + 0.06 * grow),
                maxHeight: 92 * (0.94 + 0.06 * grow),
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <span
              className="font-bold"
              style={{
                fontSize: 27 * grow,
                color: accent,
                letterSpacing: "0.04em",
                lineHeight: 1,
                // Keeps the ring a circle for one initial as well as two.
                minWidth: 46 * grow,
                textAlign: "center",
                display: "block",
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* ── Hairline rule ──────────────────────────────────────────────────── */}
      <div className="self-stretch shrink-0" style={{ width: 1, margin: "20px 0", background: ruleColor }} />

      {/* ── Right: identity above, contact + QR below ───────────────────────
          min-w-0 on every level: without it a long unbroken email or domain
          sets the flex item's min-content width and pushes the QR out of the
          card instead of truncating. */}
      <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ padding: "15px 16px 15px 15px", gap: 8 }}>
        <div className="min-w-0">
          <h2
            className="leading-tight min-w-0"
            style={{
              fontSize: fitName(20 * grow, data.name, 16),
              color: nameColor,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              lineHeight: 1.14,
            }}
          >
            {data.name}
          </h2>

          {data.company ? (
            <p
              className="mt-1 min-w-0 truncate"
              style={{ ...companyFit, color: infoPal.soft, fontWeight: 400 }}
            >
              {data.company}
            </p>
          ) : null}

          {data.title ? (
            <p
              className="mt-1 min-w-0"
              style={{
                fontSize: fitTitle(8.5, data.title),
                color: accent,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                // NOT `truncate`. fitTitle stops shrinking at FIT_FLOOR, and
                // past that point rendered width starts growing with length
                // again — shared.tsx says so in as many words, and requires the
                // caller to be able to wrap. With nowrap, a 90-character title
                // was the one thing on this card that got clipped, and the only
                // clip any of the six templates produced. `titleLoad` already
                // charges a long title against the density budget, so the extra
                // line is paid for.
                overflowWrap: "anywhere",
              }}
            >
              {data.title}
            </p>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-2.5 min-w-0">
          <div className="min-w-0 flex-1">
            <ContactRows data={data} f={f} palette={{ accent, ...infoPal, phoneWeight: 600 }} />
          </div>
          {/* Light QR on a dark card, tinted on a light one — the code itself is
              always dark on light so a scanner never has to invert. */}
          <QR size={qrSize(f) * 0.84} bg={dark ? "#FFFFFF" : "#F1F4F9"} fg={INK} url={data.cardUrl} />
        </div>
      </div>
    </div>
  );
}
