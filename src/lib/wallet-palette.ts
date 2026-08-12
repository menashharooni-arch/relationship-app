// ── One palette for every card the product can produce ──────────────────────
//
// The Wallet pass copies the card's colours. "The card" is not one thing: six
// preset templates with baked-in palettes, any of those with Pro style
// overrides on top, a custom block layout with its own two-tone surface, and a
// design-transfer card that is nothing but an image. This module flattens all
// of them into ONE small shape the strip renderer and the pass chrome both
// read, so there is exactly one place where "what colour is this card" is
// decided.
//
// Pure — no I/O, no React — so the whole matrix is unit-testable in plain node.
// (The one input it cannot derive from data, a design-transfer face image, is
// sampled by the caller and passed in as `sampled`.)

import type { ResolvedCardMeta } from "@/lib/resolve-card";

type Meta = NonNullable<ResolvedCardMeta>;

/** Which band composition a template WANTS, before content availability. */
export type BandPrefer = "portrait" | "mark" | "type";

export type PassPalette = {
  /** Band surface. Top and bottom of a vertical ramp; equal for a flat fill. */
  top: string;
  /**
   * The colour the band ENDS on. The pass's backgroundColor is set to exactly
   * this, which is the whole trick behind the design: strip image and Apple's
   * chrome become one continuous surface with no seam across the pass.
   */
  bottom: string;
  /** Primary text on that surface — guaranteed to contrast with it. */
  ink: string;
  /** Secondary text. Same hue, stepped back. */
  inkMuted: string;
  /** Rules, the accent bar, field labels. Falls back to ink when it can't be seen. */
  accent: string;
  /** True when the surface is dark enough to carry the white SwiftCard wordmark. */
  darkChrome: boolean;
  prefer: BandPrefer;
  /** Typographic personality, carried from the template. See VOICE below. */
  voice: Voice;
};

/**
 * How the template sets type — the part of a card's character that survives
 * into a 375×123pt band.
 *
 * NOT the typeface. next/og renders with its own bundled font and no card font
 * file is available server-side, so honouring `fontFamily` would silently
 * fall back to the same sans for every card while claiming otherwise. Case,
 * tracking and weight do carry, and they are most of what separates Luxury
 * Minimal from Modern Bold at a glance.
 */
export type Voice = {
  caps: boolean;
  /** em, applied to the name. */
  tracking: number;
  weight: 600 | 700 | 800;
  /** A hairline under the name, in the accent. */
  rule: boolean;
};

const VOICE_BOLD: Voice = { caps: false, tracking: -0.01, weight: 800, rule: false };
const VOICE_PLAIN: Voice = { caps: false, tracking: 0, weight: 700, rule: true };
const VOICE_REFINED: Voice = { caps: false, tracking: 0.02, weight: 600, rule: true };
const VOICE_STAMPED: Voice = { caps: true, tracking: 0.05, weight: 600, rule: false };

// ── Colour maths ────────────────────────────────────────────────────────────

const HEX = /#([0-9a-f]{6})\b/gi;

