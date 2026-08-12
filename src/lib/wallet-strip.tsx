import { ImageResponse } from "next/og";
import type { ResolvedCardMeta } from "@/lib/resolve-card";
import {
  passPalette, toAppleRgb, withAlpha, mix, type PassPalette, type SampledSurface,
} from "@/lib/wallet-palette";
import { fitLine } from "@/lib/wallet-fit";

// ── The Wallet pass band ────────────────────────────────────────────────────
//
// Apple gives a storeCard exactly one canvas — a 375×123pt strip — plus a flat
// colour for everything under it. This module composes that band.
//
// It does NOT put a picture of the card in it. That was the previous design and
// it is what made the pass look empty: a 1.75:1 card scaled to fit a 3.05:1
// band is 57% of the width, so the rest of the band was grey ground, and the
// pass body below it was blank. The band now runs edge to edge and is composed
// from the card's PARTS — its colours, its mark or headshot, its name, title
// and company — sized for this shape rather than shrunk into it.
//
// Two rules make it work for every card the product can produce:
//
//   1. ONE layout, one geometry. Every band leads with the same 241px square —
//      headshot, logo panel or monogram — so the text column starts at the same
//      x and is measured against the same box on every card in the wallet. Six
//      bespoke per-template layouts each had their own overflow edges, and a
//      custom card fitted none of them. What survives at this size is colour
//      and typographic voice, which arrive from wallet-palette as data.
//   2. Nothing is positioned absolutely, and every string goes through
//      fitLine(), which VERIFIES its layout rather than estimating it — the
//      size it returns is one the text has actually been wrapped at. A long
//      company name cannot reach the edge, and a long name cannot take a third
//      line, no matter what else is on the band.
//
// Geometry: rendered once at @3x (1125×369) with Satori, downscaled with sharp
// for @2x/@1x — the same next/og + Node-runtime combination the per-card OG
// image already uses in production.

type Meta = NonNullable<ResolvedCardMeta>;

export type PassStrips = { x1: Buffer; x2: Buffer; x3: Buffer };

/** The pass chrome colours, in the rgb() form pass.json wants. */
export type PassTheme = {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  /** Dark chrome carries the white SwiftCard wordmark; light chrome can't. */
  darkChrome: boolean;
};

export type WalletDesign = {
  theme: PassTheme;
  strips: PassStrips;
  palette: PassPalette;
};

// ── Canvas ──────────────────────────────────────────────────────────────────

const W = 1125;
const H = 369;
const PAD_X = 60;
/** Photo diameter and logo box height. Leaves 64px of air above and below. */
const IMG = 241;
const GAP = 46;

const IDENTITY_W = (leadWidth: number) => W - PAD_X * 2 - (leadWidth ? leadWidth + GAP : 0);

// Type scale, in @3x px.
/**
 * ONE name size for every card, shrinking only when a name genuinely needs it.
 *
 * An earlier version let short names grow into unused width. It filled the
 * band, but it also meant no two passes in a wallet were set the same size —
 * "Alex Morgan" at 100px next to "Lev Lev Educational Fund" at 40px reads as
 * broken rather than responsive. Even beats full.
 */
const NAME_BASE = 84, NAME_MIN = 34;
const TITLE_BASE = 33, TITLE_MIN = 21;
const COMPANY_BASE = 31, COMPANY_MIN = 20;

function initialsOf(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "SC";
  return s.split(/\s+/).map((n) => Array.from(n)[0] ?? "").join("").toUpperCase().slice(0, 2) || "SC";
}

// ── Remote images ───────────────────────────────────────────────────────────

/**
 * Only fetch card images from hosts our own upload flows write to. The URL
 * comes from a DB column the card owner controls and this fetch runs
 * server-side — without the allowlist it is an SSRF primitive (point logo_url
 * at an internal host and make the server call it). Anything else falls back
 * to initials.
 */
function allowedImageHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    const ok = new Set<string>();
    for (const env of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"]) {
      if (env) try { ok.add(new URL(env).hostname.toLowerCase()); } catch { /* ignore */ }
    }
    return ok.has(host);
  } catch {
    return false;
  }
}

