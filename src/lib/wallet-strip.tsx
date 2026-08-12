import { ImageResponse } from "next/og";
import type { ResolvedCardMeta } from "@/lib/resolve-card";

// ── The Wallet pass, in the card's own design ────────────────────────────────
// The pass used to be one fixed navy layout for every card. Apple's pass
// anatomy can't literally BE the web card (layout is fixed), but a storeCard
// strip is a free canvas — so each template renders a strip in its own design
// language (same colors, panels, accents as the OG share previews in
// card/[username]/opengraph-image.tsx), and passTheme() re-colors the pass
// chrome around it to match. Result: the pass in your Wallet looks like YOUR
// card, not like a coupon.
//
// Strip geometry: 375×123pt → rendered once at @3x (1125×369) with Satori,
// then downscaled with sharp for @2x/@1x. Same next/og + Node-runtime combo
// the per-card OG image already uses in production.

type Meta = NonNullable<ResolvedCardMeta>;

export type PassTheme = {
  backgroundColor: string; // pass chrome, rgb() as Apple wants
  foregroundColor: string;
  labelColor: string;
  /** Dark chrome carries the white wordmark logo; light chrome uses logoText. */
  darkChrome: boolean;
};

export type PassStrips = { x1: Buffer; x2: Buffer; x3: Buffer };

const W = 1125;
const H = 369;

function hexToRgb(hex: string | null | undefined, fallback: string): string {
  const m = (hex ?? "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Same readable-accent lift the logo-first card/OG use: brighten the owner's
// accent until it clears the navy, or fall back to white.
function readableAccent(raw: string | null): string {
  const m = (raw ?? "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < 12; i++) {
    if ((r * 299 + g * 587 + b * 114) / 1000 > 110) break;
    r += (255 - r) * 0.16; g += (255 - g) * 0.16; b += (255 - b) * 0.16;
  }
  const hx = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  const out = `#${hx(r)}${hx(g)}${hx(b)}`;
  return (r * 299 + g * 587 + b * 114) / 1000 > 100 ? out : "#ffffff";
}

export function passTheme(meta: Meta): PassTheme {
  const accent = meta.accentColor;
  switch (meta.template) {
    case "modern-bold":
      return { backgroundColor: "rgb(7, 13, 28)", foregroundColor: "rgb(241, 245, 249)", labelColor: hexToRgb(accent, "rgb(59, 130, 246)"), darkChrome: true };
    case "photo-first":
      return { backgroundColor: "rgb(255, 255, 255)", foregroundColor: "rgb(30, 27, 75)", labelColor: hexToRgb(accent, "rgb(109, 40, 217)"), darkChrome: false };
    case "local-business":
      return { backgroundColor: "rgb(255, 251, 240)", foregroundColor: "rgb(120, 53, 15)", labelColor: hexToRgb(accent, "rgb(180, 83, 9)"), darkChrome: false };
    case "luxury-minimal":
      return { backgroundColor: "rgb(250, 250, 246)", foregroundColor: "rgb(28, 22, 18)", labelColor: hexToRgb(accent, "rgb(176, 141, 87)"), darkChrome: false };
    case "logo-first":
      return { backgroundColor: "rgb(44, 58, 82)", foregroundColor: "rgb(255, 255, 255)", labelColor: hexToRgb(readableAccent(accent), "rgb(255, 255, 255)"), darkChrome: true };
    case "classic-pro":
    default:
      return { backgroundColor: "rgb(255, 255, 255)", foregroundColor: "rgb(15, 23, 42)", labelColor: hexToRgb(accent, "rgb(37, 99, 235)"), darkChrome: false };
  }
}

function initialsOf(name: string | null | undefined) {
  return (name ?? "").split(" ").map((n) => n[0] ?? "").join("").toUpperCase().slice(0, 2) || "SC";
}

// Only fetch card images from hosts our upload flows actually write to. The
// URL comes from a DB column the card owner controls, and this fetch runs
// server-side — without the allowlist it's an SSRF primitive (point logo_url
// at an internal host and make the server call it). Legacy rows pointing
// anywhere else just fall back to initials.
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

// Pre-fetch a remote image into a data: URI so Satori embeds it and can never
// throw on a slow/failed fetch (same guard as the OG route). Null → initials.
async function embedImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (!/^https?:\/\//.test(url)) return null;
  if (!allowedImageHost(url)) return null;
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
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Photo({ url, name, size: s, radius, border, bg = "#334155" }: { url: string | null; name: string; size: number; radius: number; border: string; bg?: string }) {
  if (url) return <img src={url} alt="" width={s} height={s} style={{ borderRadius: radius, objectFit: "cover", border }} />;
  return (
    <div style={{ width: s, height: s, borderRadius: radius, border, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: s * 0.36, fontWeight: 800, color: "#fff" }}>
      {initialsOf(name)}
    </div>
  );
}

function Identity({ name, title, company, nameColor, titleColor, companyColor, bar }: { name: string; title: string | null; company: string | null; nameColor: string; titleColor: string; companyColor: string; bar?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 64, fontWeight: 800, color: nameColor, lineHeight: 1.04 }}>{name}</div>
      {bar ? <div style={{ width: 96, height: 8, borderRadius: 8, background: bar, marginTop: 14, display: "flex" }} /> : null}
      {title ? <div style={{ fontSize: 33, color: titleColor, marginTop: 12, fontWeight: 600 }}>{title}</div> : null}
      {company ? <div style={{ fontSize: 30, fontWeight: 700, color: companyColor, marginTop: 2 }}>{company}</div> : null}
    </div>
  );
}

// ── Per-template strips — each echoes its OG/share design ────────────────────

function ModernBoldStrip(p: Meta) {
  const BLUE = p.accentColor || "#3b82f6";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 44, background: "#070d1c", padding: "0 64px", position: "relative" }}>
      <div style={{ position: "absolute", top: -140, right: -80, width: 420, height: 420, borderRadius: 420, background: `radial-gradient(circle, ${BLUE}33 0%, transparent 70%)`, display: "flex" }} />
      <Identity name={p.name ?? ""} title={p.title} company={p.company} nameColor="#f1f5f9" titleColor={BLUE} companyColor="#cbd5e1" />
      <Photo url={p.photoUrl} name={p.name ?? ""} size={230} radius={230} border={`7px solid ${BLUE}`} bg="#12203c" />
    </div>
  );
}

