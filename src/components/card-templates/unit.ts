// ─── The card design unit ────────────────────────────────────────────────────
//
// Everything inside a card is measured in DESIGN PIXELS — px at
// CARD_DESIGN_WIDTH — rather than real px, so the whole design scales with the
// card instead of spilling out of it when the card is narrow. The card root sets
// aspectRatio, so a narrow card is also SHORT; fixed px type kept its full size,
// outgrew the box, and got silently clipped by overflow-hidden. The `.sc-card`
// block in globals.css defines --sc-u and explains the mechanism.
//
// Its own module rather than part of shared.tsx: MiniQR needs it, and MiniQR was
// deliberately split out so that importing a QR code doesn't drag the `qrcode`
// encoder — or, now, the whole shared icon/palette module — into bundles that
// never render a card.

/** The width a card's numbers are authored at. Matches CardScaler's NATURAL. */
export const CARD_DESIGN_WIDTH = 460;

/**
 * `n` design pixels as a CSS length.
 *
 * The 1px fallback is load-bearing, not defensive: card FRAGMENTS render outside
 * any .sc-card (the custom-card designer canvas, MiniQR on the marketing site)
 * and there --sc-u is undefined. Without a fallback the whole calc() would be
 * invalid at computed-value time and the property would fall back to its initial
 * value — `width: auto` on a QR code. With it, those callers simply get real px,
 * exactly what they got before.
 */
export function u(n: number): string {
  // Round hard: fitPx/fitName return long fractions, and a 17-digit number in
  // every calc() would bloat the server-rendered HTML for no visible gain.
  return `calc(var(--sc-u, 1px) * ${Math.round(n * 1000) / 1000})`;
}
