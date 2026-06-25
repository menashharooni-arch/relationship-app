// CustomCard — a freeform, user-designed card.
// Layout comes from data.customization.customLayout (built in the Pro designer).
import type { CardData, CustomElement, CustomLayout } from "./types";

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
    case "phone": return data.phone || "";
    case "email": return data.email || "";
    case "website": return data.website || "";
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
          <span key={i} style={{ whiteSpace: "nowrap" }}>{h}</span>
        ))}
      </div>
    );
  }

  // field or static text
  const value = el.type === "field" ? fieldValue(data, el.field) : (el.text ?? "");
  const shown = value || (placeholder ? (el.type === "field" ? `{${el.field}}` : "Text") : "");
  if (!shown) return null;
  return (
    <span style={{ fontSize: el.fontSize ?? 12, color: el.color ?? layout.textColor, fontWeight: el.bold ? 700 : 400, whiteSpace: "nowrap" }}>
      {shown}
    </span>
  );
}

export default function CustomCard({ data }: { data: CardData }) {
  const layout = data.customization?.customLayout ?? DEFAULT_CUSTOM_LAYOUT;
  return (
    <div
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
