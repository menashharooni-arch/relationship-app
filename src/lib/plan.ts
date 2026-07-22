// ── Central plan configuration ──────────────────────────────────────────────
// All plan limits, the trial length, and the Pro-only design keys live here so
// nothing drifts. If you change a number, change it HERE — every route and
// component reads from this file.
import { metaForTemplate } from "./template-style-presets";

export const PLAN_LIMITS = {
  FREE_CARD_LIMIT: 1,          // max cards on Free (Pro/Office: unlimited)
  FREE_MAX_LINKS: 2,           // max additional Swift Links (action-link buttons) on Free; Pro/Office: unlimited
  // ── Monthly free meters (refresh on the 1st; counted per-ACCOUNT via
  //    profiles.customization._usage so deleting a card can never reset them).
  FREE_LEADS_PER_MONTH: 5,     // new leads/month before extras soft-lock behind Pro
  FREE_AI_DRAFTS_PER_MONTH: 3, // AI follow-up drafts/month
  // NOTE: the AI business-card scanner is Pro-only (owner decision, Jul 2026) —
  // there is no free scan allowance, so there's no limit constant for it.
  OFFICE_MIN_SEATS: 2,         // minimum seats for the Office plan
} as const;

// Displayed prices on /pricing, in cents (USD) — the ONE source of truth for
// what SwiftCard charges. The checkout route fetches the actual Stripe Price
// object for whatever priceId is requested and refuses to check out if its
// unit_amount doesn't match here, so a mispriced Stripe Product can never
// silently charge someone something different from what they saw on the page.
// Change a number here AND in Stripe's dashboard together — never one without the other.
export const PLAN_PRICES = {
  PRO_MONTHLY_CENTS: 499,               // $4.99/mo
  PRO_ANNUAL_CENTS: 5400,                // $54.00/yr (~$4.50/mo, 10% off monthly)
  OFFICE_MONTHLY_PER_SEAT_CENTS: 399,    // $3.99/mo per seat
  OFFICE_ANNUAL_PER_SEAT_CENTS: 4309,    // $43.09/yr per seat (399 * 12 * 0.9, 10% off)
} as const;

// Internal lead tag: a lead captured beyond the free monthly cap. Stored on the
// lead, hidden from the owner (blurred) until they upgrade — never deleted, and
// unlocked automatically the moment the account is paid.
export const LOCKED_LEAD_TAG = "sc-locked";

// Opt-in Pro trial: when someone SUBSCRIBES to Pro they get this many days
// free first (card collected at checkout; Stripe bills automatically when the
// trial ends unless they cancel). One trial per customer — enforced in the
// checkout route. Free signups get Free only; there is no automatic trial.
// (The legacy comment below describes the discontinued reverse trial; the
// cron that expires old grants still reads this value for those accounts.)
// Legacy: every NEW signup got a full-Pro reverse trial for this many days, then the
// daily cron downgrades them to Free (never touches a real paying subscriber).
export const TRIAL_DAYS = 14;

// Length of one app-level "free month" grant, in days (referral/promo rewards).
export const FREE_MONTH_DAYS = 30;

// Customization keys that are Pro-only design controls. Snapped to the nearest
// Free-safe preset (or dropped, for the legacy `font` key) server-side for
// non-paid accounts so a downgraded or hand-crafted request can't keep an
// arbitrary custom value. (Free baseline customization — about, address, bio,
// socials, testimonials, links up to the cap — is never touched.)
export const PRO_CUSTOMIZATION_KEYS = ["accentColor", "font", "bgColor", "textColor", "infoColor", "fontFamily"] as const;

// Swift Links PAGE design keys ("Social design" step) — deliberately separate
// from the card's design keys above so styling the card never restyles the
// Swift Links page or vice versa (they are different surfaces with different
// looks). Pro-gated the same way: stripped server-side for non-paid accounts.
export const LINK_STYLE_KEYS = ["linkBgColor", "linkTextColor", "linkFontFamily"] as const;

// A paid plan = Pro or Office (enterprise). Office is a superset of Pro.
export function isPaidPlan(plan?: string | null): boolean {
  return plan === "pro" || plan === "enterprise";
}

export function isOfficePlan(plan?: string | null): boolean {
  return plan === "enterprise";
}

// ── Free-tier color matching ─────────────────────────────────────────────────
// Free accounts can restyle a card using the SAME curated Looks/preset swatches
// Pro sees (see template-style-presets.ts + TemplateStyleControls.tsx) — only
// the arbitrary custom-color picker and the fully-custom designer stay Pro-only.
// So a value that isn't one of the current template's presets (a raw Pro custom
// pick, or a value left over from a different template) gets snapped to the
// closest one instead of being deleted outright.