function ClassicProStrip(p: Meta) {
  const BLUE = p.accentColor || "#2563eb";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff", position: "relative" }}>
      <div style={{ width: "30%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #0e1b35 0%, #162947 100%)" }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={230} radius={230} border="8px solid rgba(255,255,255,0.18)" bg={BLUE} />
      </div>
      <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 56px" }}>
        <Identity name={p.name ?? ""} title={p.title} company={p.company} nameColor="#0f172a" titleColor="#475569" companyColor={BLUE} bar={BLUE} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: `linear-gradient(90deg, ${BLUE}, #7c3aed)`, display: "flex" }} />
    </div>
  );
}

function PhotoFirstStrip(p: Meta) {
  const ACCENT = p.accentColor || "#6d28d9";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff" }}>
      <div style={{ width: "30%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)" }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={250} radius={40} border="8px solid rgba(255,255,255,0.25)" bg="rgba(255,255,255,0.15)" />
      </div>
      <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 56px" }}>
        <Identity name={p.name ?? ""} title={p.title} company={p.company} nameColor="#1e1b4b" titleColor="#4b5563" companyColor={ACCENT} bar={`linear-gradient(90deg, ${ACCENT}, #a78bfa)`} />
      </div>
    </div>
  );
}

function LocalBusinessStrip(p: Meta) {
  const AMBER = p.accentColor || "#b45309";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 44, background: `linear-gradient(100deg, ${AMBER} 0%, #92400e 60%, #f59e0b 100%)`, padding: "0 64px" }}>
      <Identity name={p.name ?? ""} title={p.title} company={p.company} nameColor="#ffffff" titleColor="#fde68a" companyColor="rgba(255,255,255,0.92)" />
      <Photo url={p.photoUrl} name={p.name ?? ""} size={230} radius={230} border="7px solid rgba(255,255,255,0.85)" bg="#92400e" />
    </div>
  );
}

