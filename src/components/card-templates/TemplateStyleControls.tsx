"use client";

// Pro control for restyling the SIX preset templates. Scoped to what actually
// keeps a card looking professional — BACKGROUND surface, NAME/text color, and
// FONT — because layout, accents and textures are each template's signature.
//
// ONE numbered path, top to bottom, in the order a card is actually built —
// the base first, then the details (owner, 2026-09-16: "users need to be told
// where to go"). On Classic Pro that reads:
//   1 Look · 2 Branding panel · 3 Photo or video · 4 Info panel ·
//   5 Name color · 6 Accent / icons · 7 Details color · 8 Font · 9 Finish
// Every template uses its own labels (template-style-presets META), and a
// template with no second surface simply has one step fewer. Nothing is behind
// a tab or a "More" fold any more: those hid half the panel from the people
// who most needed to be led through it.
// No PRO labels anywhere in the panel (owner, 2026-09-16): every control works
// and previews on every plan; the Save dialog names what needs Pro.
// The template's name and blurb are NOT repeated here: the editors' template
// gallery (TemplatePicker) already shows them beside a live thumbnail.
// The control vocabulary (headings, fields, tap targets, what "selected" looks
// like) is shared with every other design surface: components/ui/DesignControls.
//
// Purely presentational — the parent owns the TemplateStyle value and persists
// it on customization. Clearing a fine-tune field ("Default") returns that
// property to the template's baked-in design. Consumed by NewCardWizard and
// CardEditForm.

import { CARD_FONT_OPTIONS, isDarkBg } from "./shared";
import type { TemplateStyle } from "./shared";
import { META, FALLBACK_META, type Look, type StyleField } from "@/lib/template-style-presets";
import { useRef, useState } from "react";
import { Field } from "@/components/ui/DesignControls";
import {
  CARD_FINISHES, FINISH_FAMILIES, getFinish,
  composePanelBackground, PANEL_DIM_DEFAULT,
} from "@/lib/card-finishes";
import { isAllowedMedia, uploadMedia, uploadErrorMessage, WRONG_TYPE_MESSAGE, IMAGE_TYPES, VIDEO_TYPES } from "@/lib/upload-media";

