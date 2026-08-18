"use client";

// ── "Social design" — the Swift Links PAGE's look ───────────────────────────
// The 4th step of the card wizard/editor. Deliberately separate from the card's
// TemplateStyleControls: the card and the Swift Links page are different
// surfaces, so each has its own keys (LINK_STYLE_KEYS in lib/plan) and styling
// one never restyles the other.
//
// Exports SwiftLinkStyleControls — a named-Look picker (the whole scheme in
// one tap; see lib/swiftlink-looks, designed against hoo.be) with the custom
// background / text / font pickers beneath it as Pro fine-tuning.
// The live PREVIEW is no longer a mock here: SwiftLinkLivePreview renders the
// REAL SwiftLinkProfile (embedded + scaled) so the wizard/editor/mini-builder
// previews are byte-for-byte the published page — see SwiftLinkLivePreview.tsx.
// Plan line: FREE picks between the two free Looks (light "Paper" default and
// the dark "Onyx" stock); the rest of the Look library and every custom picker
// carry PRO gating, enforced server-side in sanitizeCustomizationForPlan.

import { CARD_FONT_OPTIONS } from "@/components/card-templates/shared";
import { SWIFTLINK_LOOKS, DEFAULT_SWIFTLINK_LOOK, isFreeLook } from "@/lib/swiftlink-looks";

export type SwiftLinkStyle = {
  linkLook?: string;
  linkBgColor?: string;
  linkTextColor?: string;
  linkFontFamily?: string;
};

export const LINK_DEFAULT_BG = "#191a1a"; // the page's stock dark sheet
export const LINK_DEFAULT_TEXT = "#ffffff";

// Dark-leaning curated backgrounds — the page's translucent-white link cards
// and social chips are designed for rich/dark surfaces, so the presets stay in
// that family; the custom picker (Pro) allows anything.
const BG_PRESETS = ["#191a1a", "#0b1220", "#14203a", "#1d1330", "#052e2b", "#2a1414", "#1f2937"];
const TEXT_PRESETS = ["#ffffff", "#f8fafc", "#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8"];

function isHex(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

const rowLabel = "text-[11px] font-semibold text-gray-300 uppercase tracking-wide";

function ProTag() {
  return <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-blue-600 text-white leading-none">PRO</span>;
}

function SwatchRow({
  presets,
  value,
  fallbackHex,
  onPick,
  customLocked,
}: {
  presets: string[];
  value?: string;
  fallbackHex: string;
  onPick: (v: string | undefined) => void;
  customLocked: boolean;
}) {
  return (
    // The presets lean dark (the page's link cards are designed for rich/dark
    // surfaces), so on the editor's own dark panel they read as faded blobs.
    // A light well behind them + bigger swatches with a crisp ring makes each
    // color clearly visible. When the whole feature is plan-locked (Free in
    // the editor), the presets disable too — a Free pick previewed live but
    // was stripped server-side on save, silently reverting (audit fix).
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-200/90 px-2.5 py-2">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          disabled={customLocked}
          aria-label="Color preset"
          className="w-8 h-8 rounded-lg transition-transform hover:scale-110 shadow-sm disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-default"
          style={{ background: p, border: value === p ? "2.5px solid #2563eb" : "1px solid rgba(15,23,42,0.25)" }}
        />
      ))}
      <label
        className={`flex items-center gap-1 text-[10px] text-gray-600 ml-0.5 ${customLocked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"}`}
        aria-disabled={customLocked}
      >
        custom{customLocked && <ProTag />}
        <input
          type="color"
          value={isHex(value) ? value : fallbackHex}
          onChange={(e) => onPick(e.target.value)}
          disabled={customLocked}
          className="w-8 h-8 rounded bg-transparent border border-gray-400 cursor-pointer disabled:cursor-default"
        />
      </label>
      <button
        type="button"
        onClick={() => onPick(undefined)}
        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
          value === undefined ? "border-blue-600 text-blue-700 font-semibold" : "border-gray-400 text-gray-600 hover:text-gray-900"
        }`}
      >
        Default
      </button>
    </div>
  );
}

function LookPicker({
  value,
  onPick,
  locked,
}: {
  value?: string;
  onPick: (id: string | undefined) => void;
  /** Free session: free Looks stay tappable (that IS the free feature); the
   *  Pro library renders with a PRO tag, disabled. */
  locked: boolean;
}) {
  const selected = value ?? DEFAULT_SWIFTLINK_LOOK;
  return (
    <div className="grid grid-cols-2 gap-2">
      {SWIFTLINK_LOOKS.map((l) => {
        const active = selected === l.id;
        const proLocked = locked && !isFreeLook(l.id);
        return (
          <button
            key={l.id}
            type="button"
            disabled={proLocked}
            onClick={() => onPick(l.id === DEFAULT_SWIFTLINK_LOOK ? undefined : l.id)}
            aria-pressed={active}
            className={`relative rounded-xl p-3 text-left transition-all border-2 ${
              active ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.25)]" : "border-transparent"
            } ${proLocked ? "opacity-45 cursor-default" : "hover:scale-[1.02]"}`}
            style={{ background: l.sheet, boxShadow: active ? undefined : "inset 0 0 0 1px rgba(127,127,127,0.35)" }}
          >
            {/* The swatch IS the look: its own sheet, its own text, its accent
                as the dot — no abstract color chips to decode. */}
            <span className="block text-[15px] font-extrabold leading-none" style={{ color: l.text }}>Ag</span>
            <span className="mt-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.accent }} />
              <span className="text-[11px] font-semibold" style={{ color: l.text }}>{l.name}</span>
              {proLocked && <ProTag />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SwiftLinkStyleControls({
  value,
  onChange,
  locked = false,
}: {
  value: SwiftLinkStyle;
  onChange: (patch: Partial<SwiftLinkStyle>) => void;
  locked?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-5">
      <div>
        <p className={`${rowLabel} mb-0.5`}>Look</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">One tap sets the whole page — background, text, and button color, composed to read well together.</p>
        <LookPicker value={value.linkLook} onPick={(v) => onChange({ linkLook: v })} locked={locked} />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Page background{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">The surface behind your photo, bio, socials and links.</p>
        <SwatchRow
          presets={BG_PRESETS}
          value={value.linkBgColor}
          fallbackHex={LINK_DEFAULT_BG}
          onPick={(v) => onChange({ linkBgColor: v })}
          customLocked={locked}
        />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Text color</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Your name, bio and link labels.</p>
        <SwatchRow
          presets={TEXT_PRESETS}
          value={value.linkTextColor}
          fallbackHex={LINK_DEFAULT_TEXT}
          onPick={(v) => onChange({ linkTextColor: v })}
          customLocked={locked}
        />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Font</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Sets the typeface across your Swift Links page.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[{ label: "Default", value: undefined as string | undefined }, ...CARD_FONT_OPTIONS].map((o) => {
            const active = value.linkFontFamily === o.value || (value.linkFontFamily == null && o.value == null);
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => onChange({ linkFontFamily: o.value })}
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
      </div>
    </div>
  );
}

