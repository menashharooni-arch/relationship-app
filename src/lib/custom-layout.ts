// ── The custom card's layout engine ─────────────────────────────────────────
//
// Pure logic, no React, no hooks — so the SERVER renderer (CustomCard) and the
// CLIENT editor (CustomCardDesigner) run the exact same rules. That shared
// origin is what makes the editor honest: it previews with the real renderer at
// the real 460 design width, rather than approximating it on its own canvas.
//
// The design rule everything follows from: BLOCKS FLOW, THEY DO NOT FLOAT.
// The old designer stored x/y percentages and absolute font sizes, which made
// four failure modes reachable by ordinary use — overlapping text, values
// clipped by the card edge, layouts that looked different once published, and
// alignment that drifted a percent or two off. None of them are reachable here,
// because nothing is positioned and no size is typed in.

import type {
  CardData, CardEmphasis, CardSkeleton, CardZone, CustomBlock, CustomElement, CustomLayout,
} from "@/components/card-templates/types";

// ── Sizing ──────────────────────────────────────────────────────────────────
// Design px at the 460 natural card width, exactly like the preset templates.
// Owners choose an EMPHASIS; the engine owns the number. That is the difference
// between "make my name bigger" and knowing that 22 is the right value.
// Hero is 26, not 22. At 22 a fork came out visibly smaller and emptier than the
// template it was forked from — the preset templates run their names at 23 to 28
// — and looking like a downgrade of the card you just chose is the one outcome
// that would make this feature feel worse than not using it.
const EMPHASIS_PX: Record<CardEmphasis, number> = { hero: 25, normal: 13, quiet: 10 };
const EMPHASIS_IMG: Record<CardEmphasis, number> = { hero: 108, normal: 84, quiet: 62 };

export const EMPHASIS_ORDER: CardEmphasis[] = ["quiet", "normal", "hero"];

/** Text blocks that carry a written value, i.e. the ones that cost vertical room. */
const TEXT_TYPES = new Set(["field", "text", "social", "socials"]);

/**
 * The side panel holds MARKS, not sentences.
 *
 * It is a third of the card wide, and a single unbroken token — a handle, an
 * email — either fits that column or splits mid-word. Fitting by character
 * count and then by measured pixels both failed to converge; the fuzz kept
 * finding a size where a handle broke. The honest answer is that there is no
 * good rendering of a job title at hero size in 116px, so the layout does not
 * offer one. Every preset already puts only a logo, headshot or QR there.
 *
 * Enforced in the renderer as well as hidden in the editor, so an older or
 * hand-edited layout can't put text there either.
 */
export function zoneFor(block: CustomBlock): CardZone {
  return TEXT_TYPES.has(block.type) ? "right" : block.zone;
}

export function canChangeZone(block: CustomBlock): boolean {
  return !TEXT_TYPES.has(block.type);
}

// ── The card is a FIXED size, so the content has to be solved for ───────────
//
// The card used to GROW when it ran out of room. It doesn't any more — a
// business card is 1.75:1 in the hand and the owner's is 1.75:1 on screen no
// matter what they put on it — so the height that used to be the release valve
// is now a hard budget, and the model has to be good enough to live inside it.
//
// The old model counted weighted ROWS. Sweeping every reachable shape against
// the fixed box showed exactly where that breaks: it cannot see WRAPPING. An
// address is one row and three rendered lines, so cards with four blocks
// overflowed while cards with nine did not, and no amount of tuning a
// rows-based curve fixes a model that is blind to the dominant term.
//
// So this estimates rendered PIXELS instead. Every quantity below is a design px
// at the 460 natural card width, measured off the real renderer.

/** The card's own height: 460 / 1.75. */
const CARD_PX = 460 / 1.75;

// Every number below is READ OFF THE RENDERER, not guessed. Where the renderer
// says `maxHeight: px * 0.72` or `size: round(px * 0.68)`, that factor appears
// here — a model that invents its own constants is a second implementation of
// the layout, and it will drift.

/** CustomBlockContent renders text at lineHeight 1.25. */
const LINE = 1.25;

/** Zone puts `marginTop: round(5 * density)` on EVERY block in the main column. */
const GAP_PX = 5;

/** Usable text width in the main column, with and without a side panel. */
const MAIN_W_PANEL = 236;
const MAIN_W_FULL = 396;

/** Mean glyph advance as a fraction of font size, for the app's stacks. */
const CHAR_W = 0.52;

/** Vertical padding: main column, and the side panel. */
const MAIN_PAD_SPLIT = 30;   // 16 top + 14 bottom
const MAIN_PAD_STACKED = 24; // 10 top + 14 bottom
const SIDE_PAD = 32;         // 16 + 16

