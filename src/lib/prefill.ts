// One-shot prefill channel for the marketing "mini builders".
//
// The homepage lets a visitor sketch a card / SwiftLink / signature by entering
// just the few fields needed to preview it. When they hit "Make it live", we
// stash what they typed here and send them to the real builder (/cards/new),
// which reads this once on mount to autofill its fields — then clears it so a
// later visit to /cards/new starts blank. Everything the visitor entered is
// their own data, kept in their own browser; nothing is sent anywhere until
// they actually create the card.

export type PrefillSocials = Partial<
  Record<"linkedin" | "instagram" | "tiktok" | "facebook" | "twitter" | "snapchat" | "youtube", string>
>;

export type PrefillAddress = Partial<Record<"street" | "unit" | "city" | "state" | "zip", string>>;

export type CardPrefill = {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: PrefillAddress;
  bio?: string;
  website?: string;
  socials?: PrefillSocials;
  links?: { label: string; url: string }[];
  template?: string;
  // ── Design (mirrors TemplateStyle in lib/template-style) ──────────────────
  // The homepage builders offer the SAME colour/font controls as the real
  // editor, so every key the editor can set has to survive the hand-off —
  // carrying only accentColor silently dropped a visitor's whole colour scheme
  // the moment they continued into the wizard.
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  infoColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;     // data URL from the guest crop — claimed on signup
  headshotUrl?: string | null; // data URL from the guest crop — claimed on signup
  /** Which product the visitor was building — picks the step the wizard opens
   *  on and which preview the builder shows. */
  product?: "card" | "swiftlink" | "signature";
  step?: number; // which wizard step to open on (1 details · 2 links · 3 design)
};

// Every design key a builder may carry over. Kept as one list so the sketch
// writer, the wizard's autofill, and the tests can't drift apart.
export const PREFILL_STYLE_KEYS = ["accentColor", "bgColor", "textColor", "infoColor", "fontFamily"] as const;

const KEY = "swiftcard_prefill";

export function writePrefill(data: CardPrefill): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage blocked — the builder just starts blank, no harm */
  }
}

// True when a sketch has any real content worth carrying over (ignores the
// always-present template default and the target step).
export function hasSketchContent(data: CardPrefill): boolean {
  return Boolean(
    data.name || data.title || data.company || data.email || data.phone ||
    data.fax || data.bio || data.website || data.headshotUrl || data.logoUrl ||
    (data.links && data.links.length) ||
    (data.socials && Object.values(data.socials).some(Boolean)) ||
    (data.address && Object.values(data.address).some(Boolean)) ||
    // A visitor who ONLY restyled the card still sketched something worth
    // carrying — otherwise their colour/font work is dropped on hand-off.
    PREFILL_STYLE_KEYS.some((k) => data[k]),
  );
}

// Live "sketch" sync for the marketing mini-builders. They call this as the
// visitor types so that ANY entry point carries the latest sketch into the
// wizard — not just that builder's own "Make it live", but also the generic
// "Get started" / "Create your free card" buttons elsewhere on the page.
// Unlike writePrefill it no-ops on an empty sketch, so a visitor who never
// touched a builder still gets a blank wizard. Deliberately omits `step`, so
// these generic entry points land on step 1 (the first info page); an explicit
// "Make it live" calls writePrefill with its own step.
export function stashSketch(data: CardPrefill): void {
  if (!hasSketchContent(data)) return;
  const { step: _step, ...withoutStep } = data;
  void _step;
  writePrefill(withoutStep);
}

// Drop the stashed sketch outright. Used when the visitor abandons a mini
// builder (closes it / heads Home) — the next visit to any builder must start
// from a blank slate rather than resurrecting what they half-typed earlier.
export function clearPrefill(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — nothing was stashed to begin with */
  }
}

// Read once and remove, so the prefill is consumed exactly one time.
export function consumePrefill(): CardPrefill | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    return JSON.parse(raw) as CardPrefill;
  } catch {
    return null;
  }
}
