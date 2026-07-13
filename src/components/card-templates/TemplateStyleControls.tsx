"use client";

// Pro control for restyling the FIVE preset templates. Scoped to what actually
// keeps a card looking professional — BACKGROUND surface, NAME/text color, and
// FONT — because layout, accents and textures are each template's signature.
//
// Two tiers so it's powerful without being overwhelming:
//   1. "Looks" — one-tap curated themes (coordinated background + name + font),
//      tailored to each template. This is where most people should live.
//   2. "Fine-tune" — the granular background / name color / font controls,
//      collapsed by default.
//
// Purely presentational — the parent owns the TemplateStyle value and persists
// it on customization. Clearing a fine-tune field ("Default") returns that
// property to the template's baked-in design. Consumed by NewCardWizard and
// CardEditForm.

import { CARD_FONT_OPTIONS, isDarkBg } from "./shared";
import type { TemplateStyle } from "./shared";

const SERIF = "Georgia, 'Times New Roman', serif";

type Look = { name: string; bg: string; text: string; font?: string };

type StyleField = {
  label: string;
  help: string;
  presets: string[];
  fallback: string;
};

type TemplateMeta = {
  name: string;
  blurb: string;
  looks: Look[];
  bg: StyleField;
  text: StyleField;
};

// Per-template descriptions, curated looks, and tailored fine-tune palettes.
const META: Record<string, TemplateMeta> = {
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
  },
};

const FALLBACK_META: TemplateMeta = {
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
};

function isHex(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

const rowLabel = "text-[11px] font-semibold text-gray-300 uppercase tracking-wide";

function looksActive(value: TemplateStyle, look: Look): boolean {
  const fontMatch = (value.fontFamily ?? undefined) === (look.font ?? undefined);
  return value.bgColor === look.bg && value.textColor === look.text && fontMatch;
}

function LooksGallery({
  looks,
  value,
  onPick,
}: {
  looks: Look[];
  value: TemplateStyle;
  onPick: (look: Look) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {looks.map((look) => {
        const active = looksActive(value, look);
        return (
          <button
            key={look.name}
            type="button"
            onClick={() => onPick(look)}
            className="group text-left"
            aria-pressed={active}
          >
            <div
              className="h-11 rounded-lg flex items-center px-2.5 transition-transform group-hover:scale-[1.03]"
              style={{
                background: look.bg,
                border: active ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                boxShadow: active ? "0 0 0 2px rgba(59,130,246,0.25)" : undefined,
              }}
            >
              {/* Aa uses a legible color for the picker even on light themes */}
              <span className="text-sm font-bold leading-none" style={{ color: isDarkBg(look.bg) ? look.text : "#111827", fontFamily: look.font }}>Aa</span>
            </div>
            <p className={`mt-1 text-[10px] leading-tight truncate ${active ? "text-blue-300 font-semibold" : "text-gray-500"}`}>{look.name}</p>
          </button>
        );
      })}
    </div>
  );
}

function Swatches({
  presets,
  value,
  fallbackHex,
  onPick,
}: {
  presets: string[];
  value?: string;
  fallbackHex: string;
  onPick: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          aria-label="Color preset"
          className="w-7 h-7 rounded-lg transition-transform hover:scale-110"
          style={{ background: p, border: value === p ? "2px solid #3b82f6" : "1px solid #374151" }}
        />
      ))}
      <label className="flex items-center gap-1 text-[10px] text-gray-500 ml-0.5 cursor-pointer">
        custom
        <input
          type="color"
          value={isHex(value) ? value : fallbackHex}
          onChange={(e) => onPick(e.target.value)}
          className="w-7 h-7 rounded bg-transparent border border-gray-700 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => onPick(undefined)}
        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
          value === undefined ? "border-blue-600 text-blue-300" : "border-gray-700 text-gray-500 hover:text-gray-300"
        }`}
      >
        Default
      </button>
    </div>
  );
}

function FontPills({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const options = [{ label: "Default", value: undefined as string | undefined }, ...CARD_FONT_OPTIONS];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((o) => {
        const active = value === o.value || (value == null && o.value == null);
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
              active ? "border-blue-600 bg-blue-600/10" : "border-gray-700 hover:border-gray-600 bg-gray-800/40"
            }`}
          >
            <span className={`text-xs ${active ? "text-blue-200" : "text-gray-300"}`}>{o.label}</span>
            <span className="text-base leading-none text-white" style={{ fontFamily: o.value }}>Ag</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TemplateStyleControls({
  value,
  onChange,
  template,
  locked = false,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
  template?: string;
  locked?: boolean;
}) {
  const meta = (template && META[template]) || FALLBACK_META;

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-5 ${
        locked ? "opacity-60 pointer-events-none select-none" : ""
      }`}
      aria-disabled={locked}
    >
      {/* Per-template intro + live preview swatch */}
      <div className="flex items-start gap-3">
        <div
          className="w-14 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-gray-700"
          style={{ background: value.bgColor ?? meta.bg.fallback }}
          aria-hidden
        >
          <span className="text-[13px] font-bold leading-none" style={{ color: value.textColor ?? meta.text.fallback, fontFamily: value.fontFamily }}>Aa</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{meta.name}</p>
          <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      {/* 1) Background — the ONE place for the card's surface. Tapping a theme
          also coordinates the name color + font; the custom picker and Default
          adjust just the background. */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>{meta.bg.label}</p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">{meta.bg.help}</p>
        <LooksGallery looks={meta.looks} value={value} onPick={(look) => onChange({ bgColor: look.bg, textColor: look.text, fontFamily: look.font })} />
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
            Custom color
            <input
              type="color"
              value={isHex(value.bgColor) ? value.bgColor : meta.bg.fallback}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="w-7 h-7 rounded bg-transparent border border-gray-700 cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange({ bgColor: undefined })}
            className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
              value.bgColor === undefined ? "border-blue-600 text-blue-300" : "border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            Default
          </button>
        </div>
      </div>

      {/* 2) Name color */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.text.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.text.help}</p>
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} />
      </div>

      {/* 3) Font */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Font</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Sets the typeface for your name and details across the whole card.</p>
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </div>
    </div>
  );
}