/** Rendered heights, as the renderer computes them from blockImagePx. */
const LOGO_F = 0.72;     // img maxHeight: px * 0.72
const QR_F = 0.68;       // MiniQR size: round(px * 0.68)
const HEADSHOT_CAP = 116; // img height: min(px, 116)
const DIVIDER_PX = 2;

/**
 * Socials FLOW: they fill across the row and wrap down.
 *
 *   linkedin  tiktok    instagram
 *   facebook  youtube   snapchat
 *
 * Each social used to be its own block on its own full-width row, so six of
 * them were six rows — most of a card spent on handles, and the density model
 * then shrank everything else to make room for rows that were mostly empty.
 *
 * Exported and used by BOTH the renderer and the sizing model. If they grouped
 * differently the model would budget for rows the card doesn't draw, which is
 * the exact class of bug that made the card overflow before.
 */
export const SOCIAL_COLS = 3;

/** Runs of adjacent social blocks become one group; everything else stays itself. */
export function groupSocials(blocks: CustomBlock[]): (CustomBlock | CustomBlock[])[] {
  const out: (CustomBlock | CustomBlock[])[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type !== "social") { out.push(b); continue; }
    if (Array.isArray(last)) last.push(b);
    else out.push([b]);
  }
  return out;
}

/** How many share a row: three when there are three or more, else the count. */
export function socialCols(count: number): number {
  return Math.min(SOCIAL_COLS, Math.max(1, count));
}

/** The drawn height of an image block at density 1. */
function imagePx(block: CustomBlock, scale = 1): number {
  const px = EMPHASIS_IMG[block.emphasis] * scale;
  if (block.type === "logo") return px * LOGO_F;
  if (block.type === "headshot") return Math.min(px, HEADSHOT_CAP);
  if (block.type === "qr") return px * QR_F;
  return px;
}

/**
 * What one main-column block occupies, in design px, at density 1.
 *
 * Text WRAPS, so this is `lines x fontSize x lineHeight` rather than one row per
 * block — being blind to wrapping is what made the previous row-count model
 * mispredict by up to 130px. The per-block gap matters just as much at the other
 * end: eleven quiet blocks are 137px of text and 55px of gaps, so a model that
 * folded the gap into the line height under-counted the smallest cards worst.
 *
 * Without `data` (the designer's placeholder mode) every string is a short
 * stand-in, which is exactly what placeholder mode draws.
 */
function blockPx(block: CustomBlock, data: CardData | undefined, width: number, placeholder: boolean): number {
  if (!TEXT_TYPES.has(block.type)) {
    if (block.type === "divider") return DIVIDER_PX + GAP_PX;
    return imagePx(block) + GAP_PX;
  }
  // Real text first, ALWAYS — including in the designer. Sizing the preview off
  // a stand-in while the published card sizes off a 60-character address is how
  // a WYSIWYG editor stops being one. The stand-in is only for the blocks that
  // genuinely have nothing yet, which are exactly the ones placeholder mode
  // draws a `{name}` chip for, and those chips take room too.
  const text = (data ? blockTextForFit(block, data) : "") || (placeholder ? "{placeholder}" : "");
  if (!text) return 0;
  const fs = EMPHASIS_PX[block.emphasis];
  // Ceil, because half a rendered line still occupies a whole one.
  const perLine = Math.max(1, Math.floor(width / (fs * CHAR_W)));
  const lines = Math.max(1, Math.ceil(text.length / perLine));
  return lines * fs * LINE + GAP_PX;
}

/**
 * The string a block will render, for LENGTH purposes only.
 *
 * Deliberately not the renderer's exact formatting — a formatted phone is four
 * characters longer than the raw one, which is inside the safety margin — but it
 * has to see the same PRESENCE, so a block with no value costs nothing here just
 * as it draws nothing there.
 */
function blockTextForFit(block: CustomBlock, data: CardData): string {
  if (!blockHasValue(block, data)) return "";
  if (block.type === "text") return block.text ?? "";
  if (block.type === "social" || block.type === "socials") return "@handle_placeholder";
  const c = data.customization;
  switch (block.field) {
    case "name": return data.name ?? "";
    case "title": return data.title ?? "";
    case "company": return data.company ?? "";
    case "phone": return (data.phone || c?.phones?.find((p) => p?.showOnCard)?.number) ?? "";
    case "email": return data.email ?? "";
    case "website": return data.website ?? "";
    case "address": return data.address ?? "";
    case "fax": return `Fax: ${c?.fax ?? ""}`;
    default: return "";
  }
}

/**
 * Total design px the content wants at density 1.
 *
 * Exported so the calibration sweep can check the model against the real
 * rendered height rather than trusting it.
 */
/**
 * What the content needs, split into the part that SHRINKS with density and the
 * part that doesn't.
 *
 * Padding is the part that doesn't — it is written in fixed px and stays there
 * however small the type gets. Multiplying the whole estimate by density
 * therefore over-credited what shrinking could achieve, and it over-credited it
 * most at exactly the loads where the card was fullest. Stacked cards carry
 * 56px of it (a band and a column), which is why they were the last shapes
 * still overflowing.
 */