function LuxuryMinimalStrip(p: Meta) {
  const GOLD = p.accentColor || "#b08d57";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fafaf6" }}>
      <div style={{ width: 18, background: `linear-gradient(to bottom, #c9a96a, ${GOLD}, #8c6c34)`, display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 60px", gap: 44 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          {p.company ? <div style={{ fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: "#8c7b60", fontWeight: 600 }}>{p.company}</div> : null}
          <div style={{ fontSize: 60, fontWeight: 700, color: "#1c1612", lineHeight: 1.08, marginTop: 8, letterSpacing: 1 }}>{p.name}</div>
          <div style={{ width: 100, height: 4, background: `linear-gradient(90deg, ${GOLD}, transparent)`, marginTop: 14, display: "flex" }} />
          {p.title ? <div style={{ fontSize: 28, color: "#8c7b60", marginTop: 12 }}>{p.title}</div> : null}
        </div>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={210} radius={210} border={`4px solid ${GOLD}`} bg="#8c7b60" />
      </div>
    </div>
  );
}

function LogoFirstStrip(p: Meta) {
  const ACCENT = readableAccent(p.accentColor);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#2c3a52" }}>
      <div style={{ width: "28%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.045)" }}>
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="" width={210} height={150} style={{ objectFit: "contain", borderRadius: 16 }} />
        ) : (
          <div style={{ fontSize: 84, fontWeight: 700, color: ACCENT, letterSpacing: 4 }}>{initialsOf(p.company || p.name)}</div>
        )}
      </div>
      <div style={{ width: 2, marginTop: 56, marginBottom: 56, background: "rgba(255,255,255,0.20)", display: "flex" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 52px" }}>
        <div style={{ fontSize: 54, fontWeight: 600, color: "#ffffff", lineHeight: 1.08, letterSpacing: 2, textTransform: "uppercase" }}>{p.name}</div>
        {p.title ? <div style={{ fontSize: 24, color: ACCENT, marginTop: 10, letterSpacing: 5, textTransform: "uppercase", fontWeight: 600 }}>{p.title}</div> : null}
        {p.company ? <div style={{ fontSize: 28, color: "#c2ccdc", marginTop: 10 }}>{p.company}</div> : null}
      </div>
    </div>
  );
}

function GenericStrip(p: Meta) {
  const accent = p.accentColor || "#2563eb";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      <div style={{ height: 14, background: accent, display: "flex" }} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44, padding: "0 64px" }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={210} radius={210} border={`8px solid ${accent}`} bg={accent} />
        <Identity name={p.name ?? ""} title={p.title} company={p.company} nameColor="#0f172a" titleColor="#475569" companyColor={accent} />
      </div>
    </div>
  );
}

// ── Tier 1: the REAL card, as the strip ─────────────────────────────────────
// card-shares/{username}.png is the pixel-perfect client-side capture of the
// actual rendered card — the same Tier-1 asset the OG share preview uses. When
// it exists, the strip IS the card: the full capture, contain-fit with its
// corners rounded and safely inset from the pass's own corner radius, over a
// blurred, dimmed cover-fit echo of itself so the side margins read as
// intentional ground rather than letterbox bars. This is the only way a CUSTOM
// card design can appear on the pass faithfully — the Satori templates below
// can only approximate the six stock templates.
export type CaptureDesign = { theme: PassTheme; strips: PassStrips; bare: true };

/** What the hybrid strip prints beside the card. */
export type CaptureIdentity = { name: string; title?: string | null; company?: string | null };

export async function captureDesign(username: string, identity?: CaptureIdentity): Promise<CaptureDesign | null> {
  try {
    const { getAdminSupabase } = await import("@/lib/supabase-admin");
    const { data, error } = await getAdminSupabase().storage.from("card-shares").download(`${username}.png`);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    return await captureToDesign(buf, identity);
  } catch {
    return null;
  }
}

/** The pure capture→(theme, strips) transform — separated so tests can feed it
 *  a synthetic capture without touching storage. With an identity, the strip
 *  is the HYBRID: card art at max legal size on the left, the owner's name
 *  writ large beside it — because a 1.75:1 card contain-fit in Apple's 3:1
 *  strip leaves half the width as bare ground, and the real pass looked like
 *  a tiny card floating in an empty page (owner's screenshot, 2026-08-11).
 *  Apple caps the art size; it does not cap how intentional the rest looks. */
