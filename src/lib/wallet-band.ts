import type { PassPalette } from "@/lib/wallet-palette";

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
 * The band's surface: a vertical ramp, never an angled one.
 *
 * The pass's backgroundColor is set to `bottom`, and only a 180deg gradient
 * puts that exact colour across the whole bottom edge — at any angle the
 * corners land on a different mix and a visible seam appears where the strip
 * meets Apple's chrome.
 */
export function bandBackground(palette: Pick<PassPalette, "top" | "bottom">): string {
  return palette.top === palette.bottom
    ? palette.top
    : `linear-gradient(180deg, ${palette.top} 0%, ${palette.bottom} 100%)`;
}
