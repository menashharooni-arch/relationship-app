// Shared design tokens, icons, and utilities for all card templates

import type { CardData } from "./types";

// Preset-template style overrides (accent/background/text/typography). The pure
// logic lives in src/lib/template-style.ts so it's node-testable; re-exported
// here so templates keep importing it from "./shared".
export { templateStyle, CARD_FONT_OPTIONS, isDarkBg, infoPaletteFrom } from "@/lib/template-style";
export type { TemplateStyle } from "@/lib/template-style";

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export type ShownPhone = { number: string; label: string };

// Phone numbers to display on the card: the ones flagged showOnCard, falling
// back to the legacy single `phone` field for cards saved before multi-phone.
export function cardPhones(data: CardData): ShownPhone[] {
  const phones = data.customization?.phones;
  if (Array.isArray(phones) && phones.length) {
    return phones
      .filter((p) => p?.showOnCard && p.number?.trim())
      .map((p) => ({ number: p.number, label: p.label || "" }));
  }
  return data.phone ? [{ number: data.phone, label: "" }] : [];
}

// Fax number (card-only).
export function cardFax(data: CardData): string {
  return data.customization?.fax?.trim() || "";
}

export function capLabel(label: string): string {
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

// Absolute URL for the card's website value (handles bare domains like "swiftcard.me").
export function webHref(site: string): string {
  const s = (site || "").trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
}

// ─── Auto-fit system ─────────────────────────────────────────────────────────
// Cards hold a variable amount of info (multiple phones, fax, address lines…).
// All templates size their contact block from ONE density factor so everything
// always fits — more rows → slightly smaller text and tighter rows — without
// ever cutting off the QR code or any wording. Pure functions of the card data,
// so templates stay server-renderable (no hooks — see card page requirement).

// Weighted count of contact rows on the card.
/**
 * Job titles up to this length cost nothing in layout budget.
 *
 * Deliberately generous — "Chief Marketing Officer" is 23, "Senior Vice
 * President" is 21 — so no card that renders correctly today shifts by a pixel.
 * Only titles beyond it, the ones that were being clipped, buy extra room.
 */
const TITLE_COMFY = 28;

export function titleLoad(data: CardData): number {
  const len = (data.title ?? "").trim().length;
  if (len <= TITLE_COMFY) return 0;
  // Caps at 0.8 of a row: a very long title should make the card breathe, not
  // shrink everything else into illegibility.
  return Math.min(0.8, ((len - TITLE_COMFY) / TITLE_COMFY) * 0.8);
}

export function contactRowCount(data: CardData): number {
  const addrLines = data.address ? data.address.split("\n").filter(Boolean).length : 0;
  return (
    cardPhones(data).length +
    (data.email ? 1 : 0) +
    (data.website ? 0.9 : 0) +
    (cardFax(data) ? 0.9 : 0) +
    addrLines * 0.7 +
    // A long title is real content and has to be paid for. It was invisible to
    // this count, so a 70-character title neither shrank the layout nor made the
    // card taller — it just wrapped and got clipped by the card's fixed aspect
    // ratio. That was the whole mechanism behind titles being cut off.
    titleLoad(data)
  );
}

// Density factor — the card always uses its FULL space:
//   sparse card (≤2 rows)  → up to 1.18: text, logo and QR grow into the room
//   normal (4 rows)        → 1
//   packed                 → eases down to 0.7 so nothing is ever cut off
export function fitFactor(data: CardData): number {
  const rows = contactRowCount(data);
  if (rows <= 4) return Math.min(1.18, 1 + (4 - rows) * 0.09);
  return Math.max(0.7, 1 - (rows - 4) * 0.075);
}

// Cap used for HERO text (names/companies) — they grow with sparseness but a
// touch less than rows so the layout stays balanced.
export function heroGrow(f: number): number {
  return Math.min(f, 1.14);
}

// Logo sizing that adapts to the logo's OWN shape without any JS measurement:
// height is fixed (scaled by density), width is auto — so a square logo renders
// height×height while a banner/wordmark logo naturally takes more width.
// object-contain guarantees nothing is ever cropped.
//
// CRITICAL: when the logo shares its row with the company name, maxWidth must
// be a PERCENTAGE of the row — a px cap ≥ the row width would squeeze the text
// to zero and wrap it letter-by-letter down past the card's bottom edge.
export function logoStyle(f: number, base: number, extra?: React.CSSProperties): React.CSSProperties {
  const h = Math.round(base * Math.min(Math.max(f, 0.85), 1.3));
  return {
    height: h,
    width: "auto",
    // Default assumes a text sibling: banner logos get at most half the row.
    maxWidth: "48%",
    objectFit: "contain",
    flexShrink: 0,
    ...extra,
  };
}

// Shrink one long value (a long email, name, or company) to fit its line.
// Exact-fit curve: beyond the comfy length, font size scales inversely with
// length, so rendered width stays constant — a 40-char email occupies the same
// line width a 24-char one does, just smaller.
//
// THE FLOOR IS A HARD LIMIT, NOT A FORMALITY. Below FIT_FLOOR the curve stops and
// rendered width starts growing linearly again, so the constant-width property
// only holds up to comfy / FIT_FLOOR characters — about 58 for a comfy of 22.
// Past that this function CANNOT make the text fit, and the caller must be able
// to wrap. This is why the email and website rows below no longer set nowrap:
// they used to, on the strength of a guarantee this function does not actually
// make, so a 67-char address rendered 37% wider than its box and simply hung off
// the side of the card. Measured by tests/render/card-overflow.test.ts.
const FIT_FLOOR = 0.38;

// ── Company names must not break mid-word ───────────────────────────────────
//
// fitPx below sizes text by its TOTAL length, which is the right rule for a
// line that may wrap: a longer string gets smaller so more of it fits. But it
// says nothing about the LONGEST WORD, and a word wider than its column is
// broken in the middle — "COASTLIN / E REALTY". A company name is a proper
// noun; splitting it is worse than any amount of shrinking.
//
// This only bites when a logo sits beside the name and takes half the row.
// Measured before the fix: 7 mid-word splits across the templates, every one of
// them with a wide banner logo present, none without.
//
// Things that do NOT solve it, each ruled out by measurement rather than taste:
//   • hyphens:auto — verified inert in this engine. A control div with
//     hyphens:auto and one without rendered IDENTICALLY (both overflowing on a
//     single line), so there is no hyphenation dictionary to lean on. Shipping
//     it would have looked like a fix and changed nothing.
//   • overflow-wrap:break-word instead of anywhere — both break a word that
//     cannot fit; they differ only in intrinsic sizing, and every one of these
//     elements also carries min-w-0, which lets flex shrink it past min-content
//     regardless.
//   • letting the logo shrink so the name keeps its width — a long enough word
//     still overflows once the logo hits zero, which trades a broken word for
//     clipped text. Strictly worse.
//
// So the name is shrunk until its longest word fits, spending the cheapest
// thing first: tracking, then size. Tracking goes first because these labels
// carry 0.16–0.22em of it for style, which is ~20% of the rendered width and
// the least missed when it goes.
// Per-character advance widths in em, MEASURED from the rendered card font
// rather than assumed. An average-width-per-character estimate was tried first
// and is not good enough: it sized "COASTLINE" correctly and still split
// "BARTHOLOMEW", because M and W are nearly twice the width of I. The spread is
// 0.24em to 0.94em, so any single average is wrong for half the alphabet.
//
// To re-measure: render a span at font-size 100px in the card font, set
// textContent to one character repeated 10x, and divide its width by 1000.
const W_UPPER: Record<string, number> = {
  I: 0.278, "'": 0.238, "-": 0.333, ".": 0.278, ",": 0.278, "1": 0.506,
  F: 0.611, L: 0.611, T: 0.611, Z: 0.611, J: 0.556,
  E: 0.667, P: 0.667, S: 0.667, V: 0.667, X: 0.667, Y: 0.667,
  A: 0.722, B: 0.722, C: 0.722, D: 0.722, H: 0.722, K: 0.722, N: 0.722, R: 0.722, U: 0.722, "&": 0.722,
  G: 0.778, O: 0.778, Q: 0.778, M: 0.833, W: 0.944,
};
const W_MIXED: Record<string, number> = {
  i: 0.333, j: 0.333, l: 0.333, I: 0.389, f: 0.412, t: 0.444, r: 0.482,
  s: 0.611, v: 0.611, y: 0.611, z: 0.556, "'": 0.278, "-": 0.333, ".": 0.333, ",": 0.333,
  a: 0.667, c: 0.667, e: 0.667, h: 0.667, k: 0.667, n: 0.667, o: 0.667, p: 0.667, q: 0.667, u: 0.667, x: 0.667,
  b: 0.676, d: 0.676, g: 0.676, w: 0.944, m: 1,
  F: 0.667, J: 0.667, L: 0.667, E: 0.722, S: 0.722, T: 0.722, Z: 0.722, P: 0.722,
  A: 0.778, B: 0.778, C: 0.778, D: 0.778, R: 0.778, V: 0.778, X: 0.778, Y: 0.778,
  G: 0.833, H: 0.833, K: 0.833, N: 0.833, O: 0.833, Q: 0.833, U: 0.833,
  M: 0.944, W: 1, "&": 0.889,
};
const DEFAULT_UPPER = 0.722;
const DEFAULT_MIXED = 0.667;

// Production renders in Geist, the harness in whatever the headless engine
// resolves — close, but not identical. 8% covers that drift, and erring toward
// slightly smaller text is the right direction: too small is legible, split is
// not.
const SAFETY = 1.08;

// The row widths passed in are design px at the 460 layout CardScaler always
// uses. One renderer genuinely differs — HeroPhone lays PhotoFirst out at 390 —
// and 390/460 = 0.848, so a size computed against the wider figure would be too
// big there and split the word after all. Budgeting the narrower width
// everywhere costs a fraction of a point on the rare names that shrink at all,
// and makes the result independent of which renderer is drawing the card.
const NARROW = 0.85;

/** Width of one word in em, from the measured table. */
function wordEm(word: string, uppercase: boolean): number {
  const table = uppercase ? W_UPPER : W_MIXED;
  const fallback = uppercase ? DEFAULT_UPPER : DEFAULT_MIXED;
  let sum = 0;
  for (const raw of word) {
    const ch = uppercase ? raw.toUpperCase() : raw;
    sum += table[ch] ?? fallback;
  }
  return sum;
}

/** Longest whitespace-delimited run — the piece that has to survive whole. */
function longestWord(text: string): string {
  return text.trim().split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), "");
}

