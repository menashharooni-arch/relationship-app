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

import { useRef, useState } from "react";
import { CARD_FONT_OPTIONS } from "@/components/card-templates/shared";
import {
  DEFAULT_SWIFTLINK_LOOK, isFreeLook, getLook,
  LOOK_FAMILIES, looksInFamily, washGradient, hexAlpha,
  type SwiftLinkLook, type LookFamily,
  ICON_SHAPES, ICON_FILLS, normalizeIconShape, normalizeIconFill,
  HERO_STYLES, normalizeHeroStyle,
  HERO_CONTENTS, normalizeHeroContent,
  normalizePageDim, MAX_PAGE_DIM,
} from "@/lib/swiftlink-looks";
import { isAllowedMedia, uploadMedia, uploadErrorMessage, WRONG_TYPE_MESSAGE, IMAGE_TYPES, VIDEO_TYPES } from "@/lib/upload-media";
import { resolveRowStyle } from "@/lib/swiftlink-tiles";
import LinkButtonsControls from "@/components/LinkButtonsControls";
import type { CardLink } from "@/components/card-templates/types";

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
   *  "photo", "logo", "initials" or "custom" (an uploaded header photo).
   *  Every plan. */
  linkHeroContent?: string;
  /** The uploaded header photo for linkHeroContent "custom" — a public URL
   *  from /api/upload (field "hero"). Every plan. */
  linkHeroImage?: string;
  /** PAGE BACKGROUND MEDIA — a photo or short video behind the whole page,
   *  offered only with the compact-circle header (see lib/swiftlink-looks for
   *  why). Pro: all four keys are in LINK_STYLE_KEYS. */
  linkBgMedia?: string;
  /** "image" | "video" — which element renders linkBgMedia. */
  linkBgMediaType?: string;
  /** Scrim over the media, 0-80%. The readability control. */
  linkBgDim?: number;
  /** Frost the plain link rows over the media. */
  linkGlass?: boolean;
  /** LEGACY page-wide row style ("tile" | "solid" | "outline") written by the
   *  pre-2026-09-09 "Link buttons" control. Still read as the fallback for a
   *  link with no rowStyle of its own; nothing writes it any more. */
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

const rowLabel = "text-[0.6875rem] font-semibold text-gray-300 uppercase tracking-wide";

function ProTag() {
  return <span className="text-[0.5rem] font-bold px-1 py-0.5 rounded-full bg-blue-600 text-white leading-none">PRO</span>;
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
        className={`flex items-center gap-1 text-[0.625rem] text-gray-600 ml-0.5 ${customLocked ? "opacity-50 pointer-events-none select-none" : "cursor-pointer"}`}
        aria-disabled={customLocked}
      >
        custom{customLocked && <ProTag />}
        <input
          aria-label="Accent colour"
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
        className={`text-[0.625rem] px-2 py-1 rounded-lg border transition-colors ${
          value === undefined ? "border-blue-600 text-blue-700 font-semibold" : "border-gray-400 text-gray-600 hover:text-gray-900"
        }`}
      >
        Default
      </button>
    </div>
  );
}