/** Every #rrggbb in a colour or gradient string, in source order. */
export function hexStops(css: string | null | undefined): string[] {
  if (!css) return [];
  return (css.match(HEX) ?? []).map((h) => h.toLowerCase());
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

/** Perceived brightness, 0–255. Same YIQ curve the card renderers use. */
export function yiq(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Apple wants rgb(r, g, b) in pass.json, not #rrggbb. */
export function toAppleRgb(hex: string): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

const WHITE = "#ffffff";
const NEAR_BLACK = "#10151f";

/**
 * Text that can actually be read on `surface`.
 *
 * The preferred colour is kept whenever it separates from the ground; below
 * that it is replaced outright rather than nudged, because a card whose owner
 * set white text on a white background override (reachable in the editor, and
 * present on real cards) needs a different colour, not a lighter one.
 *
 * Threshold is deliberately higher than the accent's: body text failing is
 * worse than a hairline failing.
 */
export function readableInk(surface: string, preferred?: string): string {
  const ground = yiq(surface);
  if (preferred && hexStops(preferred).length) {
    const p = hexStops(preferred)[0];
    if (Math.abs(yiq(p) - ground) >= 60) return p;
  }
  return ground < 150 ? WHITE : NEAR_BLACK;
}

/**
 * The accent, or the ink when the accent would vanish.
 *
 * Same rule and same 26-point threshold as CustomCard's `ramp()` — the pass
 * must not "fix" an accent the card itself already suppressed, or the two
 * surfaces disagree about the card's own colour.
 */
export function readableAccent(surface: string, ink: string, accent?: string | null): string {
  const stops = hexStops(accent);
  if (!stops.length) return ink;
  const a = stops[0];
  return Math.abs(yiq(a) - yiq(surface)) >= 26 ? a : ink;
}

// ── The six presets, as their cards are actually drawn ──────────────────────
// Surface is each template's BRANDING surface, not necessarily its largest
// area: Classic Pro is mostly white, but the navy panel is what people picture
// when they picture that card, and a white pass would read as no design at all.

type Preset = { top: string; bottom: string; ink: string; accent: string; prefer: BandPrefer; voice: Voice };

const PRESETS: Record<string, Preset> = {
  "modern-bold":    { top: "#0b1428", bottom: "#070d1c", ink: "#f1f5f9", accent: "#3b82f6", prefer: "portrait", voice: VOICE_BOLD },
  "classic-pro":    { top: "#16294a", bottom: "#0e1b35", ink: "#ffffff", accent: "#2563eb", prefer: "portrait", voice: VOICE_PLAIN },
  "photo-first":    { top: "#4f46e5", bottom: "#6d28d9", ink: "#ffffff", accent: "#c4b5fd", prefer: "portrait", voice: VOICE_PLAIN },
  "local-business": { top: "#b45309", bottom: "#92400e", ink: "#ffffff", accent: "#fde68a", prefer: "mark",     voice: VOICE_PLAIN },
  "luxury-minimal": { top: "#fbfbf7", bottom: "#f2f1ea", ink: "#1c1612", accent: "#b08d57", prefer: "type",     voice: VOICE_REFINED },
  "logo-first":     { top: "#2c3a52", bottom: "#141b26", ink: "#ffffff", accent: "#93a7c4", prefer: "mark",     voice: VOICE_STAMPED },
};

/** Cards with no template, or a template name we no longer ship. */
const FALLBACK: Preset = { top: "#16294a", bottom: "#0d1b3e", ink: "#ffffff", accent: "#60a5fa", prefer: "portrait", voice: VOICE_PLAIN };

// ── The resolver ────────────────────────────────────────────────────────────

/** A colour sampled from a design-transfer face image, when the caller has one. */
export type SampledSurface = { top: string; bottom: string };

export function passPalette(meta: Meta, sampled?: SampledSurface | null): PassPalette {
  const base = resolveSurface(meta, sampled);

  // Contrast is enforced against the DARKER end of the ramp for light text and
  // the lighter end for dark text — checking only one end lets a steep
  // gradient (Photo First's indigo→violet) pass the test at the top and fail
  // it at the bottom, which is exactly where the name sits.
  const worstForInk = yiq(base.top) < yiq(base.bottom) ? base.bottom : base.top;
  const ink = readableInk(worstForInk, base.ink);
  const midpoint = mix(base.top, base.bottom, 0.5);

  return {
    top: base.top,
    bottom: base.bottom,
    ink,
    // Stepped toward the surface rather than dropped to an alpha, so it stays
    // legible over a gradient instead of thinning out at the light end.
    inkMuted: mix(ink, midpoint, 0.28),
    accent: readableAccent(midpoint, ink, base.accent),
    darkChrome: yiq(midpoint) < 150,
    prefer: base.prefer,
    voice: base.voice,
  };
}

function resolveSurface(meta: Meta, sampled?: SampledSurface | null): Preset {
  const custom = meta.custom;

  // 1. Design transfer — the card is a picture, so the only honest source for
  //    its colour is the picture itself. Structure still comes from the card's
  //    data, so the band is composed, never a crop of the face (a 1.75:1 card
  //    cover-cropped into a 3.05:1 band cuts the owner's own information off).
  if (custom?.faceImage && sampled) {
    const ink = readableInk(sampled.bottom, custom.panelTextColor ?? custom.textColor);
    return {
      top: sampled.top,
      bottom: sampled.bottom,
      ink,
      accent: custom.accentColor ?? ink,
      prefer: "portrait",
      voice: VOICE_PLAIN,
    };
  }

  // 2. A custom block layout. The PANEL is the branding surface when there is
  //    one — that is the whole point of two-tone in the designer — and its own
  //    text colour comes with it.
  if (custom) {
    const surfaceCss = custom.panelBackground ?? custom.background;
    const stops = hexStops(surfaceCss);
    const top = stops[0] ?? "#141b26";
    const bottom = stops.length > 1 ? stops[stops.length - 1] : top;
    const inkPref = custom.panelBackground ? (custom.panelTextColor ?? custom.textColor) : custom.textColor;
    const ink = readableInk(bottom, inkPref);
    return { top, bottom, ink, accent: custom.accentColor ?? ink, prefer: "portrait", voice: VOICE_PLAIN };
  }

  // 3. A preset template, plus any Pro overrides on top of it.
  const preset = PRESETS[meta.template ?? ""] ?? FALLBACK;
  const style = meta.style ?? {};
  const bgStops = hexStops(style.bgColor);
  const top = bgStops[0] ?? preset.top;
  const bottom = bgStops.length > 1 ? bgStops[bgStops.length - 1] : (bgStops[0] ?? preset.bottom);

  return {
    top,
    bottom,
    ink: hexStops(style.textColor)[0] ?? preset.ink,
    // `accentColor` lives on customization for every card, preset or not, and
    // is the one style field the free plan can set — so it overrides last.
    accent: hexStops(style.accentColor)[0] ?? hexStops(meta.accentColor)[0] ?? preset.accent,
    prefer: preset.prefer,
    voice: preset.voice,
  };
}