function budget(blocks: CustomBlock[], skeleton?: CardSkeleton, data?: CardData, placeholder = false) {
  const on = blocks.filter((b) => b.on);
  const stacked = skeleton === "stacked";
  const side = on.filter((b) => zoneFor(b) === "left");
  const width = side.length && !stacked ? MAIN_W_PANEL : MAIN_W_FULL;

  const qr = on.find((b) => zoneFor(b) === "right" && b.type === "qr");
  const main = on.filter((b) => zoneFor(b) === "right" && b.type !== "qr");

  // The QR sits in its own bottom row, outside Zone, so it carries no gap.
  // Socials are grouped with the SAME rule the renderer groups them by, so the
  // budget counts the rows that will actually be drawn.
  const mainScaled =
    groupSocials(main).reduce((n, g) => {
      if (!Array.isArray(g)) return n + blockPx(g, data, width, placeholder);
      const shown = data ? g.filter((b) => blockHasValue(b, data)) : g;
      if (!shown.length) return n;
      const rows = Math.ceil(shown.length / socialCols(shown.length));
      return n + rows * EMPHASIS_PX[shown[0].emphasis] * LINE + GAP_PX;
    }, 0) + (qr ? imagePx(qr) : 0);
  const mainFixed = stacked ? MAIN_PAD_STACKED : MAIN_PAD_SPLIT;

  // The side panel's Zone is rendered with gap 0, so its blocks stack flush.
  const scale = sideImageScale(skeleton);
  const sideScaled = side.length === 0 ? 0
    : stacked
      // A band is a ROW: its height is its tallest item, not their sum.
      ? Math.max(...side.map((b) => imagePx(b, scale)))
      : side.reduce((n, b) => n + imagePx(b, scale), 0);
  const sideFixed = side.length === 0 ? 0 : SIDE_PAD;

  // Stacked, the zones ADD — the band sits above the main column. Side by side
  // they SHARE the card's height, so the taller one sets it; compare them at
  // their full size, which is the only point at which they are comparable.
  return stacked
    ? { scaled: mainScaled + sideScaled, fixed: mainFixed + sideFixed }
    : mainScaled + mainFixed >= sideScaled + sideFixed
      ? { scaled: mainScaled, fixed: mainFixed }
      : { scaled: sideScaled, fixed: sideFixed };
}

/** Total design px the content wants at density 1. Exported for the sweep. */
export function contentPx(blocks: CustomBlock[], skeleton?: CardSkeleton, data?: CardData, placeholder = false): number {
  const b = budget(blocks, skeleton, data, placeholder);
  return b.scaled + b.fixed;
}

/**
 * Density factor: shrink everything TOGETHER so hierarchy survives and nothing
 * has to be cut. Solved directly — the content wants `contentPx` and the card
 * has CARD_PX, so the scale is their ratio.
 *
 * SAFETY is the margin between a model and a renderer. Wrapping is estimated
 * from a mean glyph width, so a line of capitals or a run of wide characters
 * lands slightly over; 0.9 buys back more than the sweep's worst observed
 * error. Costing more than it needs to only makes a card slightly smaller than
 * it could be. Costing less makes it wrong.
 *
 * FLOOR is legibility, not fit. Past it the answer is "your card is full", which
 * is what MAX_VISIBLE_BLOCKS says — and the floor is set low enough that the
 * cap, not the floor, is always what an owner actually meets.
 */
const SAFETY = 0.9;
/**
 * Low enough that the SOLVE always wins.
 *
 * A floor that binds is a floor that overflows: clamping density UP to keep
 * type readable is the same as deciding to cut the card off, and cutting a
 * phone number in half is worse than setting it small. Nine blocks all set to
 * Big on a banded card is the only shape that reaches down here, no real card
 * looks like that, and the editor's counter warns long before it. So this
 * exists to stop a hand-edited payload dividing by something absurd, not to
 * make aesthetic decisions.
 */
const FLOOR = 0.42;
const CEILING = 1.14;

export function blockDensity(blocks: CustomBlock[], skeleton?: CardSkeleton, data?: CardData, placeholder = false): number {
  const { scaled, fixed } = budget(blocks, skeleton, data, placeholder);
  if (scaled <= 0) return CEILING;
  // scaled x d + fixed <= room  ->  d <= (room - fixed) / scaled
  const room = CARD_PX * SAFETY - fixed;
  if (room <= 0) return FLOOR;
  return Math.max(FLOOR, Math.min(CEILING, room / scaled));
}

/** Side-band images sit above the text when stacked, so they cost real height. */
export function sideImageScale(skeleton?: CardSkeleton): number {
  return skeleton === "stacked" ? 0.78 : 1;
}