/** One look, drawn as a miniature of the page it produces. */
function LookSwatch({
  look,
  active,
  proLocked,
  onPick,
}: {
  look: SwiftLinkLook;
  active: boolean;
  proLocked: boolean;
  onPick: () => void;
}) {
  const wash = washGradient(look);
  return (
    <button
      type="button"
      disabled={proLocked}
      onClick={onPick}
      aria-pressed={active}
      title={look.name}
      className={`relative rounded-xl p-3 text-left transition-all border-2 overflow-hidden ${
        active ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.25)]" : "border-transparent"
      } ${proLocked ? "opacity-45 cursor-default" : "hover:scale-[1.02]"}`}
      style={{
        // The swatch paints the surface the look actually produces: the
        // gradient for gradient looks; a photo-like violet haze standing
        // in for the owner's blurred headshot on Aura.
        background: look.aura
          ? "linear-gradient(150deg, #3B2B52 0%, #17131E 45%, #24303F 100%)"
          : look.sheetTo
            ? `linear-gradient(180deg, ${look.sheet} 0%, ${look.sheetTo} 100%)`
            : look.sheet,
        boxShadow: active ? undefined : "inset 0 0 0 1px rgba(127,127,127,0.35)",
      }}
    >
      {/* A GLASS swatch is built the way the page is: the wash underneath, the
          frosted sheet over it. Painting a flat approximation instead would
          make the one family you cannot describe in words the one family the
          picker misrepresents. */}
      {wash && (
        <>
          <span aria-hidden className="absolute inset-0" style={{ background: wash }} />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background: hexAlpha(look.sheet, look.frost ?? 0.7),
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
        </>
      )}
      {/* The swatch is a MINI PAGE, not an abstract chip — avatar dot,
          a name line in the look's text, and its accent as the Connect
          bar, so each card previews the page it produces. The look's OWN
          name sits in the name position (owner order 2026-09-02: no more
          "Sam Okafor" placeholder person) — it labels the template and
          previews its typography in one line. */}
      <span className="relative flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full shrink-0" style={{ background: look.text, opacity: 0.25 }} />
        <span className="text-[0.75rem] font-extrabold leading-none truncate" style={{ color: look.text }}>{look.name}</span>
      </span>
      <span className="relative mt-1.5 block h-1 w-2/3 rounded-full" style={{ background: look.text, opacity: 0.18 }} />
      <span className="relative mt-2 block h-[14px] w-full rounded-full" style={{ background: look.accent }} />
      <span className="relative mt-2 flex items-center gap-1.5 min-h-[11px]">
        {look.aura && <span className="text-[0.5625rem] leading-none" style={{ color: look.text, opacity: 0.55 }}>your photo, blurred</span>}
        {proLocked && <ProTag />}
      </span>
    </button>
  );
}

