// Per-template curated "Looks" (one-tap coordinated background + name + font)
// and fine-tune swatch presets. Kept out of the JSX-heavy TemplateStyleControls
// so plain server code (src/lib/plan.ts) can read the same preset data to snap
// a Free account's saved colors to the nearest allowed swatch, without pulling
// a "use client" component into server bundles. Mirrors why template-style.ts
// is its own module.

export type Look = { name: string; bg: string; text: string; font?: string };

export type StyleField = {
  label: string;
  help: string;
  presets: string[];
  fallback: string;
};

export type TemplateMeta = {
  name: string;
  blurb: string;
  looks: Look[];
  bg: StyleField;
  text: StyleField;
  info: StyleField;
  accent: StyleField;
};

// A broad, tasteful accent palette shared by every template's icon/accent
// control (each template's own default is prepended so it's the first swatch).
export const ACCENT_PRESETS = ["#2563eb", "#6d28d9", "#0f766e", "#b45309", "#be123c", "#111827", "#b08d57", "#059669"];

const SERIF = "Georgia, 'Times New Roman', serif";

// Per-template descriptions, curated looks, and tailored fine-tune palettes.
export const META: Record<string, TemplateMeta> = {
  "classic-pro": {
    name: "Classic Pro",
    blurb: "A two-panel executive card — a colored branding panel on the left, clean white info on the right.",
    looks: [
      { name: "Executive Navy", bg: "linear-gradient(160deg, #0e1b35 0%, #162947 100%)", text: "#ffffff" },
      { name: "Onyx", bg: "#070d1c", text: "#ffffff" },
      { name: "Graphite", bg: "#111827", text: "#e5e7eb" },
      { name: "Forest", bg: "#052e2b", text: "#ffffff" },
      { name: "Burgundy", bg: "#3f1d2e", text: "#f3d9c6" },
      { name: "Sky", bg: "linear-gradient(160deg, #0e1b35 0%, #2563eb 100%)", text: "#ffffff" },
    ],
    bg: {
      label: "Branding panel",
      help: "The colored left panel behind your logo and name. The right info panel always stays white.",
      presets: ["#0e1b35", "#070d1c", "#111827", "#1c1612", "#052e2b", "#3f1d2e", "linear-gradient(160deg, #0e1b35 0%, #2563eb 100%)"],
      fallback: "#0e1b35",
    },
    text: {
      label: "Name color",
      help: "Your name on the branding panel. Use a light shade so it reads on the dark panel.",
      presets: ["#ffffff", "#f8fafc", "#d4af7a", "#bfdbfe"],
      fallback: "#ffffff",
    },
    info: {
      label: "Details color",
      help: "Your phone, email, and address on the white info panel — a dark ink reads best.",
      presets: ["#0e1b35", "#111827", "#334155", "#1c1612"],
      fallback: "#0e1b35",
    },
    accent: {
      label: "Accent / icons",
      help: "The color of the phone, email, and address icons next to your details.",
      presets: ACCENT_PRESETS,
      fallback: "#2563eb",
    },
  },
  "modern-bold": {
    name: "Modern Bold",
    blurb: "A full-bleed dark card with an oversized name and electric accents.",
    looks: [
      { name: "Electric Dark", bg: "#070d1c", text: "#ffffff" },
      { name: "Pure Black", bg: "#0a0a0a", text: "#ffffff" },
      { name: "Violet Night", bg: "linear-gradient(135deg, #111827 0%, #6d28d9 100%)", text: "#ffffff" },
      { name: "Deep Blue", bg: "linear-gradient(135deg, #0e1b35 0%, #2563eb 100%)", text: "#ffffff" },
      { name: "Emerald", bg: "#052e2b", text: "#6ee7b7" },
      { name: "Ember", bg: "#1c1010", text: "#fca5a5" },
    ],
    bg: {
      label: "Card background",
      help: "The entire card surface. Modern Bold is built for deep, dark tones — lighter colors will wash out the accents.",
      presets: ["#070d1c", "#0a0a0a", "#111827", "#0e1b35", "linear-gradient(135deg, #111827 0%, #6d28d9 100%)", "linear-gradient(135deg, #0e1b35 0%, #2563eb 100%)"],
      fallback: "#070d1c",
    },
    text: {
      label: "Name color",
      help: "Your oversized hero name. Keep it bright so it pops against the dark card.",
      presets: ["#ffffff", "#f8fafc", "#60a5fa", "#a78bfa"],
      fallback: "#ffffff",
    },
    info: {
      label: "Details color",
      help: "Your contact details sit on the dark card — keep them light so they stay legible.",
      presets: ["#f1f5f9", "#ffffff", "#cbd5e1", "#94a3b8"],
      fallback: "#f1f5f9",
    },
    accent: {
      label: "Accent / icons",
      help: "The electric icon color next to your phone, email, and address.",
      presets: ["#3b82f6", "#60a5fa", "#a78bfa", "#22d3ee", "#34d399", "#f472b6", "#fbbf24", "#ffffff"],
      fallback: "#3b82f6",
    },
  },
  "luxury-minimal": {
    name: "Luxury Minimal",
    blurb: "An ivory editorial card with a gold accent strip and a refined serif feel.",
    looks: [
      { name: "Ivory & Gold", bg: "#fafaf6", text: "#1c1612", font: SERIF },
      { name: "Warm Cream", bg: "#fffbf0", text: "#3f2d1a", font: SERIF },
      { name: "Pearl", bg: "#ffffff", text: "#0e1b35", font: SERIF },
      { name: "Sand", bg: "#f5efe3", text: "#1c1612", font: SERIF },
      { name: "Charcoal Luxe", bg: "#1c1612", text: "#d4af7a", font: SERIF },
    ],
    bg: {
      label: "Card background",
      help: "The ivory canvas of the whole card. Choose a soft, light tone to keep the premium look.",
      presets: ["#fafaf6", "#ffffff", "#fffbf0", "#f5efe3", "#f3f4f6", "#1c1612"],
      fallback: "#fafaf6",
    },
    text: {
      label: "Name color",
      help: "Your name in the serif headline. A deep charcoal, ink, or gold keeps it elegant on ivory.",
      presets: ["#1c1612", "#0e1b35", "#3f2d1a", "#8c6c34"],
      fallback: "#1c1612",
    },
    info: {
      label: "Details color",
      help: "Your contact details — deep ink on ivory, or a soft light or gold on the charcoal look.",
      presets: ["#1c1612", "#3f2d1a", "#8c6c34", "#d4af7a", "#e7dcc8"],
      fallback: "#1c1612",
    },
    accent: {
      label: "Accent / icons",
      help: "The gold accent used for the icons next to your details.",
      presets: ["#b08d57", "#c9a96e", "#8c6c34", "#d4af7a", "#1c1612", "#0e1b35", "#3f2d1a", "#a16207"],
      fallback: "#b08d57",
    },
  },
  "local-business": {
    name: "Local Business",
    blurb: "A warm card with a bold header stripe and the phone number as the hero.",
    looks: [
      { name: "Warm Amber", bg: "linear-gradient(100deg, #b45309 0%, #d97706 60%, #f59e0b 100%)", text: "#ffffff" },
      { name: "Forest", bg: "#166534", text: "#ffffff" },
      { name: "Teal", bg: "#0f766e", text: "#ffffff" },
      { name: "Midnight", bg: "#0e1b35", text: "#ffffff" },
      { name: "Cherry", bg: "#be123c", text: "#ffffff" },
      { name: "Slate", bg: "#334155", text: "#ffffff" },
    ],
    bg: {
      label: "Header stripe",
      help: "The colored banner across the top. The body below always stays warm cream.",
      presets: ["linear-gradient(100deg, #b45309 0%, #d97706 60%, #f59e0b 100%)", "#b45309", "#166534", "#0f766e", "#0e1b35", "#be123c"],
      fallback: "#b45309",
    },
    text: {
      label: "Name color",
      help: "Your name sits on the header stripe — a light shade reads best on the color.",
      presets: ["#ffffff", "#fffbf0", "#fde68a"],
      fallback: "#ffffff",
    },
    info: {
      label: "Details color",
      help: "Your contact details on the warm cream body — a rich brown or near-black reads best.",
      presets: ["#7c2d12", "#78350f", "#92400e", "#1c1612"],
      fallback: "#7c2d12",
    },
    accent: {
      label: "Accent / icons",
      help: "The color of the icons next to your phone, email, and address.",
      presets: ["#b45309", "#d97706", "#166534", "#0f766e", "#0e1b35", "#be123c", "#7c2d12", "#f59e0b"],
      fallback: "#b45309",
    },
  },
  "photo-first": {
    name: "Photo First",
    blurb: "A full-height photo on the left, and the info panel on the right whose background you set here.",
    looks: [
      { name: "Clean White", bg: "#ffffff", text: "#ffffff" },
      { name: "Royal Violet", bg: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)", text: "#ffffff" },
      { name: "Indigo", bg: "#4f46e5", text: "#ffffff" },
      { name: "Rose", bg: "linear-gradient(145deg, #be123c 0%, #f43f5e 100%)", text: "#ffffff" },
      { name: "Emerald", bg: "linear-gradient(145deg, #064e3b 0%, #10b981 100%)", text: "#ffffff" },
      { name: "Onyx", bg: "#0a0a0a", text: "#ffffff" },
    ],
    bg: {
      label: "Info panel background",
      help: "The panel behind your contact details on the right. A dark shade flips the text to light automatically; the photo stays on the left.",
      presets: ["#ffffff", "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)", "#4f46e5", "linear-gradient(145deg, #be123c 0%, #f43f5e 100%)", "#064e3b", "#0a0a0a"],
      fallback: "#ffffff",
    },
    text: {
      label: "Name color",
      help: "Your name overlaid on the photo — keep it light so it stands out over the image.",
      presets: ["#ffffff", "#f8fafc", "#d4af7a"],
      fallback: "#ffffff",
    },
    info: {
      label: "Details color",
      help: "Your contact details on the info panel. They adapt to the panel color, or set your own here.",
      presets: ["#111827", "#1e1b4b", "#ffffff", "#e5e7eb"],
      fallback: "#111827",
    },
    accent: {
      label: "Accent / icons",
      help: "The color of the icons next to your phone, email, and address.",
      presets: ["#6d28d9", "#7c3aed", "#4f46e5", "#2563eb", "#be123c", "#10b981", "#0a0a0a", "#d4af7a"],
      fallback: "#6d28d9",
    },
  },
};

