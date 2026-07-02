import { ImageResponse } from "next/og";
import { resolveCardMeta } from "@/lib/resolve-card";
import { getAdminSupabase } from "@/lib/supabase-admin";

// A pixel-perfect PNG of the real card, captured client-side on the dashboard
// and stored here. When present it IS the share preview, so the link unfurls
// with a picture identical to the card. Until it's captured (or on any error)
// we fall back to the rendered approximation below.
async function storedCardImage(username: string): Promise<ArrayBuffer | null> {
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.storage.from("card-shares").download(`${username}.png`);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    return buf.byteLength > 1000 ? buf : null;
  } catch {
    return null;
  }
}

// Share preview = a picture of the ACTUAL card. When someone texts/DMs their
// SwiftCard link, the unfurl shows their card in their chosen template (colors,
// photo, logo, accent) — not a generic banner. Rendered with Satori, so each
// template is a faithful flexbox approximation of the real design.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Always reflect the live card (so edits show up in shares immediately).
export const dynamic = "force-dynamic";

type Meta = NonNullable<Awaited<ReturnType<typeof resolveCardMeta>>>;

// Card canvas inside the 1200×630 frame — same 1.75:1 ratio as the real cards.
const CARD_W = 1008;
const CARD_H = 576;

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function Contact({ value, dot, color, fs = 27 }: { value: string; dot: string; color: string; fs?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 11, height: 11, borderRadius: 11, background: dot, flexShrink: 0 }} />
      <div style={{ fontSize: fs, color }}>{value}</div>
    </div>
  );
}

function Photo({ url, name, size: s, radius, border, bg = "#334155" }: { url: string | null; name: string; size: number; radius: number; border: string; bg?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} width={s} height={s} style={{ borderRadius: radius, objectFit: "cover", border }} />;
  }
  return (
    <div style={{ width: s, height: s, borderRadius: radius, border, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: s * 0.36, fontWeight: 800, color: "#fff" }}>
      {initialsOf(name)}
    </div>
  );
}

// ── Template renderers ──────────────────────────────────────────────────────

function ModernBoldOG(p: Meta) {
  const BLUE = p.accentColor || "#3b82f6";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#070d1c", padding: "48px 56px", position: "relative" }}>
      <div style={{ position: "absolute", top: -80, right: -60, width: 380, height: 380, borderRadius: 380, background: `radial-gradient(circle, ${BLUE}33 0%, transparent 70%)`, display: "flex" }} />
      {/* Company */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} width={56} height={56} style={{ borderRadius: 12, objectFit: "contain" }} />
        ) : null}
        {p.company ? <div style={{ fontSize: 26, letterSpacing: 5, color: "#cbd5e1", fontWeight: 700, textTransform: "uppercase" }}>{p.company}</div> : null}
      </div>
      {/* Name + title, photo right */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.02 }}>{p.name}</div>
          {p.title ? <div style={{ fontSize: 34, color: BLUE, marginTop: 14, fontWeight: 600 }}>{p.title}</div> : null}
        </div>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={210} radius={210} border={`6px solid ${BLUE}`} bg="#12203c" />
      </div>
      {/* Contacts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {p.phone ? <Contact value={p.phone} dot={BLUE} color="#e2e8f0" fs={29} /> : null}
        {p.email ? <Contact value={p.email} dot={BLUE} color="#cbd5e1" /> : null}
        {website ? <Contact value={website} dot={BLUE} color="#cbd5e1" /> : null}
      </div>
    </div>
  );
}

function ClassicProOG(p: Meta) {
  const BLUE = p.accentColor || "#2563eb";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff", position: "relative" }}>
      {/* Left navy panel */}
      <div style={{ width: "37%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, background: "linear-gradient(160deg, #0e1b35 0%, #162947 100%)" }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={220} radius={220} border="7px solid rgba(255,255,255,0.18)" bg={BLUE} />
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} width={54} height={54} style={{ borderRadius: 12, objectFit: "contain" }} />
        ) : null}
      </div>
      {/* Right white panel */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "48px 56px" }}>
        <div style={{ fontSize: 66, fontWeight: 800, color: "#0f172a", lineHeight: 1.05 }}>{p.name}</div>
        <div style={{ width: 64, height: 6, borderRadius: 6, background: BLUE, marginTop: 16, display: "flex" }} />
        {p.title ? <div style={{ fontSize: 32, color: "#475569", marginTop: 18 }}>{p.title}</div> : null}
        {p.company ? <div style={{ fontSize: 30, fontWeight: 700, color: BLUE, marginTop: 4 }}>{p.company}</div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
          {p.phone ? <Contact value={p.phone} dot={BLUE} color="#334155" fs={29} /> : null}
          {p.email ? <Contact value={p.email} dot={BLUE} color="#334155" /> : null}
          {website ? <Contact value={website} dot={BLUE} color="#334155" /> : null}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 9, background: `linear-gradient(90deg, ${BLUE}, #7c3aed)`, display: "flex" }} />
    </div>
  );
}

