import type { BandSurface, PassPalette } from "@/lib/wallet-palette";

// ── The band's geometry, in one place ───────────────────────────────────────
//
// The real pass strip is rendered server-side by Satori (wallet-strip.tsx) and
// the marketing/preview surfaces draw the same band in the DOM. Those are two
// renderers for one design, and the only way they stay identical is by reading
// the SAME numbers — so the numbers live here, in a module with no next/og, no
// sharp and no React, which either side can import.
//
// Everything is expressed at @3x (the size Satori renders at) plus a ratio, so
// a DOM copy at any width is the same design scaled rather than a redrawing of
// it by eye.

/** Satori canvas. 375×144pt at @3x — see wallet-strip.tsx for why 144, not 123. */
export const BAND_W = 1125;
export const BAND_H = 432;

/** Asymmetric lead-in: the left edge carries the mark, so it gets more room. */
export const PAD_LEFT = 108;
export const PAD_RIGHT = 72;
/** Photo diameter and logo box height. */
export const IMG = 241;
export const GAP = 46;

/** Type scale, @3x px. */
export const NAME_BASE = 84, NAME_MIN = 34;
export const TITLE_BASE = 33, TITLE_MIN = 21;
export const COMPANY_BASE = 31, COMPANY_MIN = 20;

/**
 * Card design px → band content px (@3x), for the rules and shadows drawn
 * WITH the type. The band sets the name at NAME_BASE where Classic Pro's card
 * sets it at 24px, so a rule drawn beside it scales by the same ratio — at the
 * surface's width ratio (~2.4) a 2px rule under an 84px name reads as a
 * scratch rather than the card's accent.
 */
export const CONTENT_SCALE = NAME_BASE / 24;

/** Width left for the name/title/company column beside a lead square. */
export const IDENTITY_W = (leadWidth: number) =>
  BAND_W - PAD_LEFT - PAD_RIGHT - (leadWidth ? leadWidth + GAP : 0);

/** Band aspect — height as a fraction of width. */
export const BAND_ASPECT = BAND_H / BAND_W;

/**
 * Scale an @3x band measurement to a DOM pixel width.
 *
 * `bandPx(240, IMG)` = how wide the lead square is when the band is 240px
 * across. Every size in the DOM copy goes through this, so nothing is ever a
 * hand-tuned number that can drift from the pass people actually download.
 */
export const bandPx = (widthPx: number, at3x: number) => (widthPx / BAND_W) * at3x;

export type BandVariant = "portrait" | "mark";

/**
 * What the band can actually lead with, given this card's assets.
 *
 * The template states a preference; the content decides whether it can be
 * honoured. A logo-led template with no logo falls to a portrait (initials, if
 * there is no headshot either) rather than rendering an empty box — the one
 * outcome worse than a different layout is a hole where the mark should be.
 */
export function bandVariant(prefer: PassPalette["prefer"], hasPhoto: boolean, hasLogo: boolean): BandVariant {
  if (prefer === "type") return "mark";
  if (prefer === "mark") return hasLogo || !hasPhoto ? "mark" : "portrait";
  return hasPhoto || !hasLogo ? "portrait" : "mark";
}

/** Up to two initials, or "SC" when there is nothing to take them from. */
export function initialsOf(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "SC";
  return s.split(/\s+/).map((n) => Array.from(n)[0] ?? "").join("").toUpperCase().slice(0, 2) || "SC";
}

/**
 * The band's base colour — the card's own panel colour or gradient.
 *
 * On a single-surface card it is a vertical ramp (wallet-palette's
 * verticalRamp): the pass's backgroundColor is the ramp's last stop, and only
 * a 180deg gradient puts that exact colour across the whole bottom edge. On a
 * two-tone card the body is a different surface anyway, so the card's own
 * angle is kept.
 */
export function bandBackground(palette: Pick<PassPalette, "surface">): string {
  return palette.surface.base;
}