/**
 * How much a card can hold.
 *
 * Not an arbitrary limit — it is the point past which no amount of shrinking
 * keeps the card readable. There used to be a second, softer answer to a card
 * that was too full: grow it. That is gone, so this is the only one, and it is
 * enforced in BOTH places on purpose — the editor stops you before you get
 * there and says why, and the renderer trims defensively so a hand-edited
 * payload can't produce a broken public card.
 *
 * Real business cards carry six to nine things; twelve is already generous.
 */
export const MAX_VISIBLE_BLOCKS = 12;

export function visibleBlocks(blocks: CustomBlock[]): CustomBlock[] {
  return blocks.filter((b) => b.on).slice(0, MAX_VISIBLE_BLOCKS);
}

export function isFull(blocks: CustomBlock[]): boolean {
  return blocks.filter((b) => b.on).length >= MAX_VISIBLE_BLOCKS;
}

export function blockFontPx(emphasis: CardEmphasis, density: number): number {
  return Math.round(EMPHASIS_PX[emphasis] * density * 10) / 10;
}

export function blockImagePx(emphasis: CardEmphasis, density: number): number {
  return Math.round(EMPHASIS_IMG[emphasis] * Math.min(1.1, density));
}

// ── Presets ─────────────────────────────────────────────────────────────────

const b = (
  id: string,
  type: CustomBlock["type"],
  zone: CardZone,
  emphasis: CardEmphasis,
  extra: Partial<CustomBlock> = {},
): CustomBlock => ({ id, type, zone, emphasis, on: true, ...extra });

/**
 * Every starting point is a finished card, never a blank canvas. Forking a look
 * you already like is the difference between adjusting and building, and
 * "building" is what made the old designer feel like work.
 */
/** The contact stack every card shares, so presets differ where they should. */
const contacts = (): CustomBlock[] => [
  b("phone", "field", "right", "normal", { field: "phone" }),
  b("email", "field", "right", "normal", { field: "email" }),
  b("website", "field", "right", "quiet", { field: "website" }),
  // ON, matching the templates. A block with no value renders nothing, so this
  // costs a card without an address exactly nothing — while a fork that silently
  // dropped an address the original showed looked like the fork had lost it.
  b("address", "field", "right", "quiet", { field: "address" }),
];

const SANS = "var(--font-geist-sans), system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "'Courier New', ui-monospace, monospace";

/**
 * Eight looks you CANNOT get anywhere else on SwiftCard.
 *
 * These used to be one reconstruction per shipped template — "Start from Logo
 * First", "Start from Classic Pro", and so on. That was the wrong offer: a Pro
 * subscriber opened the one feature they pay for and was shown the same six
 * names anybody can pick for free. Nothing here was theirs.
 *
 * So the starting points are now their own design set. Between them they use all
 * three skeletons, both light and dark grounds, three typefaces, and — the part
 * no template offers at all — different HIERARCHIES: Marquee makes the phone the
 * biggest thing on the card, Ember leads with the firm rather than the person.
 * That is the answer to "why would I pay for this": these are the arrangements
 * the six fixed templates deliberately don't make.
 *
 * Every one is a finished card, never a blank canvas. Forking a look you already
 * like is the difference between adjusting and building, and "building" is what
 * made the old designer feel like work.
 */