function hexOf(color: string): [number, number, number] | null {
  const m = color.match(/#([0-9a-f]{6})/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Perceptual-ish RGB distance (no need for anything fancier than Euclidean —
// we're picking "closest of ~6 swatches", not doing color science).
function colorDistance(a: string, b: string): number {
  const ca = hexOf(a);
  const cb = hexOf(b);
  if (!ca || !cb) return a === b ? 0 : Infinity;
  return Math.sqrt((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2);
}

// Snap `value` to whichever of `presets` is closest. An exact match passes
// through untouched; `undefined` (never set) stays `undefined` — there's
// nothing to convert, the template's own baked-in default already applies.
export function nearestPreset(value: string | undefined, presets: string[], fallback: string): string | undefined {
  if (value === undefined) return undefined;
  if (presets.includes(value)) return value;
  const pool = presets.length ? presets : [fallback];
  let best = pool[0];
  let bestDist = colorDistance(value, best);
  for (const p of pool.slice(1)) {
    const d = colorDistance(value, p);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best;
}

// Convert a card's customization + template to the closest Free-tier
// equivalent: every Pro-only color key gets snapped to the nearest preset for
// the (possibly downgraded) target template; nothing about the actual card
// CONTENT (name, links, photos, testimonials, address, …) is touched. Returns
// `changed: true` when there was actually something to convert, so callers can
// decide whether to show a "we applied a basic Free design" notice at all.
export function convertCustomizationToFreeClosest(
  customization: Record<string, unknown>,
  template: string | undefined,
): { customization: Record<string, unknown>; template: string; changed: boolean } {
  const cust = { ...customization };
  const hadCustomTemplate = template === "custom";
  const targetTemplate = hadCustomTemplate ? "classic-pro" : template || "classic-pro";
  const meta = metaForTemplate(targetTemplate);

  const hadProKey = PRO_CUSTOMIZATION_KEYS.some((key) => cust[key] !== undefined && cust[key] !== "");
  const changed = hadProKey || hadCustomTemplate;

  const bgColor = pickStr(cust.bgColor);
  const textColor = pickStr(cust.textColor);
  const infoColor = pickStr(cust.infoColor);
  const accentColor = pickStr(cust.accentColor);

  // A fully-custom card has no standard-template style keys to snap — leave
  // the target template's baked-in defaults in place rather than guessing.
  if (!hadCustomTemplate) {
    if (bgColor !== undefined) cust.bgColor = nearestPreset(bgColor, meta.bg.presets, meta.bg.fallback);
    if (textColor !== undefined) cust.textColor = nearestPreset(textColor, meta.text.presets, meta.text.fallback);
    if (infoColor !== undefined) cust.infoColor = nearestPreset(infoColor, meta.info.presets, meta.info.fallback);
    if (accentColor !== undefined) cust.accentColor = nearestPreset(accentColor, meta.accent.presets, meta.accent.fallback);
  } else {
    delete cust.bgColor;
    delete cust.textColor;
    delete cust.infoColor;
    delete cust.accentColor;
    delete cust.customLayout;
  }
  // `fontFamily` is already a closed preset list (CARD_FONT_OPTIONS) with no
  // custom-text-input equivalent, so the picked value IS its own closest
  // match — left as-is. The legacy `font` key has no known preset mapping.
  delete cust.font;

  return { customization: cust, template: targetTemplate, changed };
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

// Enforce Free limits on a card's customization blob: snap Pro-only design keys
// to the nearest Free-safe preset and cap link buttons. Returns a NEW object;
// never mutates the input. Paid accounts pass through untouched. `template` is
// used to pick the right preset set — omit it only for call sites that can't
// resolve one, where it falls back to the generic FALLBACK_META presets.
export function sanitizeCustomizationForPlan<T extends Record<string, unknown>>(
  customization: T | null | undefined,
  paid: boolean,
  template?: string,
): T {
  let cust = { ...(customization ?? {}) } as Record<string, unknown>;
  if (paid) return cust as T;
  // Free is capped at FREE_MAX_LINKS Swift Links (action-link buttons); extras
  // are trimmed. Pro/Office get unlimited links plus full design control.
  if (Array.isArray(cust.links) && cust.links.length > PLAN_LIMITS.FREE_MAX_LINKS) {
    cust.links = (cust.links as unknown[]).slice(0, PLAN_LIMITS.FREE_MAX_LINKS);
  }
  cust = convertCustomizationToFreeClosest(cust, template).customization;
  // Swift Links page theming ("Social design") is part of premium Swift Links —
  // Free serves the standard dark page, so stored link-style keys are dropped.
  for (const key of LINK_STYLE_KEYS) delete cust[key];
  return cust as T;
}