async function fetchImage(url: string | null): Promise<{ buf: Buffer; type: string } | null> {
  if (!url || !/^https?:\/\//.test(url) || !allowedImageHost(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    // redirect:"error" — storage URLs never redirect, and following one would
    // let an allowlisted URL bounce the request to an arbitrary host.
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "error" }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 100 || buf.byteLength > 6_000_000) return null;
    return { buf, type };
  } catch {
    return null;
  }
}

const dataUri = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;

async function loadBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1];
    return b64 ? Buffer.from(b64, "base64") : null;
  }
  const got = await fetchImage(url);
  return got?.buf ?? null;
}

/**
 * The headshot, cropped to an exact square by sharp before Satori sees it.
 *
 * Not `objectFit: cover` on the img. That leans on the renderer to crop, and
 * when a renderer doesn't implement it the image is SCALED instead — a 3:4
 * portrait squashed into a circle, which is precisely the "headshots are
 * uneven" complaint. Cropping here means the element is fed a square and there
 * is nothing left to get wrong.
 */
async function preparePhoto(url: string | null, size: number): Promise<string | null> {
  const buf = await loadBuffer(url);
  if (!buf) return null;
  try {
    const sharp = (await import("sharp")).default;
    return dataUri(await sharp(buf).resize(size, size, { fit: "cover" }).png().toBuffer());
  } catch {
    return null;
  }
}

/**
 * The logo, measured and sized to its OWN aspect ratio inside the box.
 *
 * Brand marks are wordmarks, banners and squares in equal measure, and the
 * element is given explicit width and height derived from the real file rather
 * than a square it has to fit itself into. A 4:1 wordmark now renders as a 4:1
 * wordmark — no distortion, no crop, whatever was uploaded.
 */
async function prepareLogo(
  url: string | null, boxW: number, boxH: number,
): Promise<{ src: string; w: number; h: number } | null> {
  const buf = await loadBuffer(url);
  if (!buf) return null;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    const ratio = meta.width / meta.height;
    let w = boxW;
    let h = Math.round(boxW / ratio);
    if (h > boxH) { h = boxH; w = Math.round(boxH * ratio); }
    w = Math.max(1, w); h = Math.max(1, h);
    const out = await sharp(buf)
      .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return { src: dataUri(out), w, h };
  } catch {
    return null;
  }
}

/**
 * The surface colour of a design-transfer card, read off the card itself.
 *
 * A face-image card has no colour fields to copy — the design only exists as
 * pixels — so the pass samples the dominant colour and builds a gentle ramp
 * around it. The image is never shown on the band: it is a 1.75:1 card face,
 * and cover-cropping one into a 3.05:1 band cuts the owner's own information
 * off the top and bottom.
 */
