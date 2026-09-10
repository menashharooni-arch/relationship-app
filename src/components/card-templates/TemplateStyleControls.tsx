"use client";

// Pro control for restyling the SIX preset templates. Scoped to what actually
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
import { useRef, useState } from "react";
import {
  CARD_FINISHES, FINISH_FAMILIES, getFinish, isFreeFinish,
  composePanelBackground, PANEL_DIM_DEFAULT,
} from "@/lib/card-finishes";
import { isAllowedMedia, uploadMedia, uploadErrorMessage, WRONG_TYPE_MESSAGE, IMAGE_TYPES, VIDEO_TYPES } from "@/lib/upload-media";

function isHex(v?: string): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

const rowLabel = "text-[11px] font-semibold text-gray-300 uppercase tracking-wide";

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
                border: active ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.12)",
                boxShadow: active ? "0 0 0 2px rgba(59,130,246,0.25)" : undefined,
              }}
            >
              {/* Aa uses a legible color for the picker even on light themes */}
              <span className="text-sm font-bold leading-none" style={{ color: isDarkBg(look.bg) ? look.text : "#111827", fontFamily: look.font }}>Aa</span>
            </div>
            <span className="mt-1 flex items-center gap-1 min-w-0">
              <span className={`text-[10px] leading-tight truncate ${active ? "text-blue-300 font-semibold" : "text-gray-500"}`}>{look.name}</span>
              {needsPro && <span className="text-[8px] font-bold text-blue-400 shrink-0">PRO</span>}
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
        {/* "any color", not "custom": beside six working swatches, a greyed
            "custom PRO" read as the whole colour field being Pro. The swatches
            are every plan; the free-hand picker is what Pro adds. */}
        any color{customLocked && <ProTag />}
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
              <span className="text-[0.5625rem] font-bold uppercase tracking-[0.16em] text-gray-500 shrink-0">{fam.name}</span>
              <span className="text-[0.5625rem] text-gray-600 truncate">{fam.blurb}</span>
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
                    className={`group rounded-lg border p-1 text-left transition-colors ${
                      active ? "border-blue-500 bg-blue-600/10" : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <span
                      className="block h-9 rounded-md border border-black/25"
                      style={{ background: composePanelBackground(base, f.id) }}
                      aria-hidden
                    />
                    <span className="mt-1 flex items-center gap-1 min-w-0">
                      <span className={`text-[0.625rem] leading-tight truncate ${active ? "text-blue-300 font-semibold" : "text-gray-400"}`}>{f.name}</span>
                      {proLocked && <span className="text-[0.5rem] font-bold text-blue-400 shrink-0">PRO</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* A Pro finish on a Free account previews here and is kept with the
          card, but the live card renders Flat until they are on Pro. Without
          this line the editor showed Brushed and the public card showed a
          plain panel, and nothing anywhere said why. Plain text on purpose:
          the upgrade link lives under the panel, and this component also
          renders inside the iOS shell, which may not sell. */}
      {locked && !current.free && (
        <p className="text-[10px] text-blue-300/90 leading-snug">
          {current.name} shows on your live card once you&apos;re on Pro. Until then your card renders as Flat.
        </p>
      )}

      {/* Frosted lightens the panel, so a white name can vanish into it. Said
          plainly instead of silently rewriting a colour the owner chose. */}
      {current.lightens && (
        <p className="text-[10px] text-amber-400/90 leading-snug">
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
  locked,
}: {
  value: TemplateStyle;
  onChange: (patch: Partial<TemplateStyle>) => void;
  locked: boolean;
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
            <p className="text-[11px] text-gray-400 min-w-0 flex-1 leading-snug">
              {isVideo ? "Video — plays on your card page; the first frame shows everywhere else." : "Photo behind your panel."}
            </p>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 shrink-0">
              {busy ? "Uploading…" : "Replace"}
            </button>
            <button type="button" onClick={remove} disabled={busy} className="text-[11px] text-gray-500 hover:text-gray-300 disabled:opacity-50 shrink-0">Remove</button>
          </div>

          <div>
            <label htmlFor="panel-dim" className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
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
          className="w-full rounded-lg border border-dashed border-gray-700 hover:border-gray-500 py-3 text-[11px] font-semibold text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Add a photo or video"}
        </button>
      )}

      {error && <p role="alert" className="text-[10px] text-amber-400 mt-1.5 leading-snug">{error}</p>}
      {locked && <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">Panel photos and videos come with Pro.</p>}
    </div>
  );
}

/**
 * A group signpost, one level above the field labels.
 *
 * The panel was a flat run of seven sections divided by hairlines, so "pick a
 * whole look", "what the card is made of" and "what colour the text is" all
 * read as the same weight of decision, and the eye had nowhere to rest. Owner,
 * 2026-09-10: "much cleaner and make everything more aligned."
 *
 * Deliberately quieter than a field label, and identical to the Swift Links
 * panel's heading, so the two design surfaces read as one system rather than
 * two screens that happen to live in the same product.
 */
function GroupHeading({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 pt-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500 shrink-0">{children}</span>
      {hint && <span className="text-[9px] text-gray-600 truncate">{hint}</span>}
      <span className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

/**
 * One labelled control.
 *
 * Every section used to repeat its own label/help/spacing markup, which is how
 * they drifted: different bottom margins, one section with a hairline above it
 * and the next without, and the background field carrying a hand-rolled copy of
 * the custom-colour + Default row that <Swatches> already draws. One component
 * means one alignment.
 */
function Field({ label, help, pro, children }: { label: string; help: string; pro?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={`${rowLabel} mb-0.5`}>
        {label}
        {pro && <span className="ml-1.5 align-middle"><ProTag /></span>}
      </p>
      <p className="text-[10px] text-gray-500 mb-2 leading-snug">{help}</p>
      {children}
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
          <span className="text-[13px] font-bold leading-none" style={{ color: value.textColor ?? meta.text.fallback, fontFamily: value.fontFamily }}>Aa</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{meta.name}</p>
          <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{meta.blurb}</p>
        </div>
      </div>

      {/* ── Looks: the whole card in one tap ─────────────────────────────── */}
      <GroupHeading hint="The whole card, in one tap">Looks</GroupHeading>
      <LooksGallery looks={meta.looks} value={value} onPick={applyLook} locked={locked} />

      {/* ── Surfaces: what the card is made of ───────────────────────────── */}
      <GroupHeading hint="What the card is made of">Surfaces</GroupHeading>
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

      <Field label="Finish" help={`The material laid over your ${meta.bg.label.toLowerCase()}. Reads strongest on deeper colours.`}>
        <FinishPicker value={value} bgFallback={meta.bg.fallback} onChange={onChange} locked={locked} />
      </Field>

      <Field label="Photo or video" help={`Sits behind your ${meta.bg.label.toLowerCase()}, under the finish.`} pro={locked}>
        <PanelMediaControl value={value} onChange={onChange} locked={locked} />
      </Field>

      {/* ── Text: what it says, and how it reads ─────────────────────────── */}
      <GroupHeading hint="Colour and typeface">Text</GroupHeading>
      <Field label={meta.text.label} help={meta.text.help}>
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} customLocked={locked} />
      </Field>

      <Field label={meta.info.label} help={meta.info.help}>
        <Swatches presets={meta.info.presets} value={value.infoColor} fallbackHex={meta.info.fallback} onPick={(v) => onChange({ infoColor: v })} customLocked={locked} />
      </Field>

      <Field label={meta.accent.label} help={meta.accent.help}>
        <Swatches presets={meta.accent.presets} value={value.accentColor} fallbackHex={meta.accent.fallback} onPick={(v) => onChange({ accentColor: v })} customLocked={locked} />
      </Field>

      <Field label="Font" help="Sets the typeface for your name and details across the whole card.">
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </Field>
    </div>
  );
}
