// Pure normalization for the preset-template style overrides (accent color,
// background surface, hero text color, typography). Kept out of the JSX-heavy
// card-templates module so it can be unit-tested in a plain node env and reused
// by both the templates (via shared.tsx re-export) and the editor forms.
//
// Every field is OPTIONAL. A card with none set — which is every card saved
// before this feature — normalizes to all-undefined, so each template falls
// back to its own baked-in design and nothing about existing cards changes.

import type { CardData } from "@/components/card-templates/types";

export type TemplateStyle = {
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  infoColor?: string; // color of the contact/details text (phone, email, address…)
  fontFamily?: string;
};

// Shades of one chosen info color for ContactRows' four levels (phone → address).
export function infoPaletteFrom(color: string): { strong: string; mid: string; soft: string; muted: string } {
  return { strong: color, mid: withAlpha(color, 0.92), soft: withAlpha(color, 0.75), muted: withAlpha(color, 0.62) };
}

// #rrggbb → rgba(...) with the given alpha. Non-hex input is returned as-is.
export function withAlpha(color: string, alpha: number): string {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Treat only non-empty strings as a real override. `null`, `undefined`, and
// `""` (a value the editor may send when a field is cleared) all resolve to
// undefined → the template default.
function pick(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/**
 * The typeface a card uses when its owner has not chosen one.
 *
 * Pinned, and deliberately NOT inherited from the page. Two reasons:
 *
 * 1. The auto-fit logic in card-templates/shared.tsx sizes a company name from
 *    a MEASURED per-character width table (W_UPPER/W_MIXED), and those numbers
 *    are Helvetica/Arial advance widths. Let the card inherit some other face
 *    and the table silently under-measures, so `fitCompany` returns a size that
 *    does not actually fit and `overflowWrap: anywhere` breaks the name
 *    mid-word — "Coastline Realty" rendering as "Coas tlin / e Re alty". That
 *    is exactly what happened when body switched from Arial to Geist.
 * 2. A card is a shared, printed, screenshotted artifact, and it renders in
 *    places the app's webfont does not exist: the render-test harness (no
 *    next/font, so `var(--font-geist-sans)` is undefined) and the OG image
 *    generator. Pinning keeps a card identical everywhere instead of silently
 *    reflowing based on which renderer drew it.
 *
 * This is the exact stack cards already rendered in — body's old value — so
 * fixing the app's font changes no existing card. Owners who pick "Sans" from
 * CARD_FONT_OPTIONS still get Geist; this is only the default.
 *
 * Applied at the point of render (`style.fontFamily ?? CARD_BASE_FONT` on each
 * template root), NOT inside templateStyle(). That function's contract is
 * normalization — undefined means "no override present" — and the editor's
 * swatch selection depends on being able to tell "unset" from "explicitly set
 * to the default".
 */
export const CARD_BASE_FONT = "Arial, Helvetica, sans-serif";

export function templateStyle(data: Pick<CardData, "customization">): TemplateStyle {
  const c = data.customization ?? {};
  return {
    accentColor: pick(c.accentColor),
    bgColor: pick(c.bgColor),
    textColor: pick(c.textColor),
    infoColor: pick((c as { infoColor?: unknown }).infoColor),
    fontFamily: pick(c.fontFamily),
  };
}

// Is a background color/gradient dark enough to need light text on top? Reads
// the first #rrggbb in the string (works for solid colors and gradients) and
// compares its perceived brightness. Unknown/absent color → treated as light.
export function isDarkBg(bg?: string): boolean {
  if (!bg) return false;
  const m = bg.match(/#([0-9a-f]{6})/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Perceived brightness (YIQ). < 150 reads as dark.
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

// Typography choices offered in the editor. One shared list for the control and
// any tests.
//
// "Sans", NOT "Sans (default)". Both consumers (TemplateStyleControls' FontPills
// and SwiftLinkDesign) prepend their own "Default" entry meaning "no override —
// inherit the page", and the page inherits Arial, while this option resolves to
// Geist. So the two really are different typefaces, and calling this one "the
// default" sat next to an actual Default pill claiming the same thing. The
// separate list in CustomCardDesigner keeps its "(default)" suffix: that canvas
// has no Default pill and genuinely does start on this stack (CustomCard.tsx).
export const CARD_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'Courier New', ui-monospace, monospace" },
  { label: "Rounded", value: "'Trebuchet MS', system-ui, sans-serif" },
];