// ── The band's surface, as layers ───────────────────────────────────────────
//
// The card paints its panel as a colour, a photo, a finish (Linen, Carbon…)
// and the template's own texture. Both renderers — Satori for the real strip,
// the DOM for the marketing preview — paint the band from THIS list, so the
// texture on the pass and on the preview cannot be two interpretations.

/** The width the card templates are designed at. Surface sizes are in these px. */
export const CARD_W = 460;

/**
 * Every px length in a CSS value, multiplied by k.
 *
 * A finish is written for the 460px card; on a band `w` px wide the same
 * weave has to be drawn at w/460 of that, or Linen comes out as a fine mesh
 * on the pass and a coarse one on the card.
 */
export function scalePx(css: string, k: number): string {
  return css.replace(/(-?\d*\.?\d+)px/g, (_, n: string) => `${+(parseFloat(n) * k).toFixed(3)}px`);
}

type Css = Record<string, string | number>;

export type PaintLayer =
  | { kind: "fill"; style: Css }
  /** The panel photo. Each renderer draws its own <img> — Satori needs it
   *  pre-cropped and inlined, the DOM can cover-fit a URL. */
  | { kind: "media"; url: string };

/**
 * The band's surface, bottom to top, as absolutely positioned boxes for a band
 * `w` × `h` px. Content is drawn over the last one.
 */
export function surfaceLayers(surface: BandSurface, w: number, h: number): PaintLayer[] {
  const k = w / CARD_W;
  const full: Css = { position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex" };
  const out: PaintLayer[] = [{ kind: "fill", style: { ...full, background: surface.base } }];

  if (surface.media) {
    out.push({ kind: "media", url: surface.media.url });
    if (surface.media.dim > 0) {
      out.push({ kind: "fill", style: { ...full, background: `rgba(0,0,0,${surface.media.dim})` } });
    }
  }

  for (const layer of surface.layers) {
    out.push({
      kind: "fill",
      style: {
        ...full,
        backgroundImage: scalePx(layer.image, k),
        ...(layer.size ? { backgroundSize: scalePx(layer.size, k) } : {}),
      },
    });
  }

  if (surface.glow) {
    const g = surface.glow;
    out.push({
      kind: "fill",
      style: {
        position: "absolute", display: "flex",
        width: g.size * k, height: g.size * k, top: g.top * k, right: g.right * k,
        background: `radial-gradient(circle, ${g.color} 0%, transparent 70%)`,
      },
    });
  }

  if (surface.leadColumn) {
    // Logo First's mark column is a third of the card. On the band that is
    // the lead square and half the gap after it — 33% of the width — so the
    // hairline falls between the mark and the name, where the card has it.
    const col = bandPx(w, PAD_LEFT + IMG + GAP / 2);
    out.push({ kind: "fill", style: { ...full, width: col, background: surface.leadColumn.tint } });
    out.push({
      kind: "fill",
      style: { position: "absolute", display: "flex", left: col, top: 20 * k, width: Math.max(1, k), height: h - 40 * k, background: surface.leadColumn.rule },
    });
  }

  if (surface.edge) {
    out.push({ kind: "fill", style: { ...full, width: surface.edge.width * k, background: surface.edge.background } });
  }

  // A single-surface card's band melts into the pass colour below it. Only
  // when something is drawn over the base — a bare ramp already ends on
  // exactly that colour, and fading it would bend the card's own gradient.
  const decorated = !!surface.media || surface.layers.length > 0 || !!surface.glow || !!surface.leadColumn || !!surface.edge;
  if (surface.fadeTo && decorated) {
    out.push({
      kind: "fill",
      style: { ...full, backgroundImage: `linear-gradient(180deg, ${fadeClear(surface.fadeTo)} 60%, ${surface.fadeTo} 100%)` },
    });
  }

  if (surface.bar) {
    const bh = surface.bar.height * k;
    out.push({ kind: "fill", style: { ...full, top: h - bh, height: bh, background: surface.bar.background } });
  }

  return out;
}

/** The fade colour at zero alpha — `transparent` would fade through black. */
function fadeClear(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
}
