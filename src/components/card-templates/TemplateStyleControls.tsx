"use client";

// Pro control for restyling the SIX preset templates. Scoped to what actually
// keeps a card looking professional — BACKGROUND surface, NAME/text color, and
// FONT — because layout, accents and textures are each template's signature.
//
// Ordered by how often a control is actually touched, not by subject:
//   1. "Looks"  — one-tap curated themes. Where most people should live.
//   2. "Colour" — background, second surface, name colour.
//   3. "Style"  — font, then finish.
//   4. "More style options" — details colour, accent colour, photo/video,
//      behind a native <details>. Real features, just not why anyone opens
//      this tab.
// The control vocabulary (headings, fields, tap targets, what "selected" looks
// like) is shared with every other design surface: components/ui/DesignControls.
//
// Purely presentational — the parent owns the TemplateStyle value and persists
// it on customization. Clearing a fine-tune field ("Default") returns that
// property to the template's baked-in design. Consumed by NewCardWizard and
// CardEditForm.

import { CARD_FONT_OPTIONS, isDarkBg } from "./shared";
import type { TemplateStyle } from "./shared";
import { META, FALLBACK_META, type Look } from "@/lib/template-style-presets";
import { useRef, useState } from "react";
import { Field, MoreOptions, SectionHeading } from "@/components/ui/DesignControls";
import {
  CARD_FINISHES, FINISH_FAMILIES, getFinish, isFreeFinish,
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

function LooksGallery({
  looks,
  value,
  onPick,
  locked = false,
}: {
  looks: Look[];
  value: TemplateStyle;
  onPick: (look: Look) => void;
  locked?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {looks.map((look) => {
        const active = looksActive(value, look);
        // A Look built on a Pro finish still SHOWS its finish here and still
        // applies on tap — the card previews exactly as it would. The save path
        // drops the finish for a Free account (lib/plan.ts), so the tag says so
        // in advance rather than letting the card quietly come back flatter
        // than the swatch promised.
        const needsPro = locked && !!look.finish && !isFreeFinish(look.finish);
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
              {needsPro && <span data-ds="badge" className="text-[8px] font-bold text-blue-400 shrink-0">PRO</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Small "PRO" tag for the arbitrary custom-color inputs — the one part of this
// panel that stays Pro-only once presets/Looks/fonts are Free-usable.
function ProTag() {
  return <span data-ds="badge" className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-blue-600 text-white leading-none">PRO</span>;
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
            (sanitizeCustomizationForPlan). The PRO tag stays, so nobody gets
            attached to a colour without being told what it costs. */}
        any color{customLocked && <ProTag />}
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
 * other card would. Grouped by family for the same reason the Swift Links Looks
 * are: eight flat chips read as a list to get through, three labelled groups
 * read as a choice between kinds of thing.
 */
function FinishPicker({
  value,
  bgFallback,
  onChange,
  locked,
}: {
  value: TemplateStyle;
  bgFallback: string;
  onChange: (patch: Partial<TemplateStyle>) => void;
  locked: boolean;
}) {
  const base = value.bgColor ?? bgFallback;
  const current = getFinish(value.finish);

  return (
    <div className="space-y-2.5">
      {FINISH_FAMILIES.map((fam) => {
        const finishes = CARD_FINISHES.filter((f) => f.family === fam.id);
        if (!finishes.length) return null;
        return (
          <div key={fam.id}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gray-500 shrink-0">{fam.name}</span>
              <span className="text-[0.6875rem] text-gray-600 truncate min-w-0">{fam.blurb}</span>
              <span className="flex-1 h-px bg-gray-800" />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {finishes.map((f) => {
                const active = current.id === f.id;
                // A Pro finish stays TAPPABLE on a locked account so the card
                // can be previewed with it — the same contract the colour
                // presets use. The save path strips it (lib/plan.ts), and the
                // PRO tag says so before they get attached to it.
                const proLocked = locked && !f.free;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.blurb}
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
                      {proLocked && <span data-ds="badge" className="text-[0.5rem] font-bold text-blue-400 shrink-0">PRO</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}


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
  locked = false,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
  template?: string;
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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Which template this is, and a live chip of the scheme so far. */}
      <div className="flex items-start gap-3">
        <div
          className="w-14 h-9 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-gray-700"
          style={{ background: composePanelBackground(value.bgColor ?? meta.bg.fallback, value.finish) }}
          aria-hidden
        >
          <span data-ds="specimen" className="text-[0.8125rem] font-bold leading-none" style={{ color: value.textColor ?? meta.text.fallback, fontFamily: value.fontFamily }}>Aa</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-[0.8125rem] font-semibold leading-tight">{meta.name}</p>
          <p className="text-gray-500 text-[0.6875rem] leading-snug mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      {/* ── ORDERED BY HOW OFTEN IT IS TOUCHED ───────────────────────────────
          Looks first (one tap, does everything), then the two decisions almost
          every card makes — its colour and its typeface — then Finish, then the
          three that most cards never touch, folded away.

          The old order grouped by SUBJECT ("Surfaces", then "Text"), which put
          Photo-or-video — a Pro feature with an uploader, a slider and an error
          line, easily the tallest control in the panel — third, above the name
          colour. Scrolling past an uploader you are not using to reach the
          colour you came for is the clutter this reorganisation is about. */}

      <SectionHeading hint="The whole card, in one tap">Looks</SectionHeading>
      <LooksGallery looks={meta.looks} value={value} onPick={applyLook} locked={locked} />

      <SectionHeading hint="Background and text">Colour</SectionHeading>
      <Field label={meta.bg.label} help={meta.bg.help}>
        <Swatches presets={meta.bg.presets} value={value.bgColor} fallbackHex={meta.bg.fallback} onPick={(v) => onChange({ bgColor: v })} customLocked={locked} />
      </Field>

      {/* Only three of the six templates have a second surface. On the rest,
          bgColor already paints the whole card and this would do nothing. */}
      {meta.surface && (
        <Field label={meta.surface.label} help={meta.surface.help}>
          <Swatches presets={meta.surface.presets} value={value.surfaceColor} fallbackHex={meta.surface.fallback} onPick={(v) => onChange({ surfaceColor: v })} customLocked={locked} />
        </Field>
      )}

      <Field label={meta.text.label} help={meta.text.help}>
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} customLocked={locked} />
      </Field>

      <SectionHeading hint="Typeface and material">Style</SectionHeading>
      <Field label="Font" help="Sets the typeface for your name and details across the whole card.">
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </Field>

      <Field label="Finish" help={`The material laid over your ${meta.bg.label.toLowerCase()}. Reads strongest on deeper colours.`}>
        <FinishPicker value={value} bgFallback={meta.bg.fallback} onChange={onChange} locked={locked} />
      </Field>

      {/* ── The long tail, one tap away ──────────────────────────────────────
          Not hidden — a native <details>, so it is keyboard- and
          screen-reader-reachable, works before hydration, and stays open once
          opened. These three are real features; they are simply not what
          someone opens the Design tab to do. */}
      <MoreOptions label="More style options">
        <Field label={meta.info.label} help={meta.info.help}>
          <Swatches presets={meta.info.presets} value={value.infoColor} fallbackHex={meta.info.fallback} onPick={(v) => onChange({ infoColor: v })} customLocked={locked} />
        </Field>

        <Field label={meta.accent.label} help={meta.accent.help}>
          <Swatches presets={meta.accent.presets} value={value.accentColor} fallbackHex={meta.accent.fallback} onPick={(v) => onChange({ accentColor: v })} customLocked={locked} />
        </Field>

        <Field
          label="Photo or video"
          help={`Sits behind your ${meta.bg.label.toLowerCase()}, under the finish.`}
          trailing={locked ? <ProTag /> : undefined}
        >
          <PanelMediaControl value={value} onChange={onChange} />
        </Field>
      </MoreOptions>
    </div>
  );
}
