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
//   1. ONE layout engine, three variants. Six bespoke per-template layouts each
//      had their own overflow edges, and a custom card fitted none of them. The
//      character that survives at this size is colour and typographic voice,
//      both of which arrive from wallet-palette as data.
//   2. Nothing is positioned absolutely and nothing wraps. Every string goes
//      through fitLine(), which returns a size and a string that provably fit
//      the box they are given, so a 40-character company name cannot reach the
//      edge no matter what else is on the band.
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
/** The left rule on the type variant — luxury-minimal's signature edge. */
const BAR_W = 14;

const IDENTITY_W = (leadWidth: number) => W - PAD_X * 2 - (leadWidth ? leadWidth + GAP : 0);

// Type scale, in @3x px.
const NAME_BASE = 80, NAME_MIN = 34;
/**
 * A short name grows into the band rather than leaving a third of it empty.
 * Capped by the one-line fit, so growth can never cause a wrap: the tallest a
 * grown name can be is 108px, which leaves the rule, title and company well
 * inside the band's 325px of usable height.
 */
const NAME_MAX = 100;
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

/** Pre-fetch into a data: URI so Satori embeds it and can never throw on a
 *  slow or failed fetch. Null → the band draws initials instead. */
async function embedImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  const got = await fetchImage(url);
  return got ? `data:${got.type};base64,${got.buf.toString("base64")}` : null;
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

type BandVariant = "portrait" | "mark" | "type";

/**
 * What the band can actually lead with, given this card's assets.
 *
 * The template states a preference; the content decides whether it can be
 * honoured. A logo-led template with no logo falls to a portrait (initials, if
 * there is no headshot either) rather than rendering an empty box — the one
 * outcome worse than a different layout is a hole where the mark should be.
 */
export function bandVariant(prefer: PassPalette["prefer"], hasPhoto: boolean, hasLogo: boolean): BandVariant {
  if (prefer === "type") return "type";
  if (prefer === "mark") return hasLogo ? "mark" : "portrait";
  if (hasPhoto) return "portrait";
  return hasLogo ? "mark" : "portrait";
}

function Band({ meta, palette, photo, logo }: {
  meta: Meta; palette: PassPalette; photo: string | null; logo: string | null;
}) {
  const { ink, inkMuted, accent, voice } = palette;
  const variant = bandVariant(palette.prefer, !!photo, !!logo);

  const leadWidth = variant === "type" ? BAR_W : IMG;
  const box = IDENTITY_W(leadWidth);

  // The name gets two lines; nothing else does. It is the one string on the
  // band that must never be cut, and there is vertical room for a second line
  // (a wrapped name at full size plus title and company still clears the band
  // by ~30px @3x — the render test asserts that margin on real pixels).
  const name = fitLine(meta.name || "SwiftCard", {
    box, base: NAME_BASE, min: NAME_MIN, uppercase: voice.caps, tracking: voice.tracking,
    maxLines: 2, grow: NAME_MAX,
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
      ) : variant === "mark" ? (
        <Mark url={logo} label={meta.company || meta.name} ink={ink} accent={accent} />
      ) : (
        <div style={{
          width: BAR_W, height: 232, borderRadius: BAR_W, display: "flex",
          background: `linear-gradient(180deg, ${accent} 0%, ${withAlpha(accent, 0.35)} 100%)`,
        }} />
      )}

      <div style={{ width: GAP, display: "flex", flex: "none" }} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{
          fontSize: name.fontSize, letterSpacing: name.letterSpacing, fontWeight: voice.weight,
          color: ink, lineHeight: 1.08,
          ...(voice.caps ? { textTransform: "uppercase" as const } : {}),
        }}>{name.text}</div>

        {voice.rule ? (
          <div style={{ width: 104, height: 7, borderRadius: 7, background: accent, marginTop: 16, display: "flex" }} />
        ) : null}

        {title.text ? (
          <div style={{
            fontSize: title.fontSize, color: accent, fontWeight: 600,
            marginTop: voice.rule ? 14 : 16, lineHeight: 1.2,
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
    // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
    return <img src={url} alt="" width={IMG} height={IMG} style={{ borderRadius: IMG, objectFit: "cover", border: ring, flex: "none" }} />;
  }
  return (
    <div style={{
      width: IMG, height: IMG, borderRadius: IMG, border: ring, flex: "none",
      background: withAlpha(ink, 0.12), display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 86, fontWeight: 700, color: ink, letterSpacing: "0.01em",
    }}>{initialsOf(name)}</div>
  );
}

function Mark({ url, label, ink, accent }: { url: string | null; label: string | null; ink: string; accent: string }) {
  // A panel, not a bare logo: brand marks arrive on every ground imaginable
  // (white PNGs, dark PNGs, transparent) and a translucent tile keeps all of
  // them legible without knowing which kind this one is.
  return (
    <div style={{
      width: IMG, height: IMG, borderRadius: 28, flex: "none",
      background: withAlpha(ink, 0.1), display: "flex", alignItems: "center", justifyContent: "center",
      padding: 22, overflow: "hidden",
    }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori, not the DOM
        <img src={url} alt="" width={IMG - 44} height={IMG - 44} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ fontSize: 88, fontWeight: 700, color: accent, letterSpacing: "0.04em", display: "flex" }}>
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
  const [photo, logo] = await Promise.all([embedImage(p.photoUrl), embedImage(p.logoUrl)]);

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
