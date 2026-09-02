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
import {
  SWIFTLINK_LOOKS, DEFAULT_SWIFTLINK_LOOK, isFreeLook, getLook,
  ICON_SHAPES, ICON_FILLS, normalizeIconShape, normalizeIconFill,
  HERO_STYLES, BUTTON_STYLES, normalizeHeroStyle, normalizeButtonStyle,
  HERO_CONTENTS, normalizeHeroContent,
} from "@/lib/swiftlink-looks";

export type SwiftLinkStyle = {
  linkLook?: string;
  linkBgColor?: string;
  linkTextColor?: string;
  linkFontFamily?: string;
  linkIconShape?: string;
  linkIconFill?: string;
  /** Page header layout: "cover" (full hero, default), "banner" (a third of
   *  the screen), "avatar" (compact circle) or "none" (flat page).
   *  Structural — every plan, like the Look picker. */
  linkHeroStyle?: string;
  /** What the header shows: "auto" (headshot → logo → initials, default),
   *  "photo", "logo" or "initials". Every plan. */
  linkHeroContent?: string;
  /** Link rows: "tile" (rich preview tiles, default), "solid", "outline". */
  linkButtonStyle?: string;
  /** Solid/outline row color — defaults to the Look's accent. */
  linkButtonColor?: string;
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
            style={{
              // The swatch paints the surface the look actually produces: the
              // gradient for gradient looks; a photo-like violet haze standing
              // in for the owner's blurred headshot on Aura.
              background: l.aura
                ? "linear-gradient(150deg, #3B2B52 0%, #17131E 45%, #24303F 100%)"
                : l.sheetTo
                  ? `linear-gradient(180deg, ${l.sheet} 0%, ${l.sheetTo} 100%)`
                  : l.sheet,
              boxShadow: active ? undefined : "inset 0 0 0 1px rgba(127,127,127,0.35)",
            }}
          >
            {/* The swatch is a MINI PAGE, not an abstract chip — avatar dot,
                a name line in the look's text, and its accent as the Connect
                bar, so each card previews the page it produces. */}
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: l.text, opacity: 0.25 }} />
              <span className="text-[12px] font-extrabold leading-none truncate" style={{ color: l.text }}>Sam Okafor</span>
            </span>
            <span className="mt-1.5 block h-1 w-2/3 rounded-full" style={{ background: l.text, opacity: 0.18 }} />
            <span className="mt-2 block h-[14px] w-full rounded-full" style={{ background: l.accent }} />
            <span className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: l.text }}>{l.name}</span>
              {l.aura && <span className="text-[9px] leading-none" style={{ color: l.text, opacity: 0.55 }}>· your photo, blurred</span>}
              {proLocked && <ProTag />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function IconStyleControls({
  look,
  shape,
  fill,
  onChange,
  locked,
}: {
  look: ReturnType<typeof getLook>;
  shape: ReturnType<typeof normalizeIconShape>;
  fill: ReturnType<typeof normalizeIconFill>;
  onChange: (patch: Partial<SwiftLinkStyle>) => void;
  locked: boolean;
}) {
  const radius = (sh: string) => (sh === "circle" ? "9999px" : sh === "squircle" ? "10px" : "5px");
  // The three demo chips preview the CURRENT selection against the CURRENT
  // Look, so what you see here is what the page renders — same contract as
  // the live preview beside the panel.
  const chipStyle = (brand: string): React.CSSProperties =>
    fill === "accent"
      ? { background: look.accent, color: look.accentText }
      : fill === "mono"
        ? look.mode === "light"
          ? { background: "#FFFFFF", color: "#111827", boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)" }
          : { background: "rgba(255,255,255,0.12)", color: "#FFFFFF" }
        : { background: brand, color: "#fff" };
  return (
    <div className="space-y-3">
      {/* Live chips on the Look's own sheet */}
      <div className="flex items-center justify-center gap-2.5 rounded-xl py-3" style={{ background: look.sheet }}>
        {["#0A66C2", "#E4405F", "#FF0000"].map((brand) => (
          <span
            key={brand}
            className="w-9 h-9 flex items-center justify-center text-[13px] font-bold"
            style={{ ...chipStyle(brand), borderRadius: radius(shape) }}
          >
            in
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {ICON_SHAPES.map((o) => {
          const active = shape === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => onChange({ linkIconShape: o.id === "circle" ? undefined : o.id })}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
              }`}
            >
              <span className="w-4 h-4 bg-gray-300" style={{ borderRadius: radius(o.id) }} />
              {o.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {ICON_FILLS.map((o) => {
          const active = fill === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => onChange({ linkIconFill: o.id === "brand" ? undefined : o.id })}
              title={o.hint}
              className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
              }`}
            >
              {o.name}
            </button>
          );
        })}
      </div>
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
        {/* Picking a Look also clears the fine-tune background/text overrides:
            they'd win over the Look at render time, so a stale custom color
            would make every Look "not work" until the user found and reset it. */}
        <LookPicker value={value.linkLook} onPick={(v) => onChange({ linkLook: v, linkBgColor: undefined, linkTextColor: undefined, linkButtonColor: undefined })} locked={locked} />
        {locked && (
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">Paper and Onyx are included free — the rest of the library comes with Pro.</p>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        {/* Every plan — structural, like the Look picker, so never disabled. */}
        <p className={`${rowLabel} mb-0.5`}>Page header</p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">How your photo sits at the top — a full cover, or a compact circle that leaves more room for your links.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {HERO_STYLES.map((o) => {
            const active = normalizeHeroStyle(value.linkHeroStyle) === o.id;
            return (
              <button
                key={o.id}
                type="button"
                title={o.hint}
                onClick={() => onChange({ linkHeroStyle: o.id === "cover" ? undefined : o.id })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold text-left transition-colors ${
                  active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                }`}
              >
                {/* Mini page sketch: cover = tall photo band; banner = short
                    band; avatar = small circle; none = just content lines */}
                <span className="w-7 h-9 rounded-[5px] bg-gray-900 border border-gray-600 overflow-hidden flex flex-col items-center shrink-0">
                  {o.id === "cover" ? (
                    <><span className="w-full h-4 bg-gray-400" /><span className="mt-1 h-[3px] w-4 rounded bg-gray-500" /></>
                  ) : o.id === "banner" ? (
                    <><span className="w-full h-2.5 bg-gray-400" /><span className="mt-1 h-[3px] w-4 rounded bg-gray-500" /><span className="mt-0.5 h-[3px] w-4 rounded bg-gray-600" /></>
                  ) : o.id === "avatar" ? (
                    <><span className="mt-1.5 w-3 h-3 rounded-full bg-gray-400" /><span className="mt-1 h-[3px] w-4 rounded bg-gray-500" /></>
                  ) : (
                    <><span className="mt-1.5 h-[3px] w-4 rounded bg-gray-500" /><span className="mt-1 h-[3px] w-4 rounded bg-gray-600" /><span className="mt-1 h-[3px] w-4 rounded bg-gray-600" /></>
                  )}
                </span>
                {o.name}
              </button>
            );
          })}
        </div>
        {/* What the header shows — hidden for "No header" (nothing to show). */}
        {normalizeHeroStyle(value.linkHeroStyle) !== "none" && (
          <div className="mt-2.5">
            <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Header shows — Auto uses your headshot, else your logo, else initials.</p>
            <div className="grid grid-cols-4 gap-1.5">
              {HERO_CONTENTS.map((o) => {
                const active = normalizeHeroContent(value.linkHeroContent) === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    title={o.hint}
                    onClick={() => onChange({ linkHeroContent: o.id === "auto" ? undefined : o.id })}
                    className={`px-1 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${
                      active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Social icons{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">The shape and color of your social chips.</p>
        <IconStyleControls
          look={getLook(value.linkLook)}
          shape={normalizeIconShape(value.linkIconShape)}
          fill={normalizeIconFill(value.linkIconFill)}
          onChange={onChange}
          locked={locked}
        />
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>
          Link buttons
          <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-gray-500 align-middle">only for Compact style</span>
          {locked && <span className="ml-1.5 align-middle"><ProTag /></span>}
        </p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">Only has an effect if some of your additional links show as Compact rows — links set to Featured or Grid (in Socials) always keep their image previews.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {BUTTON_STYLES.map((o) => {
            const active = normalizeButtonStyle(value.linkButtonStyle) === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={locked}
                title={o.hint}
                onClick={() => onChange({ linkButtonStyle: o.id === "tile" ? undefined : o.id })}
                className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                  active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                }`}
              >
                {/* Mini glyph: standard = quiet translucent row; solid = filled row; outline = bordered row */}
                {o.id === "tile" ? (
                  <span className="w-8 h-4 rounded-full bg-gray-700 ring-1 ring-gray-500 flex items-center justify-center"><span className="w-4 h-[3px] rounded bg-gray-400" /></span>
                ) : o.id === "solid" ? (
                  <span className="w-8 h-4 rounded-full bg-gray-300 flex items-center justify-center"><span className="w-4 h-[3px] rounded bg-gray-700" /></span>
                ) : (
                  <span className="w-8 h-4 rounded-full border-[1.5px] border-gray-300 flex items-center justify-center"><span className="w-4 h-[3px] rounded bg-gray-400" /></span>
                )}
                {o.name}
              </button>
            );
          })}
        </div>
        {normalizeButtonStyle(value.linkButtonStyle) !== "tile" && (
          <div className="mt-2.5">
            <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Button color — leave Default to use your Look&apos;s accent.</p>
            <SwatchRow
              presets={["#1D4ED8", "#111827", "#A8433C", "#0F766E", "#7C3AED", "#B91C1C"]}
              value={value.linkButtonColor}
              fallbackHex={getLook(value.linkLook).accent}
              onPick={(v) => onChange({ linkButtonColor: v })}
              customLocked={locked}
            />
          </div>
        )}
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