/**
 * The Look picker: three labelled groups that drop down.
 *
 * Owner request 2026-09-10. The flat grid of every look at once had grown to
 * seventeen cards — a wall you scroll past rather than a choice you make — and
 * it gave the new see-through designs nowhere to be introduced. Grouping by
 * MATERIAL (see LOOK_FAMILIES) is the split a non-designer can predict: you can
 * tell which of the three a page is by looking at it.
 *
 * Behaviour chosen so the control never hides the thing you came for:
 *   • The group holding the CURRENT look is the one open on arrival.
 *   • A closed group still shows its selection — the look's name and a swatch
 *     of its real surface — so you can read your current design without
 *     opening anything.
 *   • One open at a time, the same accordion idiom as Settings, so the panel
 *     cannot grow into the same wall this replaced.
 *   • Free keeps both its looks in Solid and can still OPEN the two Pro groups
 *     to see what they are. Hiding them would make the upgrade abstract.
 */
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
  const selectedLook = getLook(selected);
  // Opens on the group you are already in. Not stored: reopening the editor
  // should land you back on your own design, not on whatever you browsed last.
  const [open, setOpen] = useState<LookFamily | null>(selectedLook.family);

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
      {LOOK_FAMILIES.map((fam) => {
        const looks = looksInFamily(fam.id);
        const isOpen = open === fam.id;
        const holdsSelection = selectedLook.family === fam.id;
        // A whole group is Pro when none of its looks are free — true for
        // Gradient and Glass, and the tag says so on the row rather than
        // making you open it to find out.
        const famLocked = locked && !looks.some((l) => isFreeLook(l.id));
        return (
          <div key={fam.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : fam.id)}
              aria-expanded={isOpen}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                isOpen ? "bg-gray-800/50" : "hover:bg-gray-800/30"
              }`}
            >
              {/* The group's own swatch — three chips of the material, so the
                  row shows what "Glass" means before you open it. */}
              <span className="flex -space-x-1 shrink-0">
                {looks.slice(0, 3).map((l) => (
                  <span
                    key={l.id}
                    className="w-4 h-4 rounded-full ring-1 ring-gray-900"
                    style={{
                      background: washGradient(l)
                        ?? (l.aura
                          ? "linear-gradient(150deg, #3B2B52 0%, #17131E 45%, #24303F 100%)"
                          : l.sheetTo
                            ? `linear-gradient(180deg, ${l.sheet} 0%, ${l.sheetTo} 100%)`
                            : l.sheet),
                    }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[0.6875rem] font-semibold text-gray-200">{fam.name}</span>
                  {famLocked && <ProTag />}
                  {holdsSelection && (
                    <span className="text-[0.5625rem] font-bold uppercase tracking-wide text-blue-300">{selectedLook.name}</span>
                  )}
                </span>
                <span className="block text-[0.625rem] text-gray-500 leading-snug">{fam.blurb}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5 pt-0.5">
                {looks.map((l) => (
                  <LookSwatch
                    key={l.id}
                    look={l}
                    active={selected === l.id}
                    proLocked={locked && !isFreeLook(l.id)}
                    onPick={() => onPick(l.id === DEFAULT_SWIFTLINK_LOOK ? undefined : l.id)}
                  />
                ))}
              </div>
            )}
          </div>
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
            className="w-9 h-9 flex items-center justify-center text-[0.8125rem] font-bold"
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
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[0.6875rem] font-semibold transition-colors disabled:opacity-40 ${
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
              className={`px-2 py-2 rounded-lg border text-[0.6875rem] font-semibold transition-colors disabled:opacity-40 ${
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

// Upload row for the "Upload photo" header option: choose/replace/remove the
// header image. Uploads deferred (field "hero", defer=true) — the URL is
// persisted through the editor's normal customization save, never here. With
// no image yet the page falls down the auto chain, so the header can never
// render empty while the owner decides.
function HeroImageUpload({
  url,
  onChange,
}: {
  url?: string;
  onChange: (patch: Partial<SwiftLinkStyle>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("field", "hero");
      fd.append("defer", "true");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.url) {
        // A guest in the wizard can't reach the upload route (401) — say what
        // to do instead of parroting "Unauthorized".
        setError(r.status === 401
          ? "Sign in to upload — finish creating your card first, then add it here."
          : (typeof d?.error === "string" ? d.error : "Upload failed — please try again."));
        return;
      }
      onChange({ linkHeroImage: d.url });
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = ""; // re-picking the same file must fire again
        }}
      />
      <div className="flex items-center gap-2.5">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Header" className="w-12 h-12 rounded-lg object-cover border border-gray-700 shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-lg border border-dashed border-gray-600 bg-gray-800/40 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-5 h-5 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
            </svg>
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/40 text-[0.6875rem] font-semibold text-gray-300 hover:border-gray-600 transition-colors disabled:opacity-50"
          >
            {busy ? "Uploading…" : url ? "Replace photo" : "Choose photo"}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={() => onChange({ linkHeroImage: undefined })}
              className="px-3 py-1.5 rounded-lg text-[0.6875rem] font-semibold text-gray-500 hover:text-gray-300 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-[0.625rem] text-red-400 mt-1.5 leading-snug">{error}</p>}
      {!url && !error && <p className="text-[0.625rem] text-gray-500 mt-1.5 leading-snug">Until you upload one, the header uses Auto.</p>}
    </div>
  );
}

