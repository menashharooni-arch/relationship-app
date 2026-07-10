"use client";

// Pro control for restyling the FIVE preset templates: accent color, the
// primary branding surface (background), hero text color, and typography.
// Purely presentational — the parent owns the TemplateStyle value and persists
// it on customization. Every field is optional; clearing one ("Default")
// returns that property to the template's baked-in design, which is exactly how
// an untouched / pre-existing card renders. Consumed by NewCardWizard and
// CardEditForm.

import { CARD_FONT_OPTIONS } from "./shared";
import type { TemplateStyle } from "./shared";

const ACCENT_PRESETS = [
  "#2563eb", "#3b82f6", "#7c3aed", "#6d28d9", "#db2777",
  "#dc2626", "#ea580c", "#d97706", "#b08d57", "#16a34a",
  "#0891b2", "#0e1b35",
];

const BG_PRESETS = [
  "#0e1b35", "#070d1c", "#111827", "#1c1612", "#ffffff", "#fafaf6", "#fffbf0",
  "linear-gradient(135deg, #0e1b35 0%, #2563eb 100%)",
  "linear-gradient(135deg, #111827 0%, #6d28d9 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
  "linear-gradient(135deg, #1c1612 0%, #b08d57 100%)",
];

const TEXT_PRESETS = ["#ffffff", "#f8fafc", "#1c1612", "#0e1b35", "#111827"];

function isHex(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

const rowLabel = "text-[11px] font-semibold text-gray-400 uppercase tracking-wide";

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
          className="w-6 h-6 rounded-lg transition-transform hover:scale-110"
          style={{
            background: p,
            border: value === p ? "2px solid #3b82f6" : "1px solid #374151",
          }}
        />
      ))}
      <label className="flex items-center gap-1 text-[10px] text-gray-500 ml-0.5">
        custom
        <input
          type="color"
          value={isHex(value) ? value : fallbackHex}
          onChange={(e) => onPick(e.target.value)}
          className="w-6 h-6 rounded bg-transparent border border-gray-700 cursor-pointer"
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

export default function TemplateStyleControls({
  value,
  onChange,
  locked = false,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
  locked?: boolean;
}) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-3.5 space-y-3.5 ${
        locked ? "opacity-60 pointer-events-none select-none" : ""
      }`}
      aria-disabled={locked}
    >
      <div>
        <p className={`${rowLabel} mb-1.5`}>Accent color</p>
        <Swatches presets={ACCENT_PRESETS} value={value.accentColor} fallbackHex="#2563eb" onPick={(v) => onChange({ accentColor: v })} />
      </div>

      <div>
        <p className={`${rowLabel} mb-1.5`}>Background</p>
        <Swatches presets={BG_PRESETS} value={value.bgColor} fallbackHex="#0e1b35" onPick={(v) => onChange({ bgColor: v })} />
      </div>

      <div>
        <p className={`${rowLabel} mb-1.5`}>Name color</p>
        <Swatches presets={TEXT_PRESETS} value={value.textColor} fallbackHex="#ffffff" onPick={(v) => onChange({ textColor: v })} />
      </div>

      <div>
        <p className={`${rowLabel} mb-1.5`}>Font</p>
        <select
          value={value.fontFamily ?? ""}
          onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="">Default</option>
          {CARD_FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