/**
 * Split a logo/company row between the two, giving the NAME what it needs and
 * the logo the rest.
 *
 * Shrinking the name alone is not enough on its own. Held to the logo's fixed
 * half of the row, "Konstantinopoulos" came out whole but at 5.9px — legible
 * only in the sense that no letters were missing. Whole-and-unreadable is not
 * an improvement on split-and-readable; both are the name failing to be a name.
 *
 * So the logo yields, and only as far as it must: it keeps its full width for
 * ordinary names (the common case, and the one that was asked to get bigger),
 * gives ground as the longest word grows, and stops at `minLogo` so it can
 * never dwindle to a smudge. Past that the name shrinks again — by then the
 * word is genuinely enormous and something has to give.
 *
 * The logo is the right thing to spend: it is a mark that is still recognisable
 * a few pixels smaller, whereas a company name is either readable or it isn't.
 */
export function splitLogoRow(opts: {
  /** Content width of the row, in design px. */
  row: number;
  /** gap-* between logo and name, in px. */
  gap: number;
  hasLogo: boolean;
  /** Logo's share when the name doesn't need anything extra (0–1). */
  defaultLogoFrac: number;
  /** Never shrink the logo narrower than this, in px. */
  minLogo: number;
  company: string | null | undefined;
  /** Size the longest word should ideally reach — the readability target. */
  targetPx: number;
  trackingEm: number;
  uppercase: boolean;
}): { logoMaxPct: string; companyPx: number } {
  const { row, gap, hasLogo, defaultLogoFrac, minLogo, company, targetPx, trackingEm, uppercase } = opts;
  const pct = (px: number) => `${Number(((px / row) * 100).toFixed(2))}%`;
  if (!hasLogo) return { logoMaxPct: "0%", companyPx: row * NARROW };

  const defaultLogo = row * defaultLogoFrac;
  const s = (company ?? "").trim();
  if (!s) return { logoMaxPct: pct(defaultLogo), companyPx: 0 };

  const word = longestWord(s);
  const needed = (wordEm(word, uppercase) + word.length * trackingEm) * targetPx * SAFETY;

  // What the name gets: never less than the old fixed share, never so much that
  // the logo drops under its floor.
  const companyPx = Math.min(Math.max(row - defaultLogo - gap, needed), row - minLogo - gap);
  // A PERCENTAGE, not the px value. The cap was originally a percentage and had
  // to stay one: these constants are design px at the 460 layout, and a fixed px
  // cap applied at any other width stops scaling with the row — which showed up
  // immediately as luxury-minimal's logo overrunning its panel at 390px.
  // Expressing the computed split as a fraction keeps it responsive while still
  // being derived from the name.
  return { logoMaxPct: pct(row - companyPx - gap), companyPx: companyPx * NARROW };
}

