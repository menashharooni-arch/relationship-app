// CustomCard — a freeform, user-designed card.
// Layout comes from data.customization.customLayout (built in the Pro designer).
// NO hooks here — this renders server-side on the public card page.
import type { CardData, CustomElement, CustomLayout, CustomSocial } from "./types";
import { MiniQR } from "./types";
import PlatformIcon from "@/components/PlatformIcon";

// Map a per-platform social element to its value in the card data + icon label.
const SOCIAL_META: Record<CustomSocial, { label: string; icon: string }> = {
  instagram: { label: "Instagram", icon: "Instagram" },
  linkedin:  { label: "LinkedIn",  icon: "LinkedIn" },
  twitter:   { label: "X",         icon: "X / Twitter" },
  tiktok:    { label: "TikTok",    icon: "TikTok" },
  snapchat:  { label: "Snapchat",  icon: "Snapchat" },
  youtube:   { label: "YouTube",   icon: "YouTube" },
  facebook:  { label: "Facebook",  icon: "Facebook" },
};

function socialValue(data: CardData, s?: CustomSocial): string {
  switch (s) {
    case "instagram": return data.instagram || "";
    case "linkedin":  return data.linkedin || "";
    case "twitter":   return data.twitter || "";
    case "tiktok":    return data.tiktok || "";
    case "snapchat":  return data.snapchat || data.customization?.snapchat || "";
    case "youtube":   return (data.customization as { youtube?: string } | undefined)?.youtube || "";
    case "facebook":  return (data.customization as { facebook?: string } | undefined)?.facebook || "";
    default: return "";
  }
}

// Shorten stored values (URLs, long handles) to a card-friendly handle.
function shortHandle(v: string): string {
  const cleaned = v.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const last = cleaned.split("/").filter(Boolean).pop() ?? cleaned;
  return last.startsWith("@") ? last : cleaned.includes("/") ? `@${last.replace(/^@/, "")}` : cleaned;
}

export const DEFAULT_CUSTOM_LAYOUT: CustomLayout = {
  background: "#0e1b35",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  textColor: "#ffffff",
  elements: [
    { id: "name",     type: "field", field: "name",    x: 7,  y: 14, fontSize: 22, bold: true },
    { id: "title",    type: "field", field: "title",   x: 7,  y: 32, fontSize: 11, color: "#93c5fd" },
    { id: "company",  type: "field", field: "company", x: 7,  y: 44, fontSize: 11 },
    { id: "phone",    type: "field", field: "phone",   x: 7,  y: 62, fontSize: 11 },
    { id: "email",    type: "field", field: "email",   x: 7,  y: 74, fontSize: 11 },
    { id: "logo",     type: "logo",     x: 76, y: 12, size: 46 },
    { id: "headshot", type: "headshot", x: 74, y: 44, size: 64 },
    { id: "socials",  type: "socials",  x: 7,  y: 87, fontSize: 9 },
  ],
};

function fieldValue(data: CardData, field?: string): string {
  switch (field) {
    case "name": return data.name || "";
    case "title": return data.title || "";
    case "company": return data.company || "";
    case "phone": {
      const shown = data.customization?.phones?.filter((p) => p?.showOnCard && p.number?.trim());
      return shown && shown.length ? shown[0].number : (data.phone || "");
    }
    case "email": return data.email || "";
    case "website": return data.website || "";
    case "address": return data.address || "";
    case "fax": {
      const f = data.customization?.fax?.trim();
      return f ? `Fax: ${f}` : "";
    }
    default: return "";
  }
}

function socialHandles(data: CardData): string[] {
  return [data.linkedin, data.instagram, data.twitter, data.tiktok, data.snapchat]
    .map((s) => (s || "").trim())
    .filter(Boolean);
}

