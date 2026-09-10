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
  CARD_FINISHES, FINISH_FAMILIES, getFinish,
  composePanelBackground, PANEL_DIM_DEFAULT,
} from "@/lib/card-finishes";
import { isAllowedMedia, uploadMedia, uploadErrorMessage, WRONG_TYPE_MESSAGE, IMAGE_TYPES, VIDEO_TYPES } from "@/lib/upload-media";

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

      {/* 2) Finish — a MODIFIER of the surface above, so it sits with it rather
          than at the bottom with the text colours. Owner, 2026-09-10: the same
          "biggest visual change nearest the preview" rule the Swift Links panel
          was reordered around. */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>Finish</p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">The material laid over your {meta.bg.label.toLowerCase()}. Reads strongest on deeper colours.</p>
        <FinishPicker value={value} bgFallback={meta.bg.fallback} onChange={onChange} locked={locked} />
      </div>

      {/* 3) Panel photo or video */}
      <div>
        <p className={`${rowLabel} mb-0.5`}>Panel photo or video{locked && <span className="ml-1.5 align-middle"><ProTag /></span>}</p>
        <p className="text-[10px] text-gray-500 mb-2 leading-snug">Sits behind your {meta.bg.label.toLowerCase()}, under the finish.</p>
        <PanelMediaControl value={value} onChange={onChange} locked={locked} />
      </div>

      {/* 4) Name color */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.text.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.text.help}</p>
        <Swatches presets={meta.text.presets} value={value.textColor} fallbackHex={meta.text.fallback} onPick={(v) => onChange({ textColor: v })} customLocked={locked} />
      </div>

      {/* 5) Details color — the actual contact information text */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.info.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.info.help}</p>
        <Swatches presets={meta.info.presets} value={value.infoColor} fallbackHex={meta.info.fallback} onPick={(v) => onChange({ infoColor: v })} customLocked={locked} />
      </div>

      {/* 6) Accent / icon color — the phone/email/address icons (the purple) */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>{meta.accent.label}</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">{meta.accent.help}</p>
        <Swatches presets={meta.accent.presets} value={value.accentColor} fallbackHex={meta.accent.fallback} onPick={(v) => onChange({ accentColor: v })} customLocked={locked} />
      </div>

      {/* 7) Font */}
      <div className="border-t border-gray-800 pt-4">
        <p className={`${rowLabel} mb-0.5`}>Font</p>
        <p className="text-[10px] text-gray-500 mb-1.5 leading-snug">Sets the typeface for your name and details across the whole card.</p>
        <FontPills value={value.fontFamily} onChange={(v) => onChange({ fontFamily: v })} />
      </div>
    </div>
  );
}