function PhotoFirstOG(p: Meta) {
  const ACCENT = p.accentColor || "#6d28d9";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff" }}>
      {/* Left photo panel */}
      <div style={{ width: "40%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)" }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={300} radius={40} border="8px solid rgba(255,255,255,0.25)" bg="rgba(255,255,255,0.15)" />
      </div>
      {/* Right details */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "48px 56px" }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: "#1e1b4b", lineHeight: 1.05 }}>{p.name}</div>
        <div style={{ width: 80, height: 6, borderRadius: 6, background: `linear-gradient(90deg, ${ACCENT}, #a78bfa)`, marginTop: 16, display: "flex" }} />
        {p.title ? <div style={{ fontSize: 32, color: "#4b5563", marginTop: 18 }}>{p.title}</div> : null}
        {p.company ? <div style={{ fontSize: 30, fontWeight: 700, color: ACCENT, marginTop: 4 }}>{p.company}</div> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
          {p.phone ? <Contact value={p.phone} dot={ACCENT} color="#374151" fs={29} /> : null}
          {p.email ? <Contact value={p.email} dot={ACCENT} color="#374151" /> : null}
          {website ? <Contact value={website} dot={ACCENT} color="#374151" /> : null}
        </div>
      </div>
    </div>
  );
}

function LocalBusinessOG(p: Meta) {
  const AMBER = p.accentColor || "#b45309";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fffbf0", position: "relative" }}>
      {/* Header band */}
      <div style={{ height: "33%", display: "flex", alignItems: "center", gap: 24, padding: "0 56px", background: `linear-gradient(100deg, ${AMBER} 0%, #92400e 60%, #f59e0b 100%)` }}>
        {p.logoUrl ? (
          <div style={{ width: 96, height: 96, borderRadius: 96, background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.logoUrl} width={68} height={68} style={{ objectFit: "contain" }} />
          </div>
        ) : null}
        <div style={{ fontSize: 48, fontWeight: 800, color: "#fff" }}>{p.company || p.name}</div>
      </div>
      {/* Body */}
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "24px 56px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: "#78350f", lineHeight: 1.05 }}>{p.name}</div>
          {p.title ? <div style={{ fontSize: 30, color: "#92400e", marginTop: 10 }}>{p.title}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
            {p.phone ? <Contact value={p.phone} dot={AMBER} color="#78350f" fs={29} /> : null}
            {p.email ? <Contact value={p.email} dot={AMBER} color="#92400e" /> : null}
            {website ? <Contact value={website} dot={AMBER} color="#92400e" /> : null}
          </div>
        </div>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={200} radius={200} border={`6px solid ${AMBER}`} bg="#92400e" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: `linear-gradient(90deg, ${AMBER}, #f59e0b, #92400e)`, display: "flex" }} />
    </div>
  );
}