/**
 * Size a company name so its longest word fits `availPx` without splitting.
 *
 * Returns tracking too, because tightening it is the first and least visible
 * lever. Falls back to the same FIT_FLOOR fitPx uses: past that the word is
 * genuinely wider than the space it has, and a break is unavoidable rather than
 * careless — at which point breaking is the correct behaviour, not a bug.
 */
export function fitCompany(
  base: number,
  text: string | null | undefined,
  comfy: number,
  availPx: number,
  trackingEm = 0,
  uppercase = false,
): { fontSize: number; letterSpacing: string } {
  const s = (text ?? "").trim();
  // Start from the existing length-based size so short names are untouched and
  // this can only ever make text smaller, never larger.
  let size = fitPx(base, s, comfy);
  if (!s || availPx <= 0) return { fontSize: size, letterSpacing: `${trackingEm}em` };

  const word = longestWord(s);
  const glyphs = wordEm(word, uppercase); // em of glyph advance, measured
  const n = word.length;                  // tracking is applied per character
  const widthAt = (fs: number, tr: number) => (glyphs + n * tr) * fs * SAFETY;

  let tracking = trackingEm;
  if (widthAt(size, tracking) > availPx) {
    // 1. Tracking first — it is decoration, and on these labels it is up to a
    //    fifth of the rendered width.  Down to 40% of the design value.
    const needed = (availPx / (size * SAFETY) - glyphs) / n;
    tracking = Math.max(trackingEm * 0.4, Math.min(trackingEm, needed));
  }
  if (widthAt(size, tracking) > availPx) {
    // 2. Then size, never below the shared floor. Past the floor the word is
    //    genuinely wider than the space it has and breaking is correct.
    size = Math.max(base * FIT_FLOOR, availPx / ((glyphs + n * tracking) * SAFETY));
  }
  return { fontSize: size, letterSpacing: `${Number(tracking.toFixed(3))}em` };
}