export const LAYOUT_PRESETS: Record<string, { label: string; blurb: string; build: () => CustomLayout }> = {
  ink: {
    label: "Ink",
    blurb: "Deep navy, your mark on a darker panel, name large.",
    build: () => ({
      background: "#141b26", textColor: "#ffffff", accentColor: "#7fa6f0",
      panelBackground: "#0b1220", panelTextColor: "#ffffff",
      fontFamily: SANS, skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
        b("headshot", "headshot", "left", "normal", { on: false }),
        b("socials", "socials", "right", "quiet", { on: false }),
      ],
    }),
  },
  signal: {
    label: "Signal",
    blurb: "Your face on a blue panel — on the right, where nothing else puts it.",
    build: () => ({
      background: "#ffffff", textColor: "#0e1b35", accentColor: "#2563eb",
      panelBackground: "linear-gradient(200deg, #1d4ed8 0%, #3b82f6 100%)",
      panelTextColor: "#ffffff",
      fontFamily: SANS, skeleton: "mirror", elements: [],
      blocks: [
        b("headshot", "headshot", "left", "hero"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
        b("logo", "logo", "left", "quiet", { on: false }),
      ],
    }),
  },
  marquee: {
    label: "Marquee",
    blurb: "Black band on top, and the phone number as the biggest thing on the card.",
    build: () => ({
      background: "#fffdf7", textColor: "#1c1917", accentColor: "#b45309",
      panelBackground: "#111827", panelTextColor: "#ffffff",
      fontFamily: SANS, skeleton: "stacked", elements: [],
      blocks: [
        b("logo", "logo", "left", "quiet"),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("name", "field", "right", "hero", { field: "name" }),
        b("phone", "field", "right", "hero", { field: "phone" }),
        b("email", "field", "right", "normal", { field: "email" }),
        b("qr", "qr", "right", "normal"),
        b("website", "field", "right", "quiet", { field: "website", on: false }),
        b("address", "field", "right", "quiet", { field: "address", on: false }),
        b("title", "field", "right", "quiet", { field: "title", on: false }),
      ],
    }),
  },
  atelier: {
    label: "Atelier",
    blurb: "Bone paper, a serif face, a gold accent and a lot of restraint.",
    build: () => ({
      // A panel tint one step off the ground. Without it the mark sits in a
      // third of the card that reads as blank space rather than as a panel.
      background: "#f4f2ed", textColor: "#1c1612", accentColor: "#8a6a3b",
      panelBackground: "#eae6dd", panelTextColor: "#1c1612",
      fontFamily: SERIF, skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "quiet"),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        ...contacts(),
        b("qr", "qr", "right", "quiet"),
        b("headshot", "headshot", "left", "normal", { on: false }),
      ],
    }),
  },
  noir: {
    label: "Noir",
    blurb: "Near-black, typewriter type, everything small and exact.",
    build: () => ({
      background: "#0a0a0a", textColor: "#fafafa", accentColor: "#a3a3a3",
      panelBackground: "#171717", panelTextColor: "#fafafa",
      fontFamily: MONO, skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("phone", "field", "right", "quiet", { field: "phone" }),
        b("email", "field", "right", "quiet", { field: "email" }),
        b("website", "field", "right", "quiet", { field: "website" }),
        b("address", "field", "right", "quiet", { field: "address" }),
        b("qr", "qr", "right", "quiet"),
      ],
    }),
  },
  meridian: {
    label: "Meridian",
    blurb: "A deep green panel carrying both your photo and your logo.",
    build: () => ({
      background: "#f7f5ef", textColor: "#14312a", accentColor: "#2f6f5b",
      panelBackground: "linear-gradient(165deg, #16352c 0%, #2f6f5b 100%)",
      panelTextColor: "#ffffff",
      fontFamily: SANS, skeleton: "split", elements: [],
      blocks: [
        b("headshot", "headshot", "left", "normal"),
        b("logo", "logo", "left", "quiet"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
      ],
    }),
  },
  broadsheet: {
    label: "Broadsheet",
    blurb: "No panel at all — one clean column, edge to edge.",
    build: () => ({
      background: "#ffffff", textColor: "#111827", accentColor: "#111827",
      fontFamily: SANS, skeleton: "split", elements: [],
      blocks: [
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "normal", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
        b("logo", "logo", "left", "quiet", { on: false }),
        b("headshot", "headshot", "left", "normal", { on: false }),
      ],
    }),
  },
  ember: {
    label: "Ember",
    blurb: "Oxblood, panel on the right, and the firm named above the person.",
    build: () => ({
      background: "#33191d", textColor: "#f6ece9", accentColor: "#e0a3a0",
      panelBackground: "#261215", panelTextColor: "#f6ece9",
      fontFamily: SERIF, skeleton: "mirror", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("company", "field", "right", "hero", { field: "company" }),
        b("name", "field", "right", "normal", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
        b("headshot", "headshot", "left", "normal", { on: false }),
      ],
    }),
  },
};

export const DEFAULT_PRESET = "ink";

export function buildPreset(key: string): CustomLayout {
  return (LAYOUT_PRESETS[key] ?? LAYOUT_PRESETS[DEFAULT_PRESET]).build();
}

// ── Building a layout from a scanned card ───────────────────────────────────

