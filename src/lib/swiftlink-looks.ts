// ── Swift Links "Looks" — named, composed page themes ───────────────────────
//
// The old "Social design" was three raw knobs (background / text / font), and
// Free got none of them — every Free page was the same dark sheet. Nobody
// composes a good palette from three color pickers; they pick a vibe. So the
// page now works like the card templates' "Looks": one choice sets the whole
// scheme — sheet, page backdrop, text, accent, tile surface — composed to
// read well together, with the Pro pickers acting as fine-tuning on top.
//
// Design reference: hoo.be (dissected 2026-08-18). Their premium feel is a
// LIGHT editorial page — white sheet, dark text, flat image tiles — which is
// why the default Look here is light ("Paper"), not the old dark stock. The
// old stock survives, unchanged, as "Onyx".
//
// PLAN LINE (matches plan-content's "Social design" being a Pro feature, with
// a deliberate Free floor): Free picks between the two FREE_SWIFTLINK_LOOKS;
// the rest of the library and the custom color pickers stay Pro. Enforced
// server-side in lib/plan's sanitizeCustomizationForPlan via freeSafeLook().
//
// Every look must pass tests/swiftlink-looks.test.ts: text-on-sheet and
// accentText-on-accent both ≥ 4.5:1 (WCAG AA). Change a value, run the test.

export type SwiftLinkLook = {
  id: string;
  /** Shown in the picker. */
  name: string;
  /** Governs how neutral chrome (rings, hovers, shadows) renders. */
  mode: "light" | "dark";
  /** The sheet — the page's main surface behind name/bio/socials/links. */
  sheet: string;
  /** The backdrop behind the phone-width column on desktop. */
  page: string;
  /** Name, bio, labels. */
  text: string;
  /** The action color — Connect button, selected states. */
  accent: string;
  /** Text on the accent (a light accent needs dark text). */
  accentText: string;
  /** Surface behind link tiles while their image loads / with no image. */
  tile: string;
};

export const SWIFTLINK_LOOKS: SwiftLinkLook[] = [
  // ── Free ──────────────────────────────────────────────────────────────────
  {
    // The DEFAULT. Light, warm-white, editorial — the hoo.be register.
    id: "paper", name: "Paper", mode: "light",
    sheet: "#FAFAF7", page: "#ECEAE4", text: "#111827",
    accent: "#1D4ED8", accentText: "#FFFFFF", tile: "#E8E6DF",
  },
  {
    // The pre-Looks stock page, byte-for-byte — existing pages keep their
    // exact colors by selecting this.
    id: "onyx", name: "Onyx", mode: "dark",
    sheet: "#191A1A", page: "#09090B", text: "#FFFFFF",
    accent: "#1D4ED8", accentText: "#FFFFFF", tile: "#242526",
  },
  // ── Pro ───────────────────────────────────────────────────────────────────
  {
    // hoo.be ships a palette by this name; warm pink + terracotta.
    id: "blush", name: "Blush", mode: "light",
    sheet: "#FBF2EF", page: "#F1E3DE", text: "#46292B",
    accent: "#A8433C", accentText: "#FFFFFF", tile: "#F0E0DA",
  },
  {
    id: "sand", name: "Sand", mode: "light",
    sheet: "#F7F1E4", page: "#EDE4D0", text: "#3B2E1A",
    accent: "#92400E", accentText: "#FFFFFF", tile: "#EDE5D2",
  },
  {
    // Monochrome minimal — near-black accent on silver.
    id: "chrome", name: "Chrome", mode: "light",
    sheet: "#F4F5F7", page: "#E5E7EB", text: "#0F172A",
    accent: "#111827", accentText: "#FFFFFF", tile: "#E9EAEE",
  },
  {
    id: "forest", name: "Forest", mode: "dark",
    sheet: "#0C231E", page: "#06140F", text: "#E7F6EF",
    accent: "#10B981", accentText: "#052E27", tile: "#143229",
  },
  {
    id: "midnight", name: "Midnight", mode: "dark",
    sheet: "#0B1220", page: "#05080F", text: "#E6EDFB",
    accent: "#60A5FA", accentText: "#0B1220", tile: "#131C2E",
  },
  {
    id: "orchid", name: "Orchid", mode: "dark",
    sheet: "#1C1229", page: "#0F0A18", text: "#F3EEFB",
    accent: "#A78BFA", accentText: "#1C1229", tile: "#271A38",
  },
];

/** Look ids Free accounts may store and render. Order = picker order. */
export const FREE_SWIFTLINK_LOOKS = ["paper", "onyx"] as const;

/** The default for every page with no stored choice. Light, per the owner's
 *  2026-08-18 call: "default should be light". */
export const DEFAULT_SWIFTLINK_LOOK = "paper";

export function getLook(id?: string | null): SwiftLinkLook {
  return SWIFTLINK_LOOKS.find((l) => l.id === id)
    ?? SWIFTLINK_LOOKS.find((l) => l.id === DEFAULT_SWIFTLINK_LOOK)!;
}

export function isFreeLook(id?: string | null): boolean {
  return (FREE_SWIFTLINK_LOOKS as readonly string[]).includes(id ?? "");
}

/** What a FREE page actually renders/stores: a free look survives, anything
 *  else (a Pro look after downgrade, junk) falls to the default. */
export function freeSafeLook(id?: string | null): string {
  return isFreeLook(id) ? (id as string) : DEFAULT_SWIFTLINK_LOOK;
}

/** rgba() of a hex color — the sticky mini-header's translucent bar. */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