export function fitPx(base: number, text: string | null | undefined, comfy: number): number {
  const len = (text ?? "").trim().length;
  if (len <= comfy) return base;
  return Math.max(base * FIT_FLOOR, (base * comfy) / len);
}

/**
 * Longest length this curve can still hold on one line at the given comfy.
 * Exported so tests can assert the boundary rather than rediscovering it.
 */
export function fitOneLineLimit(comfy: number): number {
  return Math.floor(comfy / FIT_FLOOR);
}

// Auto-fit specifically for the NAME (hero text). fitPx alone keys off the WHOLE
// string, so it catches a long full name — but a single long WORD (a 10+ letter
// FIRST name) can't wrap at a space, so it pokes off the side of the card while
// the total length still looks "comfy". This also shrinks by the LONGEST word:
// once any word passes NAME_WORD_COMFY (9) letters, every extra letter scales
// the size down inversely so the rendered word width stays put — "slightly
// minimize with every letter after the 9th". Returns the SMALLER of the two
// fits, floored so a pathological name stays legible. A normal name (≤9-letter
// words) is never touched, so templates that never needed it are unaffected.
const NAME_WORD_COMFY = 9;
export function fitName(base: number, name: string | null | undefined, comfyTotal: number): number {
  const s = (name ?? "").trim();
  if (!s) return base;
  const byTotal = fitPx(base, s, comfyTotal);
  const longestWord = s.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  const byWord = longestWord <= NAME_WORD_COMFY
    ? base
    : Math.max(base * 0.5, (base * NAME_WORD_COMFY) / longestWord);
  return Math.min(byTotal, byWord);
}

/**
 * Auto-fit for the JOB TITLE.
 *
 * Titles were the one text field with no fitting at all. Most templates set them
 * uppercase with wide letter-spacing, which renders far wider per character than
 * the raw length suggests, so they overflowed sooner than anything else while
 * looking harmless in the source. Shares TITLE_COMFY with the density
 * calculation so the two can't drift apart.
 */
export function fitTitle(base: number, title: string | null | undefined): number {
  return fitPx(base, title, TITLE_COMFY);
}

// QR stays on the card at every density — it grows on sparse cards (more
// scannable from further away) and gives up a little room when packed.
export function qrSize(f: number): number {
  return f >= 1.12 ? 74 : f >= 1 ? 66 : f >= 0.85 ? 60 : 54;
}

// Last-resort safety valve: past the point where shrinking text can absorb the
// info, the card itself gets slightly taller (smaller width:height ratio) so
// nothing is EVER cut off — not the QR, not a single row. Stacked layouts
// (header on top, e.g. LocalBusiness) have less vertical room for contacts,
// so they pass a lower threshold to start growing earlier.
export function cardAspect(data: CardData, threshold = 8): string {
  const rows = contactRowCount(data);
  if (rows <= threshold) return "1.75 / 1";
  const ratio = Math.max(1.35, 1.75 - (rows - threshold) * 0.06);
  return `${ratio.toFixed(3)} / 1`;
}