/** Perceived brightness (YIQ), 0-255. Null for anything unparseable. */
function yiq(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

const hex = (v: unknown, fallback: string): string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : fallback;

/**
 * Every block a scan is allowed to place, and what it maps to.
 *
 * A Map, not an object literal, because the key comes from model output and
 * `literal["__proto__"]` returns Object.prototype — which is TRUTHY, so a plain
 * lookup would treat "__proto__" or "constructor" as a valid block and build one
 * with an undefined type. The renderer degrades gracefully enough that the fuzz
 * never flagged it, which is exactly why it needed closing rather than trusting.
 */
const SCANNABLE = new Map<string, { type: CustomBlock["type"]; field?: string; zone: CardZone }>([
  ["logo",     { type: "logo", zone: "left" }],
  ["headshot", { type: "headshot", zone: "left" }],
  ["qr",       { type: "qr", zone: "right" }],
  ["name",     { type: "field", field: "name", zone: "right" }],
  ["title",    { type: "field", field: "title", zone: "right" }],
  ["company",  { type: "field", field: "company", zone: "right" }],
  ["phone",    { type: "field", field: "phone", zone: "right" }],
  ["email",    { type: "field", field: "email", zone: "right" }],
  ["website",  { type: "field", field: "website", zone: "right" }],
  ["address",  { type: "field", field: "address", zone: "right" }],
  ["fax",      { type: "field", field: "fax", zone: "right" }],
]);

export type ScanReading = {
  background?: unknown; textColor?: unknown; accentColor?: unknown;
  panelBackground?: unknown; skeleton?: unknown; serif?: unknown;
  blocks?: unknown;
};

/**
 * Turn what the model saw into a layout.
 *
 * The model CHOOSES AMONG OPTIONS; it never authors the layout. Every value is
 * validated against a whitelist here and anything unrecognised is dropped, so a
 * hallucinated block type, a malformed colour, or a hostile response can only
 * ever produce a plainer card — never a broken or unreadable one. The result is
 * then built through the same shape every preset uses, which is what makes a
 * scanned card inherit the guarantees the fuzz proved for hand-built ones.
 */
export function layoutFromScan(input: ScanReading | null | undefined): CustomLayout {
  const base = buildPreset(DEFAULT_PRESET);
  // Defensive rather than relying on the caller. The route already rejects a
  // non-object body, but this is exported and parses model output — a function
  // whose whole job is to survive untrusted input should not throw on null.
  const reading: ScanReading = input && typeof input === "object" ? input : {};

  const skeleton: CardSkeleton =
    reading.skeleton === "stacked" || reading.skeleton === "mirror" || reading.skeleton === "split"
      ? reading.skeleton
      : "split";

  const background = hex(reading.background, base.background);
  let textColor = hex(reading.textColor, "#ffffff");
  const accentColor = hex(reading.accentColor, textColor);

  // A card whose text matches its background is unreadable, and a photograph of
  // a glossy card makes that reading easy to get wrong. Rather than trust it,
  // flip the text to whichever end actually contrasts.
  const bgY = yiq(background);
  const txY = yiq(textColor);
  if (bgY !== null && txY !== null && Math.abs(bgY - txY) < 60) {
    textColor = bgY < 140 ? "#ffffff" : "#141b26";
  }

  const panelBackground = typeof reading.panelBackground === "string" && /^#[0-9a-f]{6}$/i.test(reading.panelBackground.trim())
    ? reading.panelBackground.trim().toLowerCase()
    : undefined;
  const panelY = panelBackground ? yiq(panelBackground) : null;

  // Read the block list, keeping only known ids, in the order given, no repeats.
  const raw = Array.isArray(reading.blocks) ? reading.blocks : [];
  const seen = new Set<string>();
  const chosen: CustomBlock[] = [];
  for (const item of raw) {
    const id = typeof item === "string" ? item : (item as { id?: unknown })?.id;
    if (typeof id !== "string") continue;
    const key = id.trim().toLowerCase();
    const spec = SCANNABLE.get(key);
    if (!spec || seen.has(key)) continue;
    seen.add(key);
    const e = (item as { emphasis?: unknown })?.emphasis;
    const emphasis: CardEmphasis = e === "hero" || e === "quiet" || e === "normal" ? e : "normal";
    chosen.push({
      id: key, type: spec.type, field: spec.field as CustomBlock["field"],
      on: true, zone: spec.zone, emphasis,
    });
    if (chosen.length >= MAX_VISIBLE_BLOCKS) break;
  }

  // A reading that produced nothing usable falls back to the default preset's
  // blocks rather than an empty card.
  const blocks = chosen.length >= 3 ? chosen : base.blocks!;

  // Anything the scan didn't mention is kept, switched OFF, so the owner can
  // turn it on without rebuilding it.
  const present = new Set(blocks.map((x) => x.id));
  const rest = (base.blocks ?? [])
    .filter((x) => !present.has(x.id))
    .map((x) => ({ ...x, on: false }));

  return {
    ...base,
    background, textColor, accentColor, panelBackground,
    panelTextColor: panelY !== null ? (panelY < 140 ? "#ffffff" : "#141b26") : undefined,
    fontFamily: reading.serif === true ? "Georgia, 'Times New Roman', serif" : base.fontFamily,
    skeleton,
    blocks: [...blocks, ...rest],
    elements: [],
  };
}

/** The exact instruction the vision model is given. Exported so a test can pin it. */
export const SCAN_PROMPT = [
  "You are looking at a photograph of a printed business card.",
  "Describe its DESIGN so it can be recreated. Return ONLY valid JSON, no prose:",
  '{"background":"#rrggbb","textColor":"#rrggbb","accentColor":"#rrggbb",',
  '"panelBackground":"#rrggbb or null","skeleton":"split|mirror|stacked","serif":true|false,',
  '"blocks":[{"id":"...","emphasis":"hero|normal|quiet"}]}',
  "",
  "background = the card's main surface colour.",
  "panelBackground = a SECOND surface if the card has a coloured band or side panel, else null.",
  'skeleton = "split" if a panel/logo sits on the LEFT, "mirror" if on the RIGHT, "stacked" if a band runs across the TOP.',
  "blocks = only the things actually printed on the card, IN READING ORDER.",
  `Allowed ids: ${[...SCANNABLE.keys()].join(", ")}.`,
  'emphasis = "hero" for the largest element, "quiet" for the smallest, "normal" otherwise.',
  "Do not invent anything you cannot see. Omit what is not there.",
].join("\n");

// ── Adding blocks ───────────────────────────────────────────────────────────

/** Blocks the owner can add that aren't in every preset. */
export const ADDABLE: { type: CustomBlock["type"]; field?: string; social?: string; label: string }[] = [
  { type: "field", field: "fax", label: "Fax" },
  { type: "text", label: "Custom text" },
  { type: "divider", label: "Divider line" },
  { type: "social", social: "linkedin", label: "LinkedIn" },
  { type: "social", social: "instagram", label: "Instagram" },
  { type: "social", social: "twitter", label: "X" },
  { type: "social", social: "tiktok", label: "TikTok" },
  { type: "social", social: "facebook", label: "Facebook" },
  { type: "social", social: "youtube", label: "YouTube" },
];

export function newBlockId(existing: CustomBlock[], base: string): string {
  let n = 1;
  let id = base;
  while (existing.some((x) => x.id === id)) id = `${base}-${++n}`;
  return id;
}

// ── Legacy ──────────────────────────────────────────────────────────────────

/**
 * Convert an absolute-positioned layout to blocks.
 *
 * Deliberately lossy and deliberately loud about it: x/y become a zone plus a
 * reading order, and a font size becomes the nearest emphasis. A layout someone
 * hand-tuned will shift, so the editor shows the result and offers undo rather
 * than converting anything silently on save.
 */
export function legacyToBlocks(elements: CustomElement[]): CustomBlock[] {
  return [...elements]
    .sort((a, c) => a.y - c.y || a.x - c.x)
    .map((el) => {
      const size = el.fontSize ?? el.size ?? 12;
      const emphasis: CardEmphasis =
        el.type === "field" || el.type === "text" || el.type === "social" || el.type === "socials"
          ? size >= 18 ? "hero" : size >= 11.5 ? "normal" : "quiet"
          : (el.size ?? 48) >= 96 ? "hero" : (el.size ?? 48) >= 70 ? "normal" : "quiet";
      return {
        id: el.id,
        type: el.type,
        field: el.field,
        social: el.social,
        text: el.text,
        on: true,
        // The old canvas was read left-to-right: anything past the midline was
        // the "side" column, which is what the left zone represents here.
        zone: (el.x >= 60 ? "left" : "right") as CardZone,
        emphasis,
        color: el.color,
      };
    });
}

// ── Normalisation ───────────────────────────────────────────────────────────

export function hasBlocks(layout: CustomLayout | null | undefined): boolean {
  return Array.isArray(layout?.blocks) && (layout as CustomLayout).blocks!.length > 0;
}

/**
 * Anything that would end a CSS declaration, start a comment, or fetch.
 *
 * `customLayout` is a JSON blob the owner PATCHes; the renderer spreads its
 * colours straight into a style object, so a value of `#111;position:fixed;
 * top:0;width:100vw;z-index:2147483647` becomes real declarations on the public
 * card, and `url(https://…)` becomes a request from every visitor. React
 * escapes quotes, so this was never XSS — but a stored full-viewport overlay on
 * someone else's card is worth closing anyway, and an office owner can push a
 * layout onto members' cards through the branding seed.
 */
const CSS_UNSAFE = /[;{}<>\\]|url\s*\(|image\s*\(|expression\s*\(|@import|\/\*/i;

/** A colour or gradient, or the fallback. Rejects rather than sanitising. */
function safeCss(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  // No colon: kills `position:fixed` and every `url(https://…)` in one test.
  if (!s || s.length > 200 || s.includes(":") || CSS_UNSAFE.test(s)) return fallback;
  return /^[#a-z0-9.,%()\s/-]+$/i.test(s) ? s : fallback;
}

/** Same rules, plus the quotes and underscores a font stack legitimately uses. */
function safeFont(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.trim();
  if (!s || s.length > 200 || s.includes(":") || CSS_UNSAFE.test(s)) return fallback;
  return /^[a-z0-9\s,'"()._-]+$/i.test(s) ? s : fallback;
}

/** Optional colour: undefined stays undefined so `??` defaults still fire. */
function safeCssOpt(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const out = safeCss(v, "");
  return out || undefined;
}

/**
 * Always hand back something renderable. A corrupted or half-written layout —
 * a restored guest draft that saved `customLayout: {}` is the real case that
 * crashed a card page once — falls back to the default preset rather than
 * throwing on a missing array.
 *
 * This is also the security boundary for the style sinks: every colour, every
 * gradient and the font stack are validated here, once, for both renderers.
 */
export function normalizeCustomLayout(raw: unknown): CustomLayout {
  const fallback = buildPreset(DEFAULT_PRESET);
  if (!raw || typeof raw !== "object") return fallback;
  const l = raw as CustomLayout;

  const style = {
    background: safeCss(l.background, fallback.background),
    textColor: safeCss(l.textColor, fallback.textColor),
    accentColor: safeCssOpt(l.accentColor),
    panelBackground: safeCssOpt(l.panelBackground),
    panelTextColor: safeCssOpt(l.panelTextColor),
    fontFamily: safeFont(l.fontFamily, fallback.fontFamily),
  };

  if (Array.isArray(l.blocks) && l.blocks.length) {
    return {
      ...fallback,
      ...l,
      ...style,
      blocks: l.blocks
        .filter((x) => x && typeof x.id === "string" && typeof x.type === "string")
        .map((x) => ({ ...x, color: safeCssOpt(x.color) })),
      elements: [],
    };
  }
  // An element that isn't an object crashes the legacy renderer on `el.x`, and
  // `Array.isArray([null]) && .length` was happily letting one through.
  const elements = Array.isArray(l.elements)
    ? l.elements
        .filter((e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.type === "string")
        .map((e) => ({
          ...e,
          x: Number.isFinite(e.x) ? e.x : 0,
          y: Number.isFinite(e.y) ? e.y : 0,
          color: safeCssOpt(e.color),
        }))
    : [];
  if (elements.length) return { ...fallback, ...l, ...style, blocks: undefined, elements };
  return { ...fallback, ...l, ...style, blocks: fallback.blocks, elements: [] };
}

/** Does this block have anything to show for this card? Drives "hidden" hints. */
export function blockHasValue(block: CustomBlock, data: CardData): boolean {
  const c = data.customization;
  switch (block.type) {
    case "logo": return !!data.logoUrl;
    case "headshot": return !!data.photoUrl;
    case "qr": return true;
    case "divider": return true;
    case "text": return !!block.text?.trim();
    case "socials":
      return [data.linkedin, data.instagram, data.twitter, data.tiktok, data.snapchat].some((s) => (s || "").trim());
    case "social":
      switch (block.social) {
        case "instagram": return !!data.instagram;
        case "linkedin": return !!data.linkedin;
        case "twitter": return !!data.twitter;
        case "tiktok": return !!data.tiktok;
        case "snapchat": return !!(data.snapchat || c?.snapchat);
        case "youtube": return !!c?.youtube;
        case "facebook": return !!c?.facebook;
        default: return false;
      }
    case "field":
      switch (block.field) {
        case "name": return !!data.name;
        case "title": return !!data.title;
        case "company": return !!data.company;
        case "phone": return !!(data.phone || c?.phones?.some((p) => p?.showOnCard && p.number?.trim()));
        case "email": return !!data.email;
        case "website": return !!data.website;
        case "address": return !!data.address;
        case "fax": return !!c?.fax?.trim();
        default: return false;
      }
    default: return false;
  }
}

export function blockLabel(block: CustomBlock): string {
  if (block.type === "field") {
    const map: Record<string, string> = {
      name: "Name", title: "Job title", company: "Company", phone: "Phone",
      email: "Email", website: "Website", address: "Address", fax: "Fax",
    };
    return map[block.field ?? ""] ?? "Field";
  }
  if (block.type === "social") {
    const map: Record<string, string> = {
      instagram: "Instagram", linkedin: "LinkedIn", twitter: "X", tiktok: "TikTok",
      snapchat: "Snapchat", youtube: "YouTube", facebook: "Facebook",
    };
    return map[block.social ?? ""] ?? "Social";
  }
  const map: Record<string, string> = {
    logo: "Logo", headshot: "Headshot", qr: "QR code", text: "Custom text",
    divider: "Divider line", socials: "Social handles",
  };
  return map[block.type] ?? block.type;
}

/** Which zone labels make sense for the chosen skeleton. */
export function zoneLabels(skeleton: CardSkeleton | undefined): Record<CardZone, string> {
  return skeleton === "stacked"
    ? { left: "Top band", right: "Below" }
    : { left: "Side panel", right: "Main area" };
}

/** Labelled for the "Panel" row in the designer, so they read as one sentence. */
export const SKELETONS: { key: CardSkeleton; label: string }[] = [
  { key: "split", label: "Left" },
  { key: "mirror", label: "Right" },
  { key: "stacked", label: "Across the top" },
];
