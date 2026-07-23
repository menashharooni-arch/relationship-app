"use client";

// ── "Social design" — the Swift Links PAGE's look ───────────────────────────
// The 4th step of the card wizard/editor. Deliberately separate from the card's
// TemplateStyleControls: the card and the Swift Links page are different
// surfaces, so each has its own keys (LINK_STYLE_KEYS in lib/plan) and styling
// one never restyles the other.
//
// Two exports:
//   • SwiftLinkStyleControls — background / text color / font pickers
//   • SwiftLinkPagePreview   — a live mock of the real /links page, driven by
//     the same fields the wizard already holds, so the visitor sees exactly
//     how their Swift Links page will look as they edit.
// Free accounts keep the standard dark page (keys are stripped server-side);
// the custom color pickers carry the same PRO gating as the card controls.

import { CARD_FONT_OPTIONS, IcoInsta, IcoLinkedIn, IcoX, IcoTikTok } from "@/components/card-templates/shared";

export type SwiftLinkStyle = {
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
        <p className={`${rowLabel} mb-0.5`}>Page background</p>
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

// ── Live preview of the real /links page ────────────────────────────────────

const SOCIAL_PREVIEW: Record<string, { node: React.ReactNode; color: string }> = {
  instagram: { node: <IcoInsta />, color: "#E1306C" },
  tiktok: { node: <IcoTikTok />, color: "#0f172a" },
  linkedin: { node: <IcoLinkedIn />, color: "#0A66C2" },
  twitter: { node: <IcoX />, color: "#0f172a" },
};

function hostOf(url: string) {
  try { return new URL(url.includes("://") ? url : `https://${url}`).host.replace(/^www\./, ""); } catch { return url; }
}

export function SwiftLinkPagePreview({
  style,
  name,
  handle,
  company,
  bio,
  photoUrl,
  socialKeys,
  links,
}: {
  style: SwiftLinkStyle;
  name: string;
  handle: string;
  company?: string;
  bio?: string;
  photoUrl?: string | null;
  /** Which socials are filled in (e.g. ["instagram","linkedin"]). */
  socialKeys: string[];
  links: { label: string; url: string }[];
}) {
  const bg = style.linkBgColor || LINK_DEFAULT_BG;
  const text = style.linkTextColor || LINK_DEFAULT_TEXT;
  const font = style.linkFontFamily;
  const firstName = (name || "me").split(" ")[0];
  const initials = (name || "Y").trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "Y";
  const shown = socialKeys.filter((k) => SOCIAL_PREVIEW[k]);
  const extra = socialKeys.length - shown.length;

  return (
    <div className="w-[236px] max-w-full rounded-[26px] overflow-hidden shadow-2xl mx-auto" style={{ background: bg, fontFamily: font }}>
      {/* Hero */}
      <div className="relative w-full aspect-square overflow-hidden">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(160deg,#181538,#2A2466 60%,#4338ca)" }}>
            <span className="text-white/90 font-extrabold text-5xl">{initials}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: `linear-gradient(180deg,transparent,${bg})` }} />
      </div>
      {/* Sheet */}
      <div className="relative -mt-6 rounded-t-[22px] px-4 pt-4 pb-6 text-center" style={{ background: bg, color: text }}>
        <p className="font-extrabold text-[19px] leading-tight truncate" style={{ color: text }}>{name || "Your Name"}</p>
        <p className="text-[12px]" style={{ color: text, opacity: 0.45 }}>@{handle || "yourname"}</p>
        {company && <p className="text-[11px] font-medium mt-1.5" style={{ color: text, opacity: 0.55 }}>{company}</p>}
        {bio && <p className="text-[11.5px] leading-snug mt-2 line-clamp-3" style={{ color: text, opacity: 0.75 }}>{bio}</p>}
        {(shown.length > 0 || extra > 0) && (
          <div className="flex items-center justify-center gap-2.5 mt-3">
            {shown.map((k) => (
              <span key={k} className="w-8 h-8 rounded-full bg-white flex items-center justify-center" style={{ color: SOCIAL_PREVIEW[k].color }}>
                <span className="scale-[1.3] flex">{SOCIAL_PREVIEW[k].node}</span>
              </span>
            ))}
            {extra > 0 && (
              <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold" style={{ color: text }}>+{extra}</span>
            )}
          </div>
        )}
        <div className="mt-3.5 w-full py-2.5 rounded-2xl text-white text-[12.5px] font-semibold" style={{ background: "#1D4ED8" }}>
          Connect with {firstName}
        </div>
        {links.length > 0 && (
          <div className="mt-3 space-y-2">
            {links.slice(0, 3).map((l, i) => (
              <div key={i} className="w-full rounded-2xl px-3 py-2.5 text-left bg-white/[0.06] border border-white/10">
                <span className="block text-[12px] font-semibold truncate" style={{ color: text }}>{l.label}</span>
                <span className="block text-[10px] truncate" style={{ color: text, opacity: 0.4 }}>{hostOf(l.url)}</span>
              </div>
            ))}
            {links.length > 3 && (
              <p className="text-[10px]" style={{ color: text, opacity: 0.4 }}>+{links.length - 3} more link{links.length - 3 === 1 ? "" : "s"}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