function LuxuryMinimalOG(p: Meta) {
  const GOLD = p.accentColor || "#b08d57";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#fafaf6" }}>
      {/* Gold spine */}
      <div style={{ width: 14, background: `linear-gradient(to bottom, #c9a96a, ${GOLD}, #8c6c34)`, display: "flex" }} />
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "48px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {p.company ? <div style={{ fontSize: 24, letterSpacing: 7, textTransform: "uppercase", color: "#8c7b60", fontWeight: 600 }}>{p.company}</div> : null}
          <div style={{ fontSize: 62, fontWeight: 700, color: "#1c1612", lineHeight: 1.08, marginTop: 14, letterSpacing: 1 }}>{p.name}</div>
          <div style={{ width: 90, height: 3, background: `linear-gradient(90deg, ${GOLD}, transparent)`, marginTop: 18, display: "flex" }} />
          {p.title ? <div style={{ fontSize: 29, color: "#8c7b60", marginTop: 16 }}>{p.title}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
            {p.phone ? <Contact value={p.phone} dot={GOLD} color="#1c1612" fs={28} /> : null}
            {p.email ? <Contact value={p.email} dot={GOLD} color="#5f5142" /> : null}
            {website ? <Contact value={website} dot={GOLD} color="#5f5142" /> : null}
          </div>
        </div>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={190} radius={190} border={`3px solid ${GOLD}`} bg="#8c7b60" />
      </div>
    </div>
  );
}

// Generic fallback for "custom" layouts and anything unrecognized.
function GenericOG(p: Meta) {
  const accent = p.accentColor || "#2563eb";
  const website = (p.website ?? "").replace(/^https?:\/\//, "");
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      <div style={{ height: 16, background: accent, display: "flex" }} />
      <div style={{ display: "flex", flex: 1, padding: "44px 56px", alignItems: "center", gap: 48 }}>
        <Photo url={p.photoUrl} name={p.name ?? ""} size={230} radius={230} border={`8px solid ${accent}`} bg={accent} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#0f172a", lineHeight: 1.0 }}>{p.name}</div>
          {p.title ? <div style={{ fontSize: 38, color: "#475569", marginTop: 12 }}>{p.title}</div> : null}
          {p.company ? <div style={{ fontSize: 36, fontWeight: 700, color: accent, marginTop: 2 }}>{p.company}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 26 }}>
            {p.phone ? <Contact value={p.phone} dot={accent} color="#1e293b" fs={32} /> : null}
            {p.email ? <Contact value={p.email} dot={accent} color="#334155" fs={30} /> : null}
            {website ? <Contact value={website} dot={accent} color="#334155" fs={30} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Prefer the pixel-perfect capture of the real card when it exists.
  const stored = await storedCardImage(username);
  if (stored) {
    return new Response(stored, {
      headers: {
        "Content-Type": "image/png",
        // Short cache so an edited card's new preview propagates quickly.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  }

  const p = await resolveCardMeta(username);

  const meta: Meta = p ?? {
    name: "SwiftCard", title: null, company: null, photoUrl: null, logoUrl: null,
    phone: null, email: null, website: null, address: null, accentColor: null, template: null,
  };

  let card: React.ReactElement;
  switch (meta.template) {
    case "modern-bold":     card = ModernBoldOG(meta); break;
    case "classic-pro":     card = ClassicProOG(meta); break;
    case "photo-first":     card = PhotoFirstOG(meta); break;
    case "local-business":  card = LocalBusinessOG(meta); break;
    case "luxury-minimal":  card = LuxuryMinimalOG(meta); break;
    default:                card = meta.template ? GenericOG(meta) : ClassicProOG(meta); break;
  }

  return new ImageResponse(
    (
      // The card sits on a soft dark backdrop, like a photo of the real card.
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div style={{ width: CARD_W, height: CARD_H, borderRadius: 28, overflow: "hidden", display: "flex", boxShadow: "0 30px 90px rgba(0,0,0,0.55)" }}>
          {card}
        </div>
      </div>
    ),
    { ...size }
  );
}