export const FALLBACK_META: TemplateMeta = {
  name: "This template",
  blurb: "Restyle the background, name color, and font to make it yours.",
  looks: [
    { name: "Navy", bg: "#0e1b35", text: "#ffffff" },
    { name: "Onyx", bg: "#070d1c", text: "#ffffff" },
    { name: "Ivory", bg: "#fafaf6", text: "#1c1612" },
  ],
  bg: {
    label: "Background",
    help: "The card's main background surface.",
    presets: ["#0e1b35", "#070d1c", "#111827", "#ffffff", "#fafaf6", "#fffbf0"],
    fallback: "#0e1b35",
  },
  text: {
    label: "Name color",
    help: "The color of your name / headline text.",
    presets: ["#ffffff", "#f8fafc", "#1c1612", "#0e1b35"],
    fallback: "#ffffff",
  },
  info: {
    label: "Details color",
    help: "The color of your contact details (phone, email, address).",
    presets: ["#111827", "#334155", "#ffffff", "#e5e7eb"],
    fallback: "#111827",
  },
  accent: {
    label: "Accent / icons",
    help: "The color of the icons next to your contact details.",
    presets: ACCENT_PRESETS,
    fallback: "#2563eb",
  },
};

export function metaForTemplate(template?: string): TemplateMeta {
  return (template && META[template]) || FALLBACK_META;
}