// ─── Shared contact block ────────────────────────────────────────────────────
// One renderer for the contact rows on EVERY template, so the type hierarchy is
// identical and even across designs: phone (largest, bold) → email → website →
// fax → address (smallest). Templates keep their character via the palette.

export type RowPalette = {
  accent?: string;      // icon color; omit to have icons inherit each row's text color
  strong: string;       // phone numbers
  mid: string;          // email
  soft: string;         // website + fax
  muted: string;        // address
  phoneWeight?: number; // default 700; refined templates can use 600
};

export function ContactRows({ data, palette, f }: { data: CardData; palette: RowPalette; f: number }) {
  const ic = (rowColor: string) => ({ color: palette.accent ?? rowColor });
  const gap = Math.round(5 * f);
  // Email/website grow a bit less than the rest (capped at 1.1) and shrink on a
  // tighter budget — sized for the narrowest contact panel (ModernBold) so a
  // grown email can never poke past the card edge.
  const rowGrow = Math.min(f, 1.1);
  const emailSize = fitPx(13 * rowGrow, data.email, 22);
  const webSize = fitPx(11.5 * rowGrow, data.website, 24);

  // Every row is a flex child, so it needs min-w-0 to be allowed to shrink below
  // its content width. Without it a flex item's automatic minimum size is its
  // content, and a long value pushes the row wider than the card instead of
  // being contained — the mechanism behind the phone and email overhangs.
  const row = "flex items-center gap-2 min-w-0";

  // Long values wrap rather than overhang. `anywhere` (not `break-word`) is what
  // lets an unbroken 67-character email split at all — it has no spaces, so
  // normal wrapping has nowhere to break and the text just leaves the card.
  const wrapLong: React.CSSProperties = { overflowWrap: "anywhere", minWidth: 0 };

  return (
    <div className="flex flex-col" style={{ gap }}>
      {cardPhones(data).map((p, i) => (
        <a key={`ph${i}`} href={`tel:${p.number.replace(/[^\d+]/g, "")}`} className={row} style={{ color: palette.strong, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.strong)}><IcoPhone /></span>
          {/* A phone stays on one line — breaking a number mid-digit is worse
              than shrinking it — so it must be FITTED. It previously had a fixed
              size with nowrap, which meant an extension ("...ext. 8891") could
              neither shrink nor wrap and ran ~50px past the card edge. */}
          <span style={{ fontSize: fitPx(14.5 * f, formatPhone(p.number), 16), fontWeight: palette.phoneWeight ?? 700, whiteSpace: "nowrap" }}>
            {formatPhone(p.number)}
            {p.label && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 5, fontSize: 9 * f, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</span>}
          </span>
        </a>
      ))}
      {/* Email + website: fitted so they normally sit on one line, and allowed to
          wrap when they're past what fitting can absorb (see fitPx's floor). */}
      {data.email && (
        <a href={`mailto:${data.email}`} className={row} style={{ color: palette.mid, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.mid)}><IcoMail /></span>
          <span style={{ fontSize: emailSize, fontWeight: 600, ...wrapLong }}>{data.email}</span>
        </a>
      )}
      {data.website && (
        <a href={webHref(data.website)} target="_blank" rel="noopener noreferrer" className={row} style={{ color: palette.soft, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.soft)}><IcoGlobe /></span>
          <span style={{ fontSize: webSize, fontWeight: 500, ...wrapLong }}>{data.website}</span>
        </a>
      )}
      {cardFax(data) && (
        <div className="flex items-center gap-2" style={{ color: palette.soft }}>
          <span className="shrink-0" style={ic(palette.soft)}><IcoPhone /></span>
          <span style={{ fontSize: 11 * f, fontWeight: 500 }}>
            {formatPhone(cardFax(data))}
            <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 8.5 * f, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fax</span>
          </span>
        </div>
      )}
      {data.address && (
        <div className="flex items-start gap-2" style={{ color: palette.muted }}>
          <span className="shrink-0" style={{ ...ic(palette.muted), marginTop: 1 }}><IcoPin /></span>
          <span style={{ fontSize: 10.5 * f, lineHeight: 1.3, whiteSpace: "pre-line" }}>{data.address}</span>
        </div>
      )}
    </div>
  );
}

// ─── Contact Icons (stroke style) ────────────────────────────────────────────

export const IcoPhone = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

export const IcoMail = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
  </svg>
);

export const IcoGlobe = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
  </svg>
);

export const IcoPin = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

// ─── Social Icons (fill style) ────────────────────────────────────────────────

export const IcoLinkedIn = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const IcoInsta = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

export const IcoX = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const IcoTikTok = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.16 8.16 0 004.77 1.52V6.83a4.85 4.85 0 01-1-.14z" />
  </svg>
);
