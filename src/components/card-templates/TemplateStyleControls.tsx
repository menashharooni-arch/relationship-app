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
import { META, FALLBACK_META, type Look } from "@/lib/template-style-presets";

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

// Small "PRO" tag for the arbitrary custom-color inputs — the one part of this
// panel that stays Pro-only once presets/Looks/fonts are Free-usable.
function ProTag() {
  return <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-blue-600 text-white leading-none">PRO</span>;
}

function Swatches({
  presets,
  value,
  fallbackHex,
  onPick,
  customLocked = false,
}: {
  presets: string[];
  value?: string;
  fallbackHex: string;
  onPick: (v: string | undefined) => void;
  customLocked?: boolean;
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
      <label
        className={`flex items-center gap-1 text-[10px] text-gray-500 ml-0.5 ${customLocked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"}`}
        aria-disabled={customLocked}
      >
        custom{customLocked && <ProTag />}
        <input
          type="color"
          value={isHex(value) ? value : fallbackHex}
          onChange={(e) => onPick(e.target.value)}
          disabled={customLocked}
          className="w-7 h-7 rounded bg-transparent border border-gray-700 cursor-pointer disabled:cursor-default"
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-5">
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
          <label
            className={`flex items-center gap-1 text-[10px] text-gray-500 ${locked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"}`}
            aria-disabled={locked}
          >
            Custom color{locked && <ProTag />}
            <input
              type="color"
              value={isHex(value.bgColor) ? value.bgColor : meta.bg.fallback}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              disabled={locked}
              className="w-7 h-7 rounded bg-transparent border border-gray-700 cursor-pointer disabled:cursor-default"
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
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} customLocked={locked} />
      </div>

      {/* 3) Details color — the actual contact information text */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.info.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.info.help}</p>
        <Swatches presets={meta.info.presets} value={value.infoColor} fallbackHex={meta.info.fallback} onPick={(v) => onChange({ infoColor: v })} customLocked={locked} />
      </div>

      {/* 4) Accent / icon color — the phone/email/address icons (the purple) */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.accent.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.accent.help}</p>
        <Swatches presets={meta.accent.presets} value={value.accentColor} fallbackHex={meta.accent.fallback} onPick={(v) => onChange({ accentColor: v })} customLocked={locked} />
      </div>

      {/* 5) Font */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Font</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Sets the typeface for your name and details across the whole card.</p>
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </div>
    </div>
  );
}