export async function captureToDesign(capture: Buffer, identity?: CaptureIdentity): Promise<CaptureDesign | null> {
  try {
    const sharp = (await import("sharp")).default;
    const img = sharp(capture);
    const m = await img.metadata();
    if (!m.width || !m.height) return null;
    const ratio = m.width / m.height;
    // Same sanity window the OG route applies to the capture.
    if (ratio < 1.25 || ratio > 2.4) return null;

    // Chrome colors from the card itself: a 1×1 resize is the average color.
    const avg = await sharp(capture).resize(1, 1, { fit: "cover" }).raw().toBuffer();
    const [r, g, b] = [avg[0], avg[1], avg[2]];
    const dark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
    const theme: PassTheme = {
      backgroundColor: `rgb(${r}, ${g}, ${b})`,
      foregroundColor: dark ? "rgb(255, 255, 255)" : "rgb(15, 23, 42)",
      labelColor: dark ? "rgb(203, 213, 225)" : "rgb(71, 85, 105)",
      darkChrome: dark,
    };

    // The strip's ground is a FLAT fill of the same color as the pass chrome,
    // so strip and chrome fuse into one continuous card-colored surface — the
    // card doesn't sit in a visible box (the earlier blurred backdrop read as
    // "a tag holding a card"). The card itself is as large as the strip
    // allows, corners rounded and inset just clear of the pass's own radius.
    const makeStrip = async (w: number, h: number, inset: number, rx: number): Promise<Buffer> => {
      const cardH = h - inset * 2;
      const cardW = Math.min(Math.round(cardH * ratio), w - inset * 2);
      const mask = Buffer.from(
        `<svg width="${cardW}" height="${cardH}"><rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${rx}" ry="${rx}"/></svg>`
      );
      const card = await sharp(capture)
        .resize(cardW, cardH, { fit: "fill" })
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
      return sharp({ create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 1 } } })
        .composite([{ input: card, left: Math.round((w - cardW) / 2), top: inset }])
        .png()
        .toBuffer();
    };

    // storeCard strip geometry (375×123pt). Coupon's 144pt strip was tried
    // for the larger card and REJECTED: the coupon layout draws serrated
    // ticket-perforation edges on the pass, which is exactly the look the
    // owner is escaping. storeCard has clean rounded edges.
    if (!identity?.name?.trim()) {
      const [x3, x2, x1] = await Promise.all([
        makeStrip(1125, 369, 21, 30),
        makeStrip(750, 246, 14, 20),
        makeStrip(375, 123, 7, 10),
      ]);
      return { theme, strips: { x1, x2, x3 }, bare: true };
    }

    // ── Hybrid strip: card left, identity right, one card-colored surface ──
    // Rendered once at @3x with Satori (the same next/og engine the template
    // strips use) and downscaled — the capture rides in as a data URI so
    // Satori can never stall on a fetch.
    const name = identity.name.trim();
    const title = identity.title?.trim() || null;
    const company = identity.company?.trim() || null;
    const dataUri = `data:image/png;base64,${capture.toString("base64")}`;
    const inset = 29; // ~@3x of the sharp path's 1x inset; clears the pass radius
    const cardH = 369 - inset * 2;
    const cardW = Math.round(cardH * ratio);
    const fg = theme.foregroundColor;
    // Long names shrink instead of wrapping into the card: the strip is a
    // banner, and a banner with a two-line name reads as an error.
    const nameSize = name.length > 22 ? 40 : name.length > 14 ? 50 : 60;
    const x3 = Buffer.from(
      await new ImageResponse(
        (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 44,
            background: theme.backgroundColor, padding: `0 ${inset}px`, fontFamily: "sans-serif",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori element, not DOM */}
            <img src={dataUri} width={cardW} height={cardH} style={{ borderRadius: 24 }} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: nameSize, fontWeight: 800, color: fg, lineHeight: 1.05 }}>{name}</div>
              {title ? <div style={{ fontSize: 27, color: theme.labelColor, marginTop: 10, fontWeight: 600 }}>{title}</div> : null}
              {company ? <div style={{ fontSize: 25, fontWeight: 700, color: fg, marginTop: 4, opacity: 0.85 }}>{company}</div> : null}
            </div>
          </div>
        ),
        { width: 1125, height: 369 }
      ).arrayBuffer()
    );
    const [x2, x1] = await Promise.all([
      sharp(x3).resize(750, 246).png().toBuffer(),
      sharp(x3).resize(375, 123).png().toBuffer(),
    ]);
    return { theme, strips: { x1, x2, x3 }, bare: true };
  } catch {
    return null;
  }
}

/** Render the card-styled strip at @3x, downscale for @2x/@1x with sharp. */
export async function renderCardStrips(meta: Meta): Promise<PassStrips> {
  const p: Meta = { ...meta };
  if (!(typeof p.name === "string" && p.name.trim())) p.name = "SwiftCard";
  [p.photoUrl, p.logoUrl] = await Promise.all([embedImage(p.photoUrl), embedImage(p.logoUrl)]);

  let strip: React.ReactElement;
  switch (p.template) {
    case "modern-bold":    strip = ModernBoldStrip(p); break;
    case "classic-pro":    strip = ClassicProStrip(p); break;
    case "photo-first":    strip = PhotoFirstStrip(p); break;
    case "local-business": strip = LocalBusinessStrip(p); break;
    case "luxury-minimal": strip = LuxuryMinimalStrip(p); break;
    case "logo-first":     strip = LogoFirstStrip(p); break;
    default:               strip = p.template ? GenericStrip(p) : ClassicProStrip(p); break;
  }

  const x3 = Buffer.from(
    await new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", fontFamily: "sans-serif" }}>{strip}</div>,
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
