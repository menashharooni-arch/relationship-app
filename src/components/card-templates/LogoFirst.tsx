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
  qrSize, templateStyle, isDarkBg, infoPaletteFrom,
} from "./shared";

const NAVY   = "#2C3A52";
const INK    = "#141B26";
const PANEL  = 0.36; // left panel share of the card width

/** Perceived brightness (YIQ), 0-255. Null for anything unparseable. */
function yiq(hex?: string | null): number | null {
  const m = (hex || "").match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

/**
 * The accent draws the title and the contact icons, so a shade too close to the
 * background disappears. Both the background and the accent are owner-chosen and
 * both preset lists contain light and dark options, so the collision is
 * reachable in normal use rather than only by a crafted value.
 */
function safeAccent(accent: string | undefined, bg: string, dark: boolean): string {
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
  const accent = safeAccent(style.accentColor, bg, dark);
  const nameColor = style.textColor ?? (dark ? "#FFFFFF" : INK);
  const infoPal = style.infoColor
    ? infoPaletteFrom(style.infoColor)
    : dark
      ? { strong: "#FFFFFF", mid: "#E6EBF3", soft: "#C2CCDC", muted: "#A6B2C6" }
      : { strong: INK, mid: "#2C3A52", soft: "#5A6B85", muted: "#7A8AA3" };

  const initials =
    data.initials ??
    (data.company || data.name || "").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const f = fitFactor(data);
  const grow = heroGrow(f);
  const ruleColor = dark ? "rgba(255,255,255,0.20)" : "rgba(20,27,38,0.14)";

  // Company sits under the name as a single line and truncates, so a long one is
  // SHRUNK to fit rather than cut. The contact block now spans the full column
  // (the QR moved to its own row), so the width to budget is the column itself.
  const companyFit = fitCompany(11, data.company, 26, 210, 0, false);

  // The tile's edge. It is the only thing separating a logo whose own background
  // matches the card — a navy mark on a navy card — from the card itself.
  const tileEdge = dark ? "rgba(255,255,255,0.16)" : "rgba(20,27,38,0.14)";

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
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: `${PANEL * 100}%`, padding: "16px 12px 16px 17px" }}
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
                maxWidth: 126 * (0.94 + 0.06 * grow),
                maxHeight: 96 * (0.94 + 0.06 * grow),
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
              fontSize: fitName(23 * grow, data.name, 16),
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

          {data.company ? (
            <p className="mt-1 min-w-0 truncate" style={{ ...companyFit, color: infoPal.soft, fontWeight: 400 }}>
              {data.company}
            </p>
          ) : null}

          {data.title ? (
            <p
              className="mt-1 min-w-0"
              style={{
                fontSize: fitTitle(9, data.title),
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
        </div>

        <div className="min-w-0">
          <ContactRows data={data} f={f} palette={{ accent, ...infoPal, phoneWeight: 700 }} />
        </div>

        {/* Same shape, size and corner as every other template's QR: its own
            bottom-right row at the shared qrSize, tinted to the card's palette
            rather than left a stark white sticker. */}
        <div className="flex items-end justify-end">
          <div className="flex flex-col items-end gap-1">
            <QR size={qrSize(f)} bg="#EEF2F8" fg={NAVY} url={data.cardUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
