// CustomCard — a user-designed card.
// Layout comes from data.customization.customLayout (built in the Pro designer).
// NO hooks here — this renders server-side on the public card page.
//
// Two layouts can arrive:
//   BLOCKS (current)  — content flows inside zones. Nothing is positioned, so
//                       nothing can overlap, hang off the edge, or render at a
//                       different scale than the editor showed.
//   ELEMENTS (legacy) — absolute x/y from the old designer. Rendered exactly as
//                       before so a card someone already published never moves.
import type { CardData, CustomBlock, CustomElement, CustomLayout, CustomSocial } from "./types";
import { MiniQR } from "./MiniQR";
import { fitName, fitPx, formatPhone, IcoPhone, IcoMail, IcoGlobe, IcoPin } from "./shared";
import {
  blockAspect, blockDensity, blockFontPx, blockImagePx, hasBlocks,
  normalizeCustomLayout, sideImageScale, visibleBlocks,
} from "@/lib/custom-layout";
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
  // The name field is nowrap at a fixed size, so a long first name would run off
  // the card — auto-fit it down past a 9-letter word, same rule the standard
  // templates use.
  const baseFs = el.fontSize ?? 12;
  const fs = el.type === "field" && el.field === "name" ? fitName(baseFs, value, 16) : baseFs;
  return (
    <span
      style={{
        fontSize: fs,
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

// ── Block rendering ─────────────────────────────────────────────────────────

const CONTACT_ICON: Record<string, () => React.ReactElement> = {
  phone: IcoPhone, fax: IcoPhone, email: IcoMail, website: IcoGlobe, address: IcoPin,
};

/** Colour ramp so an owner never has to pick a shade per line. */
function ramp(layout: CustomLayout) {
  const strong = layout.textColor;
  return {
    hero: strong,
    normal: strong,
    quiet: withOpacity(strong, 0.72),
    accent: layout.accentColor || strong,
  };
}
function withOpacity(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * One block, laid out in flow. Every text block wraps and auto-fits — there is
 * no `nowrap` anywhere, which is what stops a long email from running past the
 * card edge the way the legacy renderer could.
 */
export function CustomBlockContent({
  block, data, layout, density, imageScale = 1, placeholder = false,
}: {
  block: CustomBlock; data: CardData; layout: CustomLayout; density: number;
  imageScale?: number; placeholder?: boolean;
}) {
  const c = ramp(layout);
  const fs = blockFontPx(block.emphasis, density);
  const px = Math.round(blockImagePx(block.emphasis, density) * imageScale);
  const tone = block.color || (block.emphasis === "quiet" ? c.quiet : c.normal);

  if (block.type === "logo") {
    if (!data.logoUrl) return placeholder
      ? <div style={{ width: px, height: px * 0.62, borderRadius: 9, border: `1px dashed ${withOpacity(layout.textColor, 0.4)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: c.quiet }}>Logo</div>
      : null;
    return (
      // Clipped to its own radius: real logos are opaque rectangles, so rounding
      // the image itself is the only thing that looks deliberate for all of them.
      <div style={{ borderRadius: 10, overflow: "hidden", boxShadow: `0 0 0 1px ${withOpacity(layout.textColor, 0.16)}`, display: "flex", maxWidth: "100%" }}>
        {/* Width and height are capped SEPARATELY. A wordmark needs room across,
            not down, and height is the scarce dimension — raising both together
            made a full card overflow again, which the fuzz caught immediately. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.logoUrl} alt="logo" style={{ maxWidth: px * 1.34, maxHeight: px * 0.72, objectFit: "contain", display: "block" }} />
      </div>
    );
  }

  if (block.type === "headshot") {
    if (!data.photoUrl) return placeholder
      ? <div style={{ width: px, height: px, borderRadius: 9999, border: `1px dashed ${withOpacity(layout.textColor, 0.4)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: c.quiet }}>Photo</div>
      : null;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={data.photoUrl} alt="" style={{ width: px, height: px, objectFit: "cover", borderRadius: 9999, display: "block" }} />;
  }

  if (block.type === "qr") {
    return <MiniQR size={Math.round(px * 0.68)} bg="#ffffff" fg="#111827" url={data.cardUrl} />;
  }

  if (block.type === "divider") {
    return <div style={{ width: "62%", height: 2, borderRadius: 2, background: block.color || c.accent, opacity: 0.8 }} />;
  }

  if (block.type === "socials") {
    const handles = socialHandles(data);
    const shown = handles.length ? handles : placeholder ? ["@handle"] : [];
    if (!shown.length) return null;
    return (
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", fontSize: fs, color: tone }}>
        {shown.map((h, i) => <span key={i}>{shortHandle(h)}</span>)}
      </div>
    );
  }

  if (block.type === "social") {
    const meta = SOCIAL_META[block.social ?? "instagram"];
    const raw = socialValue(data, block.social ?? "instagram");
    const shown = raw ? shortHandle(raw) : placeholder ? `@your-${block.social}` : "";
    if (!shown) return null;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: fs * 0.45, fontSize: fs, color: tone, minWidth: 0 }}>
        <span style={{ width: fs * 1.15, height: fs * 1.15, display: "inline-flex", flexShrink: 0, color: c.accent }}>
          <PlatformIcon label={meta.icon} className="w-full h-full" />
        </span>
        <span style={{ overflowWrap: "anywhere" }}>{shown}</span>
      </span>
    );
  }

  // field / text
  const rawValue = block.type === "field" ? fieldValue(data, block.field) : (block.text ?? "");
  // Numbers go through the same formatter every preset template uses, so a
  // custom card never shows a raw 4048550515 where the others show (404) 855-0515.
  const value = block.field === "phone" && rawValue ? formatPhone(rawValue) : rawValue;
  const shown = value || (placeholder ? (block.type === "field" ? `{${block.field}}` : "Text") : "");
  if (!shown) return null;

  const isName = block.field === "name";
  const isTitle = block.field === "title";
  const Icon = block.type === "field" ? CONTACT_ICON[block.field ?? ""] : undefined;
  // Auto-fit by length so a long value shrinks instead of overflowing. The name
  // additionally fits by longest WORD, the same rule the preset templates use.
  const sized = isName ? fitName(fs, value, 16) : fitPx(fs, shown, block.emphasis === "hero" ? 18 : 26);

  const text = (
    <span
      style={{
        fontSize: sized,
        color: isTitle ? c.accent : tone,
        fontWeight: block.emphasis === "hero" ? 650 : isTitle || block.field === "phone" ? 600 : 400,
        letterSpacing: isName ? "0.03em" : isTitle ? "0.13em" : undefined,
        textTransform: isName || isTitle ? "uppercase" : undefined,
        lineHeight: 1.25,
        overflowWrap: "anywhere",
        whiteSpace: block.field === "address" ? "pre-line" : undefined,
        minWidth: 0,
      }}
    >
      {shown}
    </span>
  );

  if (!Icon) return text;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: Math.max(5, fs * 0.5), minWidth: 0, color: c.accent }}>
      <span style={{ width: fs * 1.05, height: fs * 1.05, display: "inline-flex", flexShrink: 0 }}><Icon /></span>
      {text}
    </span>
  );
}