function isHex(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

// Is this Look exactly what the card is wearing right now?
//
// Every field a Look SETS has to be compared, or the highlight lies. Once Looks
// gained a finish and a second surface, comparing only bg/text/font meant
// picking "Sea Glass" and then switching the finish to Carbon left Sea Glass
// still lit up — the panel claiming a preset that no longer described the card.
// Undefined on both sides counts as a match: a Look without a finish means Flat,
// which is what an unset finish renders as.
function looksActive(value: TemplateStyle, look: Look): boolean {
  const same = (a?: string, b?: string) => (a ?? undefined) === (b ?? undefined);
  return (
    value.bgColor === look.bg &&
    value.textColor === look.text &&
    same(value.fontFamily, look.font) &&
    same(value.finish, look.finish) &&
    same(value.surfaceColor, look.surface)
  );
}

/** Every key a Look sets — and so every key "Original" hands back to the template. */
function isOriginal(value: TemplateStyle): boolean {
  return (
    value.bgColor === undefined &&
    value.textColor === undefined &&
    value.fontFamily === undefined &&
    value.finish === undefined &&
    value.surfaceColor === undefined
  );
}

function LooksGallery({
  looks,
  value,
  onPick,
  original,
  onOriginal,
}: {
  looks: Look[];
  value: TemplateStyle;
  onPick: (look: Look) => void;
  /** The template's own baked-in scheme, painted on the "Original" tile. */
  original: { bg: string; text: string };
  onOriginal: () => void;
}) {
  const originalActive = isOriginal(value);
  return (
    <div className="grid grid-cols-3 gap-2">
      {/* ORIGINAL — the template exactly as it ships. Before this there was no
          way back to it short of five separate "Default" taps, and a card with
          nothing set lit no tile at all, so the untouched state read as "no
          choice made". It writes nothing new: only the unset values those
          Default chips already write. */}
      <button
        type="button"
        onClick={onOriginal}
        className="group text-left"
        aria-pressed={originalActive}
        title="The template's own colours, font and finish"
      >
        <div
          className="h-11 rounded-lg flex items-center px-2.5 transition-transform group-hover:scale-[1.03]"
          style={{
            background: composePanelBackground(original.bg, undefined),
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: originalActive ? "0 0 0 2px #0b0f16, 0 0 0 4px #3b82f6" : undefined,
          }}
        >
          <span data-ds="specimen" className="text-sm font-bold leading-none" style={{ color: isDarkBg(original.bg) ? original.text : "#111827" }}>Aa</span>
        </div>
        <span className="mt-1 flex items-center gap-1 min-w-0">
          <span className={`text-[0.6875rem] leading-tight truncate ${originalActive ? "text-blue-300 font-semibold" : "text-gray-400"}`}>Original</span>
        </span>
      </button>
      {looks.map((look) => {
        const active = looksActive(value, look);
        // A Look built on a Pro finish SHOWS its finish here and applies on tap,
        // so the card previews exactly as it would. No PRO label on the tile
        // (owner, 2026-09-16): what needs Pro is named once, at Save Changes,
        // by the Pro-required dialog (lib/plan.ts proFeaturesInUse).
        return (
          <button
            key={look.name}
            type="button"
            onClick={() => onPick(look)}
            className="group text-left"
            aria-pressed={active}
            title={look.finish ? `${look.name} — ${getFinish(look.finish).name.toLowerCase()} finish` : look.name}
          >
            <div
              className="h-11 rounded-lg flex items-center px-2.5 transition-transform group-hover:scale-[1.03]"
              style={{
                // The FINISH, not just the colour. A Look whose whole point is
                // the material rendered as a flat chip identical to the plain
                // colour beside it, so the two reads that matter — sea glass,
                // brushed metal — were invisible until after you picked one.
                background: composePanelBackground(look.bg, look.finish),
                border: "1px solid rgba(255,255,255,0.12)",
                // The same offset ring the colour swatches use. A Look tile IS
                // its preview, so filling it blue would destroy the thing being
                // chosen — but the ring has to be the identical ring, or
                // "selected" means two different marks on one screen.
                boxShadow: active ? "0 0 0 2px #0b0f16, 0 0 0 4px #3b82f6" : undefined,
              }}
            >
              {/* Aa uses a legible color for the picker even on light themes */}
              <span data-ds="specimen" className="text-sm font-bold leading-none" style={{ color: isDarkBg(look.bg) ? look.text : "#111827", fontFamily: look.font }}>Aa</span>
            </div>
            <span className="mt-1 flex items-center gap-1 min-w-0">
              <span className={`text-[0.6875rem] leading-tight truncate ${active ? "text-blue-300 font-semibold" : "text-gray-400"}`}>{look.name}</span>
            </span>
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
          aria-pressed={value === p}
          // sc-tap-sq: 28px is a fine mouse target and a poor thumb one. On
          // touch these become 44x44 and the row wraps to fewer per line —
          // which is the right trade, because picking the wrong colour is the
          // single easiest mis-tap in this panel.
          className="sc-tap-sq w-7 h-7 rounded-lg transition-transform hover:scale-110"
          // A selected swatch gets a RING with a gap, not a thicker border: on a
          // dark preset a 2px blue border is nearly invisible against the panel,
          // and on a blue preset it disappeared entirely.
          style={{
            background: p,
            border: "1px solid #374151",
            boxShadow: value === p ? "0 0 0 2px #0b0f16, 0 0 0 4px #3b82f6" : undefined,
          }}
        />
      ))}
      <label className="flex items-center gap-1 text-[0.6875rem] text-gray-500 ml-0.5 cursor-pointer">
        {/* "any color", not "custom": beside six working swatches, a greyed
            "custom PRO" read as the whole colour field being Pro. The swatches
            are every plan; the free-hand picker is what Pro adds.

            AND IT STAYS USABLE ON A FREE ACCOUNT (owner, 2026-09-11). It used
            to be disabled, which is the one thing in this panel that could not
            be tried: a Free owner could tap every Pro finish and see it on
            their card, but the colour picker was dead, so the feature they were
            being asked to pay for was the one they could not look at. Now they
            pick any colour, watch it land on the live preview, and meet the
            Pro wall at Save Changes — which names what they used and offers to
            save the Free-safe version instead (ProRequiredDialog). Nothing can
            leak past that: the save path detects it (proFeaturesInUse) and the
            server snaps colours to Free presets on write regardless
            (sanitizeCustomizationForPlan).

            No PRO label here any more (owner, 2026-09-16): the Card Design
            tab carries no Pro badges; the Save dialog is where Pro is named. */}
        any color
        <input
          type="color"
          value={isHex(value) ? value : fallbackHex}
          onChange={(e) => onPick(e.target.value)}
          className="sc-tap-sq w-7 h-7 rounded bg-transparent border border-gray-700 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => onPick(undefined)}
        aria-pressed={value === undefined}
        // Selected is FILLED here like everywhere else in the panel. This chip
        // used to be the odd one out — blue text on a blue outline, no fill —
        // so "Default" being the active choice read as merely available.
        className={`sc-tap text-[0.6875rem] font-semibold px-3 py-1 rounded-lg border transition-colors ${
          value === undefined
            ? "bg-blue-600 border-blue-600 text-white"
            : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
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
            aria-pressed={active}
            className={`sc-tap flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
              active ? "border-blue-500 bg-blue-600 text-white" : "border-gray-700 hover:border-gray-600 bg-gray-800/40"
            }`}
          >
            <span className={`text-[0.8125rem] font-semibold ${active ? "text-white" : "text-gray-300"}`}>{o.label}</span>
            <span data-ds="specimen" className={`text-base leading-none ${active ? "text-white" : "text-gray-200"}`} style={{ fontFamily: o.value }}>Ag</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * FINISH — the material laid over the panel colour.
 *
 * Every swatch paints the finish over the card's CURRENT colour rather than a
 * stock one, so the row shows what this card would look like, not what some
 * other card would.
 */
function FinishPicker({
  value,
  bgFallback,
  onChange,
}: {
  value: TemplateStyle;
  bgFallback: string;
  onChange: (patch: Partial<TemplateStyle>) => void;
}) {
  const base = value.bgColor ?? bgFallback;
  const current = getFinish(value.finish);

  // ONE grid, in CARD_FINISHES order (plain → light → material). The three
  // family headings with their blurbs used to cost three rows of taxonomy
  // above eight tiles that already show exactly what they are; the family now
  // rides in each tile's tooltip instead.
  const familyName = (id: string) => FINISH_FAMILIES.find((fam) => fam.id === id)?.name ?? "";
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 min-[360px]:grid-cols-4 gap-1.5">
              {CARD_FINISHES.map((f) => {
                const active = current.id === f.id;
                // Every finish is tappable on every plan so the card can be previewed
                // with it. The save path strips a Pro finish on Free (lib/plan.ts)
                // and the Save dialog names it — no PRO label on the tile.
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={`${familyName(f.family)} · ${f.blurb}`}
                    aria-pressed={active}
                    onClick={() => onChange({ finish: f.id === "flat" ? undefined : f.id })}
                    // A finish tile IS its own preview, so it takes the RING,
                    // like the colour swatches and the Looks — filling it blue
                    // would paint over the material being chosen. Controls
                    // whose face is a LABEL (font pills, segments, Default)
                    // take the fill. See components/ui/DesignControls.
                    className={`group sc-tap rounded-lg border p-1 text-left transition-colors ${
                      active ? "border-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900" : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <span
                      className="block h-9 rounded-md border border-black/25"
                      style={{ background: composePanelBackground(base, f.id) }}
                      aria-hidden
                    />
                    <span className="mt-1 flex items-center gap-1 min-w-0">
                      <span className={`text-[0.6875rem] leading-tight truncate ${active ? "text-blue-300 font-semibold" : "text-gray-400"}`}>{f.name}</span>
                    </span>
                  </button>
                );
              })}
      </div>

      {/* Frosted lightens the panel, so a white name can vanish into it. Said
          plainly instead of silently rewriting a colour the owner chose. */}
      {current.lightens && (
        <p className="text-[0.6875rem] text-amber-400/90 leading-snug">
          {current.name} lightens the panel — if your name is white, a darker name colour will read better.
        </p>
      )}
    </div>
  );
}

