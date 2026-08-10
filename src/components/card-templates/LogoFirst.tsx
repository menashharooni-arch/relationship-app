// LogoFirst — Navy & Mark
// Style: Deep navy card that leads with the company mark on the left, a hairline
// rule, then name, title and contact details spread down the right.
// Includes: Logo (hero), name, title, company, phone, email, website, address, QR
// Best for: firms that lead with a brand mark rather than a face — agencies,
// practices, contractors, funds, anyone whose logo is the recognisable thing.

import React from "react";
import { MiniQR as QR } from "./MiniQR";
import type { CardData } from "./types";
import {
  cardAspect, ContactRows, fitFactor, fitName, fitTitle, fitCompany, heroGrow,
  qrSize, templateStyle, CARD_BASE_FONT, isDarkBg, infoPaletteFrom,
} from "./shared";

const NAVY   = "#2C3A52";
const INK    = "#141B26";
const PANEL  = 0.33; // left panel share of the card width

/** Perceived brightness (YIQ), 0-255. Null for anything unparseable. */
function yiq(hex?: string | null): number | null {
  const m = (hex || "").match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

function rgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/**
 * Keep the owner's accent, and make it READ.
 *
 * The accent draws the job title and the contact icons, so a shade too close to
 * the background disappears — and both the ground and the accent are chosen from
 * preset lists that each contain light and dark options, so the collision is an
 * ordinary thing to do, not a crafted one.
 *
 * This used to answer that by DISCARDING the choice and reverting to white. A
 * probe across the template's own preset list found three of its eight accents
 * doing visibly nothing when picked — teal, crimson and ink on the default navy
 * — which is the worst possible answer: the control is offered, the owner uses
 * it, and the card doesn't change. So the colour is now pushed along its own
 * hue, toward the light or dark end, until it clears the threshold. You get the
 * crimson you asked for, at a crimson that can be seen.
 */
function readableAccent(accent: string | undefined, bg: string, dark: boolean): string {
  const fallback = dark ? "#FFFFFF" : NAVY;
  if (!accent) return fallback;
  const b = yiq(bg);
  const parts = rgb(accent);
  if (b === null || !parts) return fallback;

  let [r, g, bl] = parts;
  // Toward white on a dark card, toward black on a light one — the direction
  // that gains contrast against THIS ground.
  const target = dark ? 255 : 0;
  for (let i = 0; i < 12; i++) {
    const y = (r * 299 + g * 587 + bl * 114) / 1000;
    if (Math.abs(y - b) >= 60) break;
    r += (target - r) * 0.16;
    g += (target - g) * 0.16;
    bl += (target - bl) * 0.16;
  }
  const out = `#${hex2(r)}${hex2(g)}${hex2(bl)}`;
  const y = yiq(out);
  // If twelve steps still couldn't separate them, the two really are the same
  // colour; only then fall back.
  return y !== null && Math.abs(y - b) >= 55 ? out : fallback;
}

/**
 * The accent, made safe to print a QR code in.
 *
 * A QR is the only thing on the card with a job beyond looking right, so this
 * is deliberately stricter than readableAccent: scanners need a wide luminance
 * gap between the dark modules and the quiet zone, and a pale accent on a pale
 * square is a code that phones stop reading. The colour is DARKENED along its
 * own hue until it clears the QR's background by 130 (out of 255) — so a teal
 * accent gives a deep-teal code rather than being thrown away — and only if
 * darkening cannot get there does it fall back to ink.
 */
function qrInk(accent: string, qrBg: string): string {
  const bgY = yiq(qrBg);
  const parts = rgb(accent);
  if (bgY === null || !parts) return INK;
  let [r, g, b] = parts;
  for (let i = 0; i < 14; i++) {
    if (Math.abs((r * 299 + g * 587 + b * 114) / 1000 - bgY) >= 130) break;
    r *= 0.82; g *= 0.82; b *= 0.82;
  }
  const out = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  const y = yiq(out);
  return y !== null && Math.abs(y - bgY) >= 125 ? out : INK;
}

export default function LogoFirst({ data }: { data: CardData }) {
  const style = templateStyle(data);
  const bg = style.bgColor ?? NAVY;
  const dark = isDarkBg(bg);
  const accent = readableAccent(style.accentColor, bg, dark);
  const nameColor = style.textColor ?? (dark ? "#FFFFFF" : INK);
  // The light palette was two steps too pale: on Bone, the address rendered at
  // #7A8AA3 over #F4F2ED and all but vanished. Every tone here now sits at a
  // contrast a printed card would actually hold.
  const infoPal = style.infoColor
    ? infoPaletteFrom(style.infoColor)
    : dark
      ? { strong: "#FFFFFF", mid: "#E6EBF3", soft: "#C2CCDC", muted: "#A6B2C6" }
      : { strong: INK, mid: "#233047", soft: "#3E4C63", muted: "#55637C" };

  // The QR follows the ground instead of being a pale-blue sticker on it. It was
  // hard-coded to #EEF2F8 on navy, which is fine on navy and wrong on forest,
  // oxblood and bone — the three grounds the picker offers alongside it.
  const qrBg = dark ? "#F2F4F7" : "#FFFFFF";
  // ...and its PATTERN follows the accent, so the control that colours the
  // icons colours the code too. It stays light-on-dark-modules and is darkened
  // until it clears the background by a wide margin: a QR is the one thing on
  // the card with a job beyond looking right, and a pale pattern on a pale
  // square is a code that phones stop reading. Past what darkening can fix it
  // falls back to ink rather than shipping something unscannable.
  const qrFg = qrInk(accent, qrBg);

  const initials =
    data.initials ??
    (data.company || data.name || "").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const f = fitFactor(data);
  const grow = heroGrow(f);
  const ruleColor = dark ? "rgba(255,255,255,0.20)" : "rgba(20,27,38,0.14)";

  // Company sits under the name as a single line and truncates, so a long one is
  // SHRUNK to fit rather than cut. The contact block now spans the full column
  // (the QR moved to its own row), so the width to budget is the column itself.
  // Floored at 6.5px. fitCompany's own floor is `base * FIT_FLOOR`, and this
  // template passes the smallest base of the six (11), so its floor landed at
  // 5.1px — a 55-character company name rendered present and unreadable. The
  // line is `truncate`, so past the floor it ends in an ellipsis instead, which
  // says "there is more of this" rather than pretending to show all of it.
  const rawCompanyFit = fitCompany(11, data.company, 26, 210, 0, false);
  const companyFit = { ...rawCompanyFit, fontSize: Math.max(6.5, rawCompanyFit.fontSize) };

  // The tile's edge. It is the only thing separating a logo whose own background
  // matches the card — a navy mark on a navy card — from the card itself.
  const tileEdge = dark ? "rgba(255,255,255,0.16)" : "rgba(20,27,38,0.14)";

  /**
   * A single unbroken token has no good break point, so size it to the column.
   *
   * fitName shrinks by the longest WORD but floors at half the base, and it
   * doesn't know about the uppercase tracking this template sets — so a 34
   * character surname landed at the floor, still ~9px wider than the column,
   * and `overflowWrap: anywhere` did the only thing left to it and broke the
   * name in half. Sizing by the column instead keeps the name whole.
   * Derived from PANEL rather than typed in, so the two move together.
   */
  const NAME_COL = 460 * (1 - PANEL) - 31;
  const fitUnbroken = (base: number, text: string | null | undefined, perChar: number) => {
    const s = (text ?? "").trim();
    if (!s || /\s/.test(s)) return base;
    return Math.max(7, Math.min(base, NAME_COL / (s.length * perChar)));
  };

  return (
    <div
      className="sc-card relative w-full flex rounded-2xl overflow-hidden"
      style={{
        aspectRatio: cardAspect(data),
        background: bg,
        fontFamily: style.fontFamily ?? CARD_BASE_FONT,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Left: the mark ───────────────────────────────────────────────────
          The container SHRINK-WRAPS the image and CLIPS to its own radius, so a
          3:1 wordmark stays a 3:1 tile and a crest stays square.

          It carries no fill, and that is the whole point. Every logo real users
          have uploaded is an OPAQUE RECTANGLE — not one has an alpha channel —
          so the previous fully-round border could only ever be a rectangle with
          its corners punching through a circle. Clipping rounds the logo's own
          corners instead, which needs no knowledge of what is inside it.

          A white FILL was tried and reverted: it makes opaque logos look right
          but renders a transparent white-ink PNG — the file someone uploads
          precisely because their card is dark — as a blank rectangle, with no
          fallback able to fire because the image loaded successfully.

          All of it has to be pure CSS: card templates are SERVER-RENDERED and
          must never use a hook, so the image cannot be measured or sampled. */}
      {/* A TINTED panel, not a bare third of the card.
          At 36% wide with no surface of its own, the mark floated in an empty
          quarter of the card and the whole left side read as something that had
          failed to load. One step off the ground — lighter on a dark card,
          darker on a light one — costs nothing, works on every ground the
          picker offers, and makes the space deliberate. */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{
          width: `${PANEL * 100}%`,
          padding: "14px 12px 14px 15px",
          background: dark ? "rgba(255,255,255,0.045)" : "rgba(20,27,38,0.035)",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: `0 0 0 1px ${tileEdge}`,
            maxWidth: "100%",
            maxHeight: "100%",
            // These two are load-bearing, not cosmetic. The tile shrink-wraps its
            // content while capping at 100% of the panel, so an image with no
            // intrinsic size — an SVG carrying only a viewBox — makes the box's
            // height depend on the image and the image's height depend on the
            // box. That cycle resolves to ZERO and the logo vanishes entirely;
            // it is what tests/render/card-logo.test.ts caught the moment these
            // were dropped. A floor breaks the cycle, and doubles as the reason
            // an undersized file still gets a tile with presence.
            minWidth: 54,
            minHeight: 54,
          }}
        >
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt="logo"
              style={{
                // Two maxes, never a fixed height: with `height` set the browser
                // only constrains the WIDTH when max-width binds, so a 3:1
                // wordmark lands in a square box and the tile stops matching the
                // mark. A small file therefore renders small and crisp rather
                // than upscaled and blurry.
                // Bigger than it was: the mark is the thing this template is
                // named for, and it was rendering at about half the height the
                // panel could give it.
                maxWidth: 134 * (0.94 + 0.06 * grow),
                maxHeight: 116 * (0.94 + 0.06 * grow),
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <span
              className="font-bold"
              style={{
                fontSize: 26 * grow,
                color: accent,
                letterSpacing: "0.04em",
                lineHeight: 1,
                display: "block",
                padding: "20px 24px",
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* ── Hairline rule ──────────────────────────────────────────────────── */}
      <div className="self-stretch shrink-0" style={{ width: 1, margin: "20px 0", background: ruleColor }} />

      {/* ── Right: identity, details, QR — spread top to bottom ──────────────
          `justify-between`, the same as every other template, so the card uses
          its full height instead of pooling everything in the middle.

          The QR sits in its OWN bottom row rather than beside the contact rows.
          That is not cosmetic: sharing a row with the QR left the contact column
          ~176px on a 460px card, which split "Board.LevLev@gmai / l.com" across
          two lines and let a phone's "MOBILE" label slide underneath the code.
          On its own row the block gets the full column and both defects go. */}
      <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ padding: "16px 16px 14px 15px" }}>
        <div className="min-w-0">
          <h2
            className="leading-tight min-w-0"
            style={{
              // 0.78 per char: uppercase, plus the 0.03em tracking below, at the
              // widest of the faces the picker offers (Georgia).
              fontSize: fitUnbroken(fitName(23 * grow, data.name, 16), data.name, 0.78),
              color: nameColor,
              fontWeight: 600,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              overflowWrap: "anywhere",
              lineHeight: 1.12,
            }}
          >
            {data.name}
          </h2>

          {/* Name, TITLE, then company — the order every other template uses,
              and the order a person reads an introduction in. This one had the
              company between the name and the job, which put the quietest line
              in the middle of the loudest two. */}
          {data.title ? (
            <p
              className="mt-1 min-w-0"
              style={{
                // 0.14em tracking makes the title the widest-per-character line
                // on the card, so an unbroken one needs the same clamp.
                //
                // Floored at 6.5px, the same floor the render suite holds the
                // company name to. fitTitle shrinks by length with no floor of
                // its own, so a 73-character title came out at 3.5px — present,
                // technically un-clipped, and completely unreadable. It has
                // `overflowWrap: anywhere` below, so past the floor it wraps to
                // a second line instead, which is what a printer would do.
                fontSize: Math.max(6.5, fitUnbroken(fitTitle(9, data.title), data.title, 0.86)),
                color: accent,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                // NOT `truncate`: fitTitle stops shrinking at its floor and past
                // that point rendered width grows with length again, so a nowrap
                // title is the one thing on this card that could still be cut.
                overflowWrap: "anywhere",
              }}
            >
              {data.title}
            </p>
          ) : null}

          {data.company ? (
            <p className="mt-1 min-w-0 truncate" style={{ ...companyFit, color: infoPal.soft, fontWeight: 400 }}>
              {data.company}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <ContactRows data={data} f={f} palette={{ accent, ...infoPal, phoneWeight: 700 }} />
        </div>

        {/* Same shape, size and corner as every other template's QR: its own
            bottom-right row at the shared qrSize, tinted to the card's palette
            rather than left a stark white sticker. */}
        <div className="flex items-end justify-end">
          <div className="flex flex-col items-end gap-1">
            <QR size={qrSize(f)} bg={qrBg} fg={qrFg} url={data.cardUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