/** Inner content of a single element (no positioning). Shared by renderer + designer. */
export function CustomElementContent({
  el,
  data,
  layout,
  placeholder = false,
}: {
  el: CustomElement;
  data: CardData;
  layout: CustomLayout;
  placeholder?: boolean;
}) {
  if (el.type === "logo") {
    if (data.logoUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={data.logoUrl} alt="logo" style={{ width: el.size ?? 46, height: el.size ?? 46, objectFit: "contain", borderRadius: 8, display: "block" }} />;
    }
    return placeholder ? (
      <div style={{ width: el.size ?? 46, height: el.size ?? 46, borderRadius: 8, border: "1px dashed rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.6)" }}>Logo</div>
    ) : null;
  }

  if (el.type === "headshot") {
    if (data.photoUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={data.photoUrl} alt="" style={{ width: el.size ?? 64, height: el.size ?? 64, objectFit: "cover", borderRadius: "9999px", display: "block" }} />;
    }
    return placeholder ? (
      <div style={{ width: el.size ?? 64, height: el.size ?? 64, borderRadius: "9999px", border: "1px dashed rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.6)" }}>Photo</div>
    ) : null;
  }

  if (el.type === "socials") {
    const handles = socialHandles(data);
    const shown = handles.length ? handles : placeholder ? ["@handle"] : [];
    if (!shown.length) return null;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: el.fontSize ?? 9, color: el.color ?? layout.textColor, opacity: 0.9 }}>
        {shown.map((h, i) => (
          <span key={i} style={{ whiteSpace: "nowrap" }}>{shortHandle(h)}</span>
        ))}
      </div>
    );
  }

  // One platform: its icon + the handle.
  if (el.type === "social") {
    const meta = SOCIAL_META[el.social ?? "instagram"];
    const raw = socialValue(data, el.social ?? "instagram");
    const shown = raw ? shortHandle(raw) : placeholder ? `@your-${el.social ?? "handle"}` : "";
    if (!shown) return null;
    const fs = el.fontSize ?? 10;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: Math.max(3, fs * 0.4), fontSize: fs, color: el.color ?? layout.textColor, whiteSpace: "nowrap", opacity: raw ? 1 : 0.6 }}>
        <span style={{ width: fs * 1.15, height: fs * 1.15, display: "inline-flex", flexShrink: 0 }}>
          <PlatformIcon label={meta.icon} className="w-full h-full" />
        </span>
        <span style={{ fontWeight: el.bold ? 700 : 400 }}>{shown}</span>
      </span>
    );
  }

  // Scannable QR pointing at this card (marker attr lets the signature hide it).
  if (el.type === "qr") {
    return <MiniQR size={el.size ?? 52} bg="#ffffff" fg="#111827" url={data.cardUrl} />;
  }

  // A simple accent line.
  if (el.type === "divider") {
    return <div style={{ width: el.width ?? 80, height: 2, borderRadius: 2, background: el.color ?? layout.textColor, opacity: 0.85 }} />;
  }

  // field or static text
  const value = el.type === "field" ? fieldValue(data, el.field) : (el.text ?? "");
  const shown = value || (placeholder ? (el.type === "field" ? `{${el.field}}` : "Text") : "");
  if (!shown) return null;
  const multiline = el.type === "field" && el.field === "address";
  return (
    <span
      style={{
        fontSize: el.fontSize ?? 12,
        color: el.color ?? layout.textColor,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? "italic" : "normal",
        whiteSpace: multiline ? "pre-line" : "nowrap",
        lineHeight: multiline ? 1.35 : undefined,
        display: multiline ? "block" : undefined,
      }}
    >
      {shown}
    </span>
  );
}

export default function CustomCard({ data }: { data: CardData }) {
  const layout = data.customization?.customLayout ?? DEFAULT_CUSTOM_LAYOUT;
  return (
    <div
      className="sc-card"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1.75 / 1",
        background: layout.background,
        fontFamily: layout.fontFamily,
        color: layout.textColor,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10)",
      }}
    >
      {layout.elements.map((el) => (
        <div key={el.id} style={{ position: "absolute", left: `${el.x}%`, top: `${el.y}%` }}>
          <CustomElementContent el={el} data={data} layout={layout} />
        </div>
      ))}
    </div>
  );
}