/**
 * PANEL MEDIA — a photo or short video behind the card's coloured surface.
 *
 * A video is stored WITH a poster frame grabbed from it in the browser, because
 * the card is not only a web element: it is rasterised for the download, drawn
 * into link-preview images, and pasted into email signatures, and none of those
 * can play a video. The poster is what they paint, so the card always has
 * something to show rather than a hole where the video would be.
 */
function PanelMediaControl({
  value,
  onChange,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = value.panelMedia;
  const isVideo = value.panelMediaType === "video";
  const dim = typeof value.panelDim === "number" ? value.panelDim : PANEL_DIM_DEFAULT;

  /** First frame of a video, as an uploadable file. Null if it cannot be read. */
  async function posterFrom(file: File): Promise<File | null> {
    try {
      const objectUrl = URL.createObjectURL(file);
      try {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.preload = "metadata";
        v.src = objectUrl;
        await new Promise<void>((res, rej) => {
          v.onloadeddata = () => res();
          v.onerror = () => rej(new Error("video unreadable"));
          setTimeout(() => rej(new Error("video timed out")), 8000);
        });
        // A hair past zero: frame 0 of an encoded video is often black.
        v.currentTime = Math.min(0.1, (v.duration || 1) / 10);
        await new Promise<void>((res) => { v.onseeked = () => res(); setTimeout(res, 2500); });
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(v.videoWidth || 1200, 1400);
        canvas.height = Math.round(canvas.width * ((v.videoHeight || 800) / (v.videoWidth || 1200)));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
        return blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      return null;
    }
  }

  async function pick(file: File) {
    if (!isAllowedMedia(file)) { setError(WRONG_TYPE_MESSAGE); return; }
    setBusy(true);
    setError(null);
    try {
      const media = await uploadMedia(file, "cardbg");
      if (media.type === "video") {
        const poster = await posterFrom(file);
        const posterUp = poster ? await uploadMedia(poster, "cardbg").catch(() => null) : null;
        if (!posterUp) {
          // Without a still, the card would be blank everywhere it cannot play.
          // Refusing is kinder than shipping a card that is broken in export.
          setError("Couldn't read a still from that video — try a different file, or use a photo.");
          return;
        }
        // One patch: a url written without its type (or poster) would render as
        // the wrong element for a beat, and could persist that way on a failure.
        onChange({ panelMedia: media.url, panelMediaType: "video", panelMediaPoster: posterUp.url, panelDim: dim });
      } else {
        onChange({ panelMedia: media.url, panelMediaType: "image", panelMediaPoster: undefined, panelDim: dim });
      }
    } catch (e) {
      setError(uploadErrorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove() {
    onChange({ panelMedia: undefined, panelMediaType: undefined, panelMediaPoster: undefined, panelDim: undefined });
    setError(null);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }}
      />

      {url ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="w-14 h-9 rounded-lg border border-gray-700 shrink-0 bg-gray-800"
              style={{ background: composePanelBackground(value.bgColor ?? "#111827", value.finish, { url: value.panelMedia, poster: value.panelMediaPoster, dim }) }}
              aria-hidden
            />
            <p className="text-[0.6875rem] text-gray-400 min-w-0 flex-1 leading-snug">
              {isVideo ? "Video — plays on your card page; the first frame shows everywhere else." : "Photo behind your panel."}
            </p>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-[0.6875rem] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 shrink-0">
              {busy ? "Uploading…" : "Replace"}
            </button>
            <button type="button" onClick={remove} disabled={busy} className="text-[0.6875rem] text-gray-500 hover:text-gray-300 disabled:opacity-50 shrink-0">Remove</button>
          </div>

          <div>
            <label htmlFor="panel-dim" className="flex items-center justify-between text-[0.6875rem] text-gray-500 mb-1">
              <span>Darken so your name reads</span>
              <span className="tabular-nums text-gray-400">{Math.round(dim * 100)}%</span>
            </label>
            <input
              id="panel-dim"
              type="range"
              min={0}
              max={85}
              step={5}
              value={Math.round(dim * 100)}
              onChange={(e) => onChange({ panelDim: Number(e.target.value) / 100 })}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="sc-tap w-full rounded-lg border border-dashed border-gray-700 hover:border-gray-500 py-3 text-[0.8125rem] font-semibold text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Add a photo or video"}
        </button>
      )}

      {error && <p role="alert" className="text-[0.6875rem] text-amber-400 mt-1.5 leading-snug">{error}</p>}
    </div>
  );
}

export default function TemplateStyleControls({
  value,
  onChange,
  template,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
  template?: string;
  /**
   * The account can't keep Pro choices (Free). Still accepted from every caller
   * but no longer drawn: the Card Design tab carries no PRO labels (owner,
   * 2026-09-16). Every control stays usable and previews; the Pro-required
   * dialog at Save names what needs Pro, and the server enforces it.
   */
  locked?: boolean;
}) {
  const meta = (template && META[template]) || FALLBACK_META;

  // A Look sets the card's whole scheme in one tap, INCLUDING clearing what it
  // does not specify. Leaving the previous finish or second surface underneath
  // is what makes a preset feel like it half-worked.
  const applyLook = (look: Look) =>
    onChange({
      bgColor: look.bg,
      textColor: look.text,
      fontFamily: look.font,
      finish: look.finish,
      surfaceColor: meta.surface ? look.surface : undefined,
    });
  // Exactly the keys a Look sets, handed back to the template.
  const applyOriginal = () =>
    onChange({ bgColor: undefined, textColor: undefined, fontFamily: undefined, finish: undefined, surfaceColor: undefined });

  /** The short line under a colour field. The long `help` stays as its tooltip. */
  const swatches = (
    f: StyleField,
    current: string | undefined,
    key: "bgColor" | "surfaceColor" | "textColor" | "accentColor" | "infoColor",
  ) => <Swatches presets={f.presets} value={current} fallbackHex={f.fallback} onPick={(v) => onChange({ [key]: v })} />;

  // The path, in build order. Base first — the whole look, the main surface and
  // what goes behind it, the second surface — then the type and colour details,
  // then the material over all of it.
  const steps: { key: string; label: string; help?: string; title?: string; body: React.ReactNode }[] = [
    {
      key: "look",
      label: "Look",
      help: "The whole card in one tap. Change any part of it below.",
      body: (
        <LooksGallery
          looks={meta.looks}
          value={value}
          onPick={applyLook}
          original={{ bg: meta.bg.fallback, text: meta.text.fallback }}
          onOriginal={applyOriginal}
        />
      ),
    },
    { key: "bg", label: meta.bg.label, help: meta.bg.hint, title: meta.bg.help, body: swatches(meta.bg, value.bgColor, "bgColor") },
    {
      key: "media",
      label: "Photo or video",
      help: `Optional — goes behind your ${meta.bg.label.toLowerCase()}.`,
      body: <PanelMediaControl value={value} onChange={onChange} />,
    },
    // Only some templates have a second surface; on the rest the background
    // already paints the whole card and this step would do nothing.
    ...(meta.surface
      ? [{ key: "surface", label: meta.surface.label, help: meta.surface.hint, title: meta.surface.help, body: swatches(meta.surface, value.surfaceColor, "surfaceColor") }]
      : []),
    { key: "text", label: meta.text.label, help: meta.text.hint, title: meta.text.help, body: swatches(meta.text, value.textColor, "textColor") },
    { key: "accent", label: meta.accent.label, help: meta.accent.hint, title: meta.accent.help, body: swatches(meta.accent, value.accentColor, "accentColor") },
    { key: "info", label: meta.info.label, help: meta.info.hint, title: meta.info.help, body: swatches(meta.info, value.infoColor, "infoColor") },
    {
      key: "font",
      label: "Font",
      help: "Your name and details, across the whole card.",
      body: <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />,
    },
    {
      key: "finish",
      label: "Finish",
      help: `The material over your ${meta.bg.label.toLowerCase()}. Strongest on deeper colours.`,
      body: <FinishPicker value={value} bgFallback={meta.bg.fallback} onChange={onChange} />,
    },
  ];

  return (
    <ol className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800" aria-label="Design your card, step by step">
      {steps.map((st, i) => (
        <li key={st.key} className="flex gap-3 p-4" title={st.title}>
          {/* The number is the "where do I go next" — one column, read down. */}
          <span
            aria-hidden
            className="mt-px w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-[0.6875rem] font-bold flex items-center justify-center tabular-nums"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <Field label={st.label} help={st.help}>
              {st.body}
            </Field>
          </div>
        </li>
      ))}
    </ol>
  );
}