// ── Page background media ───────────────────────────────────────────────────
//
// Add / Edit / Remove for the photo or video behind the whole page, plus the
// two controls that only make sense once one is set: how far to darken it, and
// whether the plain link rows go frosted over it.
//
// Rendered ONLY under the compact-circle header — see lib/swiftlink-looks for
// why that pairing and no other. Switching the header away hides this section
// and stops the background rendering, but never deletes it: switch back and
// the photo, the scrim and the frosting are all still there.
function PageBackgroundMedia({
  value,
  onChange,
  locked,
}: {
  value: SwiftLinkStyle;
  onChange: (patch: Partial<SwiftLinkStyle>) => void;
  locked: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = value.linkBgMedia;
  const isVideo = value.linkBgMediaType === "video";
  const dim = normalizePageDim(value.linkBgDim);

  async function pickFile(file: File) {
    if (!isAllowedMedia(file)) {
      setError(WRONG_TYPE_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const media = await uploadMedia(file, "pagebg");
      // The type is written WITH the url, in one patch. Two patches could
      // interleave with another edit and leave a video url flagged as an
      // image, which renders an <img> pointed at an mp4 — a broken page.
      //
      // Frosting defaults ON for a first background. Side by side it is not
      // close: over a busy photo the stock translucent rows let the picture
      // read straight through the labels, and the frosted ones stay crisp.
      // `?? true` and not `|| true`: once the owner has turned it off it is
      // stored as an explicit false, and replacing the photo must not quietly
      // turn it back on.
      onChange({
        linkBgMedia: media.url,
        linkBgMediaType: media.type,
        linkGlass: value.linkGlass ?? true,
      });
    } catch (e) {
      setError(uploadErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2.5">
      <input
        ref={fileRef}
        type="file"
        accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
          e.target.value = ""; // re-picking the same file must fire again
        }}
      />

      <div className="flex items-center gap-2.5">
        {url ? (
          isVideo ? (
            // muted + playsInline so the thumbnail can show a frame without
            // the browser refusing to load it or making noise in the editor.
            <video
              src={`${url}#t=0.001`}
              muted
              playsInline
              preload="auto"
              className="w-12 h-12 rounded-lg object-cover border border-gray-700 shrink-0 bg-black"
              aria-label="Background video"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Page background" className="w-12 h-12 rounded-lg object-cover border border-gray-700 shrink-0" />
          )
        ) : (
          <span className="w-12 h-12 rounded-lg border border-dashed border-gray-600 bg-gray-800/40 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-5 h-5 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
            </svg>
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/40 text-[0.6875rem] font-semibold text-gray-300 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:hover:border-gray-700"
          >
            {busy ? "Uploading…" : url ? "Edit" : "Add"}
          </button>
          {url && !busy && (
            <button
              type="button"
              disabled={locked}
              // Clears the type alongside the url. Leaving a stale "video"
              // behind would mislabel the NEXT photo the owner adds.
              onClick={() => onChange({ linkBgMedia: undefined, linkBgMediaType: undefined })}
              className="px-3 py-1.5 rounded-lg text-[0.6875rem] font-semibold text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-[0.625rem] text-red-400 mt-1.5 leading-snug">{error}</p>}
      {!url && !error && (
        <p className="text-[0.625rem] text-gray-500 mt-1.5 leading-snug">
          A photo or a short video fills the page behind everything. Portrait shots fit best. Photos up to 5 MB, videos up to 25 MB.
        </p>
      )}

      {url && (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[0.625rem] text-gray-400 leading-snug">Darken</p>
              <span className="text-[0.625rem] font-semibold text-gray-400 tabular-nums">{dim}%</span>
            </div>
            {/* The readability control, not a decoration: a bright photo makes
                white text vanish, and this is the only thing that fixes it.
                Shown with the media because on its own it does nothing. */}
            <input
              type="range"
              min={0}
              max={MAX_PAGE_DIM}
              step={5}
              value={dim}
              disabled={locked}
              aria-label="Darken the background"
              onChange={(e) => onChange({ linkBgDim: normalizePageDim(e.target.value) })}
              className="w-full accent-blue-500 disabled:opacity-50"
            />
            <p className="text-[0.625rem] text-gray-500 mt-0.5 leading-snug">Darker backgrounds make your name and links easier to read.</p>
          </div>

          <label className={`mt-3 flex items-start gap-2.5 rounded-lg border border-gray-700 bg-gray-800/40 px-2.5 py-2 ${locked ? "opacity-50" : "cursor-pointer hover:border-gray-600"} transition-colors`}>
            <input
              type="checkbox"
              checked={!!value.linkGlass}
              disabled={locked}
              onChange={(e) => onChange({ linkGlass: e.target.checked })}
              className="mt-0.5 w-3.5 h-3.5 accent-blue-500 shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-[0.6875rem] font-semibold text-gray-200">Blur the link buttons</span>
              <span className="block text-[0.625rem] text-gray-500 leading-snug">Frosted glass rows, so your background shows softly through them.</span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

export function SwiftLinkStyleControls({
  value,
  onChange,
  locked = false,
  links,
  onLinksChange,
  canUpload = true,
}: {
  value: SwiftLinkStyle;
  onChange: (patch: Partial<SwiftLinkStyle>) => void;
  locked?: boolean;
  /** The card's additional links, for the per-link "Link buttons" section.
   *  Both editors pass them; the marketing mini-builder doesn't. */
  links?: CardLink[];
  onLinksChange?: (links: CardLink[]) => void;
  /** False where there is no signed-in account to upload against — the
   *  marketing mini-builder, whose sketch is a visitor's doodle. Every upload
   *  route answers 401 there, so the "Add" button would be a dead end; the
   *  same reasoning that gives the mini-builder no "Link buttons" section. */
  canUpload?: boolean;
}) {
  // The compact-circle header is what unlocks the page-background media below.
  // Derived once so the two sections can never disagree about which header is
  // selected.
  const isAvatarHeader = normalizeHeroStyle(value.linkHeroStyle) === "avatar";

  // ── SECTION ORDER IS DELIBERATE: biggest visual change nearest the preview ──
  //
  //   Look → Page header → Page background → Text color → Font → Social icons
  //   → Link buttons
  //
  // On a phone this whole step is about 3.3 screens tall and the preview sits at
  // the top, so a control's DISTANCE from the preview is what it costs to use:
  // change something, scroll up to see it, scroll back. Measured at 390px wide,
  // Page background and Text color used to sit ~1,440px and ~1,600px below the
  // preview — nearly two screens — despite changing the look of the page more
  // than anything else here. Social icons and Link buttons were above them and
  // change far less. They have swapped places.
  //
  // WHY PAGE HEADER STAYS SECOND, above the palette: the background section's
  // photo/video upload only appears when the header is the compact circle
  // (isAvatarHeader below). Putting the palette first would mean discovering the
  // upload, being told to change the header, scrolling DOWN to do it, then back
  // UP — the control that unlocks the option has to come before the option.
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-5">
      <div>
        <p className={`${rowLabel} mb-0.5`}>Look</p>
        <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">One tap sets the whole page — background, text, and button color, composed to read well together. Open a style below to see its designs.</p>
        {/* Picking a Look also clears the fine-tune background/text overrides:
            they'd win over the Look at render time, so a stale custom color
            would make every Look "not work" until the user found and reset it. */}
        <LookPicker value={value.linkLook} onPick={(v) => onChange({ linkLook: v, linkBgColor: undefined, linkTextColor: undefined, linkButtonColor: undefined })} locked={locked} />
        {locked && (
          <p className="text-[0.625rem] text-gray-500 mt-2 leading-snug">Paper and Onyx are included free — the rest of the library comes with Pro.</p>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        {/* Every plan — structural, like the Look picker, so never disabled. */}
        <p className={`${rowLabel} mb-0.5`}>Page header</p>
        <p className="text-[0.625rem] text-gray-500 mb-2 leading-snug">How your photo sits at the top — a full cover, or a compact circle that leaves more room for your links.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {HERO_STYLES.map((o) => {
            const active = normalizeHeroStyle(value.linkHeroStyle) === o.id;
            return (
              <button
                key={o.id}
                type="button"
                title={o.hint}
                onClick={() => onChange({ linkHeroStyle: o.id === "cover" ? undefined : o.id })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[0.6875rem] font-semibold text-left transition-colors ${
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
            <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">Header shows — Auto uses your headshot, else your logo, else initials. Or upload a photo just for the header.</p>
            <div className="grid grid-cols-3 gap-1.5">
              {HERO_CONTENTS.map((o) => {
                const active = normalizeHeroContent(value.linkHeroContent) === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    title={o.hint}
                    onClick={() => onChange({ linkHeroContent: o.id === "auto" ? undefined : o.id })}
                    className={`px-1 py-2 rounded-lg border text-[0.6875rem] font-semibold transition-colors ${
                      active ? "border-blue-600 bg-blue-600/10 text-blue-200" : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
            {normalizeHeroContent(value.linkHeroContent) === "custom" && (
              <HeroImageUpload url={value.linkHeroImage} onChange={onChange} />
            )}
          </div>
        )}
      </div>


      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Page background{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
        <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">
          {isAvatarHeader
            ? "A colour, or a photo or video filling the whole page behind your links."
            : "The surface behind your photo, bio, socials and links."}
        </p>
        <SwatchRow
          presets={BG_PRESETS}
          value={value.linkBgColor}
          fallbackHex={LINK_DEFAULT_BG}
          onPick={(v) => onChange({ linkBgColor: v })}
          customLocked={locked}
        />
        {/* Only with the compact circle. The cover and banner headers already
            lead with a big photo, and "No header" is the deliberately flat
            page — see lib/swiftlink-looks. */}
        {isAvatarHeader && canUpload && <PageBackgroundMedia value={value} onChange={onChange} locked={locked} />}
        {/* A background stored under the compact circle is HIDDEN by another
            header, not deleted. Saying so is the difference between "my photo
            vanished" and "I know where it went". */}
        {!isAvatarHeader && value.linkBgMedia && (
          <p className="text-[0.625rem] text-gray-500 mt-2 leading-snug">
            Your background photo or video is saved. It shows when the page header is set to <span className="text-gray-400 font-semibold">Compact circle</span>.
          </p>
        )}
      </div>

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Text color</p>
        <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">Your name, bio and link labels.</p>
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
        <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">Sets the typeface across your Swift Links page.</p>
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

      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Social icons{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
        <p className="text-[0.625rem] text-gray-500 mb-2 leading-snug">The shape and color of your social chips.</p>
        <IconStyleControls
          look={getLook(value.linkLook)}
          shape={normalizeIconShape(value.linkIconShape)}
          fill={normalizeIconFill(value.linkIconFill)}
          onChange={onChange}
          locked={locked}
        />
      </div>

      {/* Per-link looks — only where the caller owns the links (the card
          editor and the wizard); the marketing mini-builder's sketch has no
          real links, so it gets no section rather than a dead one. */}
      {links && onLinksChange && (
        <div className="border-t border-gray-800 pt-4">
          <p className={`${rowLabel} mb-0.5`}>Link buttons{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
          <p className="text-[0.625rem] text-gray-500 mb-2 leading-snug">Choose how each additional link appears. Featured and Grid show a big preview you can swap for your own photo or video; Compact is a slim row you can style.</p>
          <LinkButtonsControls links={links} onChange={onLinksChange} locked={locked} pageRowStyle={value.linkButtonStyle} />
          {links.some((l) => l.kind !== "header" && (l.size ?? "grid") === "compact" && resolveRowStyle(l, value.linkButtonStyle) !== "tile") && (
            <div className="mt-2.5">
              <p className="text-[0.625rem] text-gray-500 mb-1.5 leading-snug">Button color for Solid and Outline rows — leave Default to use your Look&apos;s accent.</p>
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
      )}

    </div>
  );
}