export async function sampleSurface(buf: Buffer): Promise<SampledSurface | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { dominant } = await sharp(buf).stats();
    if (!dominant) return null;
    const hex = `#${[dominant.r, dominant.g, dominant.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
    return { top: mix(hex, "#ffffff", 0.05), bottom: mix(hex, "#000000", 0.12) };
  } catch {
    return null;
  }
}

// ── The band ────────────────────────────────────────────────────────────────

type BandVariant = "portrait" | "mark";

/**
 * What the band can actually lead with, given this card's assets.
 *
 * The template states a preference; the content decides whether it can be
 * honoured. A logo-led template with no logo falls to a portrait (initials, if
 * there is no headshot either) rather than rendering an empty box — the one
 * outcome worse than a different layout is a hole where the mark should be.
 */
/**
 * Every band leads with a 241px square — a headshot circle, a logo panel, or a
 * monogram — so the text column starts at the same x on every pass and the
 * name is measured against the same box everywhere.
 *
 * An earlier type-led variant used a thin accent bar instead. On its own it
 * looked elegant; in a wallet next to other SwiftCard passes it started its
 * text 227px further left and made the whole stack look misaligned. Consistency
 * across passes is worth more than the flourish on any one of them.
 *
 * A type-led template (Luxury Minimal) also shows a LOGO when the card has one
 * — its card template does, so dropping the mark showed less than the card it
 * copies. It shows no headshot either way, which likewise matches.
 */
export function bandVariant(prefer: PassPalette["prefer"], hasPhoto: boolean, hasLogo: boolean): BandVariant {
  if (prefer === "type") return "mark";
  if (prefer === "mark") return hasLogo || !hasPhoto ? "mark" : "portrait";
  return hasPhoto || !hasLogo ? "portrait" : "mark";
}

type Logo = { src: string; w: number; h: number };

function Band({ meta, palette, photo, logo }: {
  meta: Meta; palette: PassPalette; photo: string | null; logo: Logo | null;
}) {
  const { ink, inkMuted, accent, voice } = palette;
  const variant = bandVariant(palette.prefer, !!photo, !!logo);

  // One box on every pass: the lead square is always the same width, so a name
  // is measured against the same space no matter which card it belongs to.
  const box = IDENTITY_W(IMG);

  // The name gets two lines; nothing else does. It is the one string on the
  // band that must never be cut, and fitLine now VERIFIES the wrap rather than
  // budgeting for it, so two lines means two lines.
  const name = fitLine(meta.name || "SwiftCard", {
    box, base: NAME_BASE, min: NAME_MIN, uppercase: voice.caps, tracking: voice.tracking,
    maxLines: 2,
  });
  const title = fitLine(meta.title, { box, base: TITLE_BASE, min: TITLE_MIN });
  const company = fitLine(meta.company, { box, base: COMPANY_BASE, min: COMPANY_MIN });

  // A vertical ramp, never an angled one. The pass's backgroundColor is set to
  // `bottom`, and only a 180deg gradient puts that exact colour across the
  // whole bottom edge — at any angle the corners land on a different mix and a
  // visible seam appears where the strip meets Apple's chrome.
  const background = palette.top === palette.bottom
    ? palette.top
    : `linear-gradient(180deg, ${palette.top} 0%, ${palette.bottom} 100%)`;

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center",
      background, padding: `0 ${PAD_X}px`, overflow: "hidden",
    }}>
      {variant === "portrait" ? (
        <Portrait url={photo} name={meta.name} ink={ink} accent={accent} />
      ) : (
        <Mark logo={logo} label={meta.company || meta.name} ink={ink} />
      )}

      <div style={{ width: GAP, display: "flex", flex: "none" }} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{
          fontSize: name.fontSize, letterSpacing: name.letterSpacing, fontWeight: voice.weight,
          color: ink, lineHeight: 1.08,
          ...(voice.caps ? { textTransform: "uppercase" as const } : {}),
        }}>{name.text}</div>

        {/* The rule is decoration and it is the first thing to go when the name
            takes a second line — keeping it there is what pushed a three-part
            block past the band's usable height. */}
        {voice.rule && name.lines < 2 ? (
          <div style={{ width: 104, height: 7, borderRadius: 7, background: accent, marginTop: 16, display: "flex" }} />
        ) : null}

        {title.text ? (
          <div style={{
            fontSize: title.fontSize, color: accent, fontWeight: 600,
            marginTop: 14, lineHeight: 1.2,
          }}>{title.text}</div>
        ) : null}

        {company.text ? (
          <div style={{
            fontSize: company.fontSize, color: inkMuted, fontWeight: 600,
            marginTop: 6, lineHeight: 1.2,
          }}>{company.text}</div>
        ) : null}
      </div>
    </div>
  );
}

function Portrait({ url, name, ink, accent }: { url: string | null; name: string | null; ink: string; accent: string }) {
  const ring = `6px solid ${withAlpha(accent, 0.75)}`;
  if (url) {
    // Already cropped square by sharp, so this is a straight scale — no
    // objectFit to honour and no way to end up with an oval face.
    // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
    return <img src={url} alt="" width={IMG} height={IMG} style={{ borderRadius: IMG, border: ring, flex: "none" }} />;
  }
  return (
    <div style={{
      width: IMG, height: IMG, borderRadius: IMG, border: ring, flex: "none",
      background: withAlpha(ink, 0.12), display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 86, fontWeight: 700, color: ink, letterSpacing: "0.01em",
    }}>{initialsOf(name)}</div>
  );
}

function Mark({ logo, label, ink }: { logo: Logo | null; label: string | null; ink: string }) {
  // A panel, not a bare logo: brand marks arrive on every ground imaginable
  // (white PNGs, dark PNGs, transparent) and a translucent tile keeps all of
  // them legible without knowing which kind this one is.
  //
  // The panel is a fixed square on every card so the text column starts at the
  // same x in every pass — a panel that resized to each logo made the whole
  // wallet look ragged. The LOGO inside it keeps its own proportions.
  return (
    <div style={{
      width: IMG, height: IMG, borderRadius: 28, flex: "none",
      background: withAlpha(ink, 0.1), display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      {logo ? (
        // Explicit width and height, measured from the file by sharp — nothing
        // is left for the renderer to fit, so no mark is ever squashed.
        // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
        <img src={logo.src} alt="" width={logo.w} height={logo.h} />
      ) : (
        // Ink, not the accent. The panel is a tint of the ink, so ink on it is
        // guaranteed to separate; an accent can legitimately be a close
        // neighbour of the ground (Luxury Minimal's gold on warm brown) and the
        // monogram then reads as a smudge.
        <div style={{ fontSize: 88, fontWeight: 700, color: ink, letterSpacing: "0.04em", display: "flex" }}>
          {initialsOf(label)}
        </div>
      )}
    </div>
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

export function passThemeFrom(palette: PassPalette): PassTheme {
  return {
    backgroundColor: toAppleRgb(palette.bottom),
    foregroundColor: toAppleRgb(palette.ink),
    labelColor: toAppleRgb(palette.accent),
    darkChrome: palette.darkChrome,
  };
}

/** Render the band at @3x, then downscale for @2x/@1x with sharp. */
export async function renderPassStrips(meta: Meta, palette: PassPalette): Promise<PassStrips> {
  const p: Meta = { ...meta };
  if (!(typeof p.name === "string" && p.name.trim())) p.name = "SwiftCard";
  // The mark is contained inside the panel's padded area; the headshot fills
  // its circle. Both are sized here, by sharp, from the real files.
  const [photo, logo] = await Promise.all([
    preparePhoto(p.photoUrl, IMG),
    prepareLogo(p.logoUrl, IMG - 48, IMG - 48),
  ]);

  const x3 = Buffer.from(
    await new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: "sans-serif" }}>
        <Band meta={p} palette={palette} photo={photo} logo={logo} />
      </div>,
      { width: W, height: H }
    ).arrayBuffer()
  );

  const sharp = (await import("sharp")).default;
  const [x2, x1] = await Promise.all([
    sharp(x3).resize(750, 246).png().toBuffer(),
    sharp(x3).resize(375, 123).png().toBuffer(),
  ]);
  return { x1, x2, x3 };
}

/**
 * The whole design for one card: palette, chrome, band.
 *
 * One entry point rather than the old three-tier cascade (stored capture →
 * per-template Satori strip → fixed navy pass). The cascade existed because
 * only a captured screenshot could represent a custom design; now that the
 * band is composed from the card's colours and parts, the same path serves
 * every card, and there is no tier where the pass silently stops matching.
 */
export async function buildWalletDesign(meta: Meta): Promise<WalletDesign> {
  // A design-transfer card's colours only exist as pixels — sample them.
  let sampled: SampledSurface | null = null;
  if (meta.custom?.faceImage) {
    const got = await fetchImage(meta.custom.faceImage);
    if (got) sampled = await sampleSurface(got.buf);
  }

  const palette = passPalette(meta, sampled);
  return { theme: passThemeFrom(palette), strips: await renderPassStrips(meta, palette), palette };
}
