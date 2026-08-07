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

/**
 * Density factor. More on the card → everything shrinks TOGETHER, so hierarchy
 * survives and nothing has to be cut. Mirrors shared.ts's fitFactor so a custom
 * card behaves like the preset templates it was forked from.
 */
/**
 * Weighted row count. A block in the side panel is usually an image and costs
 * roughly two text rows of height, so a card with a logo AND a headshot stacked
 * on the left is as tall as one with four contact lines.
 */
function rowLoad(blocks: CustomBlock[], skeleton?: CardSkeleton): number {
  const on = blocks.filter((b) => b.on);
  // Weighted by EMPHASIS, not counted. A hero line is 25 design px and a quiet
  // one is 10, so treating them as equal rows was the modelling error behind a
  // string of small overflows: the valve fired on item count while the actual
  // height depended on which items. Two dial-tweaks failed to converge before
  // this; weighting by height fixed it in one.
  const textCost = (b: CustomBlock) =>
    b.emphasis === "hero" ? 2 : b.emphasis === "quiet" ? 0.85 : 1;
  const right = on
    .filter((b) => zoneFor(b) === "right" && b.type !== "qr")
    .reduce((n, b) => n + (TEXT_TYPES.has(b.type) ? textCost(b) : 2), 0);
  // What one side block costs in rows. Stacked, images are rendered smaller
  // (sideImageScale), so they cost less there than in a full-height panel.
  const cost = (b: CustomBlock) =>
    TEXT_TYPES.has(b.type) ? 1 : skeleton === "stacked" ? 1.6 : 2.2;

  const leftItems = on.filter((b) => zoneFor(b) === "left");
  // The side zone is a COLUMN in split/mirror and a ROW in stacked, so its
  // height is the sum in one and the tallest item in the other. Modelling it as
  // a sum in both under-fed the stacked band and over-fed it in split — the
  // fuzz found the failure each time this was wrong.
  const left = leftItems.length === 0 ? 0
    : skeleton === "stacked"
      ? Math.max(...leftItems.map(cost))
      : leftItems.reduce((n, b) => n + cost(b), 0);

  // Side by side the zones share the height, so the taller one sets it.
  // Stacked they genuinely ADD.
  return skeleton === "stacked" ? right + left : Math.max(right, left);
}

export function blockDensity(blocks: CustomBlock[], skeleton?: CardSkeleton): number {
  const rows = rowLoad(blocks, skeleton);
  if (rows <= 6) return Math.min(1.14, 1 + (6 - rows) * 0.05);
  return Math.max(0.76, 1 - (rows - 6) * 0.06);
}

/** Side-band images sit above the text when stacked, so they cost real height. */
export function sideImageScale(skeleton?: CardSkeleton): number {
  return skeleton === "stacked" ? 0.78 : 1;
}

/**
 * Last-resort safety valve, and the reason "you cannot break it" is true rather
 * than merely intended.
 *
 * Flow layout removes overlap and horizontal clipping, but it does NOT stop
 * content from being taller than a fixed-aspect card — a fuzz run of 220 random
 * edits found exactly that: pile on enough blocks and the QR gets pushed out
 * through the bottom edge. Shrinking text alone can't absorb it, because the
 * density floor exists so a card never becomes illegible. So past the point
 * where shrinking is enough, the CARD ITSELF grows taller. Same mechanism, and
 * the same reasoning, as cardAspect() in shared.ts.
 */
export function blockAspect(blocks: CustomBlock[], skeleton?: CardSkeleton): string {
  const rows = rowLoad(blocks, skeleton);
  // A card stays the classic 1.75 business-card shape until it genuinely can't —
  // a normal fork weighs about 7.4, comfortably inside the threshold.
  if (rows <= 8) return "1.75 / 1";
  return `${Math.max(1.3, 1.75 - (rows - 8) * 0.1).toFixed(3)} / 1`;
}

/**
 * How much a card can hold.
 *
 * Not an arbitrary limit — it is the point past which no amount of shrinking or
 * growing keeps the card readable. The fuzz run put 18 blocks on and the card
 * needed 415px of content in a 336px box even at the density floor and the
 * tallest allowed shape. Real business cards carry six to nine things; twelve is
 * already generous.
 *
 * Enforced in BOTH places on purpose: the editor stops you before you get there
 * and says why, and the renderer trims defensively so a hand-edited payload
 * can't produce a broken public card.
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

/**
 * One preset per SHIPPED TEMPLATE. "Start from Logo First" gives you that card,
 * rebuilt out of blocks, and then you can move things — which is the whole
 * proposition: every template is a starting point, not a dead end.
 *
 * These are reconstructions, not the template components themselves. A fork is
 * close, not pixel-identical: the preset templates each carry hand-tuned
 * typography the block engine expresses through three emphasis levels. Close is
 * the point — you're about to change it anyway.
 */
