// Brand marks and colour safety for the public card's Swift Links section.
//
// Pure and dependency-free so it can be unit-tested and used from both a server
// component and a client one.

/** Normalize a possibly-schemeless user-entered URL into something parseable. */
function toUrl(raw: string): URL | null {
  const v = (raw || "").trim();
  if (!v) return null;
  const withScheme = /^(https?:)?\/\//i.test(v) ? v.replace(/^\/\//, "https://") : `https://${v.replace(/^[a-z][a-z0-9+.-]*:\/*/i, "")}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * The host as a human trust signal: lowercased, no "www.", no path.
 * This is the line under a feature link's label — on a professional's card the
 * visitor is checking "is this the real org", so the domain earns its own row.
 */
export function hostLabel(url: string): string {
  const u = toUrl(url);
  if (!u) return "";
  return u.hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * A link's favicon, derived from its hostname alone.
 *
 * Deliberately NOT /api/link-preview: that route is a Node-runtime scrape with a
 * 5s abort, a per-instance cache that is cold on every fresh lambda, and an
 * IP rate limit a single conference NAT would exhaust. This page is opened on
 * mobile data seconds after a QR scan, so the section must cost zero first-party
 * requests. Same service and size the scrape route itself falls back to.
 */
export function faviconFor(url: string): string | null {
  const u = toUrl(url);
  if (!u) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=128`;
}

/** Single uppercase letter for the monogram shown until (or instead of) a favicon. */
export function monogramFor(url: string): string {
  const host = hostLabel(url);
  const first = host.replace(/[^a-z0-9]/gi, "").charAt(0);
  return (first || "?").toUpperCase();
}

// Muted editorial gradients chosen FOR cream — every stop is dark enough to
// carry white type at AA. Deliberately not the /links page's neon set, which is
// tuned for a near-black background and reads as a party flyer here.
const TINTS = [
  "linear-gradient(135deg, #1E3A8A 0%, #3B4FA8 100%)", // indigo ink
  "linear-gradient(135deg, #14532D 0%, #2F6B4F 100%)", // forest
  "linear-gradient(135deg, #7C2D12 0%, #B45309 100%)", // clay
  "linear-gradient(135deg, #4C1D3F 0%, #7E2A5A 100%)", // plum
  "linear-gradient(135deg, #0F3D3E 0%, #1F6F6B 100%)", // deep teal
  "linear-gradient(135deg, #1E293B 0%, #3E4C63 100%)", // slate navy
];

/**
 * Stable tint for a link's monogram, hashed from the HOSTNAME.
 *
 * Hostname, not array index: indexing by position means reordering links
 * reshuffles every colour on the card (a real defect in SwiftLinkButtons). Keyed
 * on the host, the same domain is always the same colour, forever.
 */
export function monogramTint(url: string): string {
  const host = hostLabel(url);
  if (!host) return TINTS[0];
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Perceived brightness (YIQ) of a #rrggbb colour, 0-255. */
function yiq(hex: string): number | null {
  const m = (hex || "").match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** The page's own blue — the fallback whenever an accent can't be used as a fill. */
export const DEFAULT_ACCENT = "#1D4ED8";

/**
 * The owner's accent, guaranteed usable as a filled plate behind text.
 *
 * This is mandatory, not defensive noise. modern-bold's accent presets include
 * "#ffffff" and "#fbbf24" (template-style-presets.ts), and plan.ts SNAPS a Free
 * card's saved accent onto that list via nearestPreset — so a near-white accent
 * is a real value on real cards, and filling the section's primary button with
 * it would render an invisible control. Anything brighter than 225 falls back to
 * the page blue; everything else is kept and paired with dark ink by the caller.
 */
export function safeAccent(accent?: string | null): string {
  const hex = (accent || "").trim();
  const y = yiq(hex);
  if (y === null) return DEFAULT_ACCENT;
  if (y > 225) return DEFAULT_ACCENT;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

/** Ink that stays legible on a given fill. Mirrors template-style's YIQ < 150. */
export function inkOn(fill: string): string {
  const y = yiq(fill);
  return y !== null && y < 150 ? "#FFFFFF" : "#0F172A";
}

/**
 * The fill behind a platform's glyph. Instagram is the only platform whose brand
 * is a gradient rather than a flat colour.
 *
 * Shared by the /links page's circles and the card page's disc rail so the two
 * surfaces can never disagree about what Instagram looks like.
 */
export function brandBackground(label: string, color?: string): string {
  if (label === "Instagram") {
    return "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)";
  }
  return color || "rgba(255,255,255,0.1)";
}

/** Normalize a user-entered link for use as an href. Matches the existing rule. */
export function fullHref(url: string): string {
  const v = (url || "").trim();
  if (!v) return "#";
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^[a-z][a-z0-9+.-]*:\/*/i, "")}`;
}