function Zone({
  blocks, data, layout, density, placeholder, gap, imageScale = 1,
}: {
  blocks: CustomBlock[]; data: CardData; layout: CustomLayout; density: number;
  placeholder: boolean; gap: number; imageScale?: number;
}) {
  return (
    <>
      {blocks.map((bl) => (
        <div key={bl.id} data-cb={bl.id} style={{ minWidth: 0, marginTop: gap }}>
          <CustomBlockContent
            block={bl} data={data} layout={layout} density={density}
            imageScale={imageScale} placeholder={placeholder}
          />
        </div>
      ))}
    </>
  );
}

export function CustomBlockCard({ data, placeholder = false }: { data: CardData; placeholder?: boolean }) {
  const layout = normalizeCustomLayout(data.customization?.customLayout);
  const skeleton = layout.skeleton ?? "split";
  const stacked = skeleton === "stacked";
  // Trimmed here as well as in the editor: the editor stops an owner going past
  // the cap, and this stops a hand-edited payload from rendering a broken card.
  const blocks = visibleBlocks(layout.blocks ?? []);
  const density = blockDensity(blocks, skeleton);
  const sideScale = sideImageScale(skeleton);

  const side = blocks.filter((bl) => bl.zone === "left");
  const main = blocks.filter((bl) => bl.zone === "right" && bl.type !== "qr");
  const qr = blocks.find((bl) => bl.zone === "right" && bl.type === "qr");
  const gap = Math.round(5 * density);

  const sidePanel = side.length ? (
    <div
      className="shrink-0 flex items-center"
      style={
        // Stacked reads as a letterhead, so the band aligns LEFT with the text
        // beneath it. Centring it looked like a mistake rather than a choice.
        stacked
          ? { width: "100%", padding: "15px 18px 0", gap: 12, justifyContent: "flex-start" }
          : { width: "34%", padding: "16px 12px 16px 17px", flexDirection: "column", justifyContent: "center" }
      }
    >
      <Zone blocks={side} data={data} layout={layout} density={density} placeholder={placeholder} gap={0} imageScale={sideScale} />
    </div>
  ) : null;

  const rule = !stacked && side.length ? (
    <div className="self-stretch shrink-0" style={{ width: 1, margin: "20px 0", background: withOpacity(layout.textColor, 0.2) }} />
  ) : null;

  return (
    <div
      className="sc-card"
      style={{
        position: "relative", width: "100%", aspectRatio: blockAspect(blocks, skeleton),
        background: layout.background, fontFamily: layout.fontFamily, color: layout.textColor,
        borderRadius: 16, overflow: "hidden", display: "flex",
        flexDirection: stacked ? "column" : skeleton === "mirror" ? "row-reverse" : "row",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.10)",
      }}
    >
      {sidePanel}
      {rule}
      <div
        className="flex-1 min-w-0 flex flex-col justify-between"
        style={{ padding: stacked ? "10px 18px 14px" : "16px 16px 14px 15px" }}
      >
        <div className="min-w-0 flex flex-col">
          <Zone blocks={main} data={data} layout={layout} density={density} placeholder={placeholder} gap={gap} />
        </div>
        {/* The QR always lands bottom-right at a fixed inset, the same place it
            sits on all six preset templates. */}
        {qr ? (
          <div className="flex items-end justify-end" data-cb={qr.id}>
            <CustomBlockContent block={qr} data={data} layout={layout} density={density} placeholder={placeholder} />
          </div>
        ) : <div />}
      </div>
    </div>
  );
}

export default function CustomCard({ data }: { data: CardData }) {
  const raw = data.customization?.customLayout;
  if (hasBlocks(raw as CustomLayout)) return <CustomBlockCard data={data} />;

  // ── Legacy absolute layout ────────────────────────────────────────────────
  // A corrupted layout (e.g. a restored guest draft that saved `customLayout: {}`
  // with no elements) would throw on `.elements.map` and crash the card. Fall
  // back to the default element set when elements isn't an array. (cards audit M4)
  const base = (raw as CustomLayout) ?? DEFAULT_CUSTOM_LAYOUT;
  const layout = Array.isArray(base?.elements) && base.elements.length
    ? base
    : { ...DEFAULT_CUSTOM_LAYOUT, ...(base as object), elements: DEFAULT_CUSTOM_LAYOUT.elements };
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