export const LAYOUT_PRESETS: Record<string, { label: string; blurb: string; build: () => CustomLayout }> = {
  "logo-first": {
    label: "Logo First",
    blurb: "Your mark on the left, details down the right.",
    build: () => ({
      background: "#2c3a52", textColor: "#ffffff", accentColor: "#ffffff",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
        b("socials", "socials", "right", "quiet", { on: false }),
      ],
    }),
  },
  "classic-pro": {
    label: "Classic Pro",
    blurb: "A coloured branding panel, clean white info beside it.",
    build: () => ({
      background: "#ffffff", textColor: "#0e1b35", accentColor: "#2563eb",
      panelBackground: "linear-gradient(160deg, #0e1b35 0%, #162947 100%)",
      panelTextColor: "#ffffff",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      skeleton: "split", elements: [],
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
  "photo-first": {
    label: "Photo First",
    blurb: "Face on the left — for people who sell in person.",
    build: () => ({
      background: "#ffffff", textColor: "#1e1b4b", accentColor: "#6d28d9",
      panelBackground: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)",
      panelTextColor: "#ffffff",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      skeleton: "split", elements: [],
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
  "modern-bold": {
    label: "Modern Bold",
    blurb: "Full-bleed dark with an oversized name.",
    build: () => ({
      background: "#070d1c", textColor: "#ffffff", accentColor: "#3b82f6",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        ...contacts(),
        b("qr", "qr", "right", "normal"),
      ],
    }),
  },
  "local-business": {
    label: "Local Business",
    blurb: "A bold header stripe with the phone as the hero.",
    build: () => ({
      background: "#fffaf0", textColor: "#7c2d12", accentColor: "#b45309",
      panelBackground: "linear-gradient(100deg, #b45309 0%, #d97706 60%, #f59e0b 100%)",
      panelTextColor: "#ffffff",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      skeleton: "stacked", elements: [],
      blocks: [
        b("logo", "logo", "left", "quiet"),
        b("name", "field", "right", "hero", { field: "name" }),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("phone", "field", "right", "hero", { field: "phone" }),
        b("email", "field", "right", "normal", { field: "email" }),
        b("website", "field", "right", "quiet", { field: "website" }),
        b("address", "field", "right", "quiet", { field: "address", on: false }),
        b("qr", "qr", "right", "normal"),
        b("title", "field", "right", "quiet", { field: "title", on: false }),
      ],
    }),
  },
  "luxury-minimal": {
    label: "Luxury Minimal",
    blurb: "Ivory, a gold accent, and a lot of restraint.",
    build: () => ({
      background: "#fafaf6", textColor: "#1c1612", accentColor: "#b08d57",
      fontFamily: "Georgia, 'Times New Roman', serif",
      skeleton: "split", elements: [],
      blocks: [
        b("logo", "logo", "left", "normal"),
        b("company", "field", "right", "quiet", { field: "company" }),
        b("name", "field", "right", "hero", { field: "name" }),
        b("title", "field", "right", "quiet", { field: "title" }),
        ...contacts(),
        b("qr", "qr", "right", "quiet"),
      ],
    }),
  },
};

export const DEFAULT_PRESET = "logo-first";

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
 * Always hand back something renderable. A corrupted or half-written layout —
 * a restored guest draft that saved `customLayout: {}` is the real case that
 * crashed a card page once — falls back to the default preset rather than
 * throwing on a missing array.
 */
export function normalizeCustomLayout(raw: unknown): CustomLayout {
  const fallback = buildPreset(DEFAULT_PRESET);
  if (!raw || typeof raw !== "object") return fallback;
  const l = raw as CustomLayout;

  if (Array.isArray(l.blocks) && l.blocks.length) {
    return {
      ...fallback,
      ...l,
      blocks: l.blocks.filter((x) => x && typeof x.id === "string" && typeof x.type === "string"),
      elements: Array.isArray(l.elements) ? l.elements : [],
    };
  }
  if (Array.isArray(l.elements) && l.elements.length) {
    return { ...fallback, ...l, blocks: undefined, elements: l.elements };
  }
  return { ...fallback, ...l, blocks: fallback.blocks, elements: [] };
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

export const SKELETONS: { key: CardSkeleton; label: string }[] = [
  { key: "split", label: "Side panel left" },
  { key: "mirror", label: "Side panel right" },
  { key: "stacked", label: "Stacked" },
];
