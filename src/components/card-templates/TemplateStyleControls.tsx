"use client";

// Pro control for restyling the FIVE preset templates. Deliberately scoped to
// exactly three things — BACKGROUND surface, NAME/text color, and FONT — because
// everything else (layout, accents, textures) is what gives each template its
// signature look. Each template exposes these three differently: what the
// "background" actually is (a side panel vs. the whole card vs. a header stripe)
// and where the name text sits changes per template, so the labels, helper copy,
// and preset palettes below are tailored to each one.
//
// Purely presentational — the parent owns the TemplateStyle value and persists
// it on customization. Every field is optional; clearing one ("Default") returns
// that property to the template's baked-in design. Consumed by NewCardWizard and
// CardEditForm.

import { CARD_FONT_OPTIONS } from "./shared";
import type { TemplateStyle } from "./shared";

type StyleField = {
  label: string;
  help: string;
  presets: string[];
  fallback: string;
};

type TemplateMeta = {
  name: string;
  blurb: string;
  bg: StyleField;
  text: StyleField;
};

// Per-template descriptions + tailored palettes. Presets are chosen to suit each
// template's character (dark panels vs. cream canvases vs. warm stripes).
const META: Record<string, TemplateMeta> = {
  "classic-pro": {
    name: "Classic Pro",
    blurb: "A two-panel executive card — a colored branding panel on the left, clean white info on the right.",
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
    blurb: "A full-height photo on the left, a clean white info panel on the right.",
    bg: {
      label: "Photo panel",
      help: "The color behind your photo on the left — it shows through if you have no photo and tints the edges. The right info panel stays white.",
      presets: ["linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)", "#4f46e5", "linear-gradient(145deg, #be123c 0%, #f43f5e 100%)", "linear-gradient(145deg, #064e3b 0%, #10b981 100%)", "#334155", "#0a0a0a"],
      fallback: "#6d28d9",
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
          style={{
            background: p,
            border: value === p ? "2px solid #3b82f6" : "1px solid #374151",
            boxShadow: value === p ? "0 0 0 2px rgba(59,130,246,0.25)" : undefined,
          }}
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
          value === undefined
            ? "border-blue-600 text-blue-300"
            : "border-gray-700 text-gray-500 hover:text-gray-300"
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
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 ${
        locked ? "opacity-60 pointer-events-none select-none" : ""
      }`}
      aria-disabled={locked}
    >
      {/* Per-template intro + live preview */}
      <div className="flex items-start gap-3">
        <div
          className="w-14 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-gray-700"
          style={{ background: value.bgColor ?? meta.bg.fallback }}
          aria-hidden
        >
          <span
            className="text-[13px] font-bold leading-none"
            style={{ color: value.textColor ?? meta.text.fallback, fontFamily: value.fontFamily }}
          >
            Aa
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{meta.name}</p>
          <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-relaxed border-l-2 border-gray-800 pl-2">
        You can restyle the <span className="text-gray-300">background</span>, <span className="text-gray-300">name color</span>, and <span className="text-gray-300">font</span>. Everything else keeps {meta.name}&apos;s signature design.
      </p>

      {/* Background */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>{meta.bg.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.bg.help}</p>
        <Swatches presets={meta.bg.presets} value={value.bgColor} fallbackHex={meta.bg.fallback} onPick={(v) => onChange({ bgColor: v })} />
      </div>

      {/* Name / text color */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>{meta.text.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.text.help}</p>
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} />
      </div>

      {/* Font */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>Font</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Sets the typeface for your name and details across the whole card.</p>
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </div>
    </div>
  );
}
