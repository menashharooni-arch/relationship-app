// ── Design transfer: an uploaded card design, re-issued to the owner ────────
//
// The owner uploads a picture of a card design they like (their old printed
// card, a template screenshot, someone else's card). The image model rebuilds
// THAT design carrying THIS owner's details. This file owns the instruction —
// pure string-building, no fetch — so tests can pin what the model is asked
// without touching a provider.
//
// The contract with the caller (and the UI): the output is a PROPOSAL. Image
// models fumble small text often enough that nothing here may auto-publish;
// the owner approves a side-by-side preview or regenerates. "It cannot make
// any mistakes" is delivered by that gate, not by trusting the model.

export type TransferIdentity = {
  name: string;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  /** Whether reference images ride along in the same request, in this order. */
  hasHeadshot?: boolean;
  hasLogo?: boolean;
};

/** One line per fact the model may print — and an explicit "omit" list, because
 *  the single worst failure is the TEMPLATE's details surviving onto the card. */
export function transferPrompt(id: TransferIdentity): string {
  const facts: string[] = [`- Name: ${id.name}`];
  if (id.title?.trim()) facts.push(`- Job title: ${id.title.trim()}`);
  if (id.company?.trim()) facts.push(`- Company: ${id.company.trim()}`);
  if (id.phone?.trim()) facts.push(`- Phone: ${id.phone.trim()}`);
  if (id.email?.trim()) facts.push(`- Email: ${id.email.trim()}`);
  if (id.website?.trim()) facts.push(`- Website: ${id.website.trim()}`);
  if (id.address?.trim()) facts.push(`- Address: ${id.address.trim()}`);

  const refs: string[] = [];
  if (id.hasHeadshot) refs.push("The FIRST extra image is this person's headshot — put it wherever the design shows a person's photo, cropped the same way.");
  if (id.hasLogo) refs.push(`The ${id.hasHeadshot ? "SECOND" : "FIRST"} extra image is their company logo — put it wherever the design shows a logo.`);

  return [
    "The first image is a business card design. Recreate it EXACTLY — same layout,",
    "same fonts, same colours, same graphics, same alignment and spacing — but",
    "belonging to a different person. Replace every piece of personal information",
    "on it with the details below, each in the same position and style as the",
    "text it replaces:",
    "",
    ...facts,
    "",
    ...refs,
    "",
    "Rules:",
    "- Print ONLY the details listed above. Any name, number, email, address,",
    "  company or handle from the original that has no replacement listed must be",
    "  REMOVED, leaving the design's styling intact.",
    "- Do not add, move, resize or restyle anything. Do not add a QR code, logo",
    "  or decoration the original does not have.",
    "- Keep the exact canvas: same aspect ratio, no borders or margins added.",
    "- Spell every detail exactly as written above, character for character.",
    "Return only the edited image.",
  ].join("\n");
}

/** Everything the approval UI asks the owner to eyeball, in checklist order.
 *  Kept next to the prompt so the two never drift apart. */
export function transferChecklist(id: TransferIdentity): string[] {
  const items = ["Your name is spelled exactly right"];
  if (id.phone?.trim()) items.push("The phone number is yours, digit for digit");
  if (id.email?.trim()) items.push("The email is yours, character for character");
  if (id.company?.trim() || id.title?.trim()) items.push("Title and company read correctly");
  items.push("Nothing from the original card's owner is still visible");
  return items;
}

// ── The FREE path: measure with vision, typeset ourselves ───────────────────
//
// Image GENERATION is a paid Google tier and the owner declined it, so the
// default pipeline is: a vision model (free tier) MEASURES the uploaded
// design — surfaces, positions, colors, sizes — and we render the owner's
// details at those measurements with Satori. The trade against generation:
// backgrounds are reconstructed (flat surfaces, panels, bars — not photo
// textures), but every letter is typeset by US, so a phone number can never
// come back misspelled. For "no mistakes", that is the better half to own.

import { ImageResponse } from "next/og";

export type FaceElementKind =
  | "name" | "title" | "company" | "phone" | "email" | "website" | "address"
  | "headshot" | "logo";

export type FaceElement = {
  kind: FaceElementKind;
  /** Percent of the card, 0–100; (x,y) is the element's top-left. */
  x: number; y: number; w: number; h: number;
  align: "left" | "center" | "right";
  color: string;
  weight: "normal" | "bold";
  size: "xs" | "sm" | "md" | "lg" | "xl";
  caps?: boolean;
  /** Circular crop (headshots). */
  round?: boolean;
};

export type FaceLayout = {
  background: string;
  panels: { x: number; y: number; w: number; h: number; color: string }[];
  serif?: boolean;
  elements: FaceElement[];
};

/** What the vision model is asked for. Measurements only — it never invents
 *  content, because the renderer only prints the owner's own values. */
export const PRECISE_SCAN_PROMPT = [
  "You are measuring a business card design so it can be rebuilt exactly.",
  "Report the design's GEOMETRY AND COLOURS. Do NOT transcribe any text values.",
  "",
  "Return ONLY valid JSON:",
  '{"background":"#rrggbb","serif":true|false,',
  ' "panels":[{"x":0,"y":0,"w":35,"h":100,"color":"#rrggbb"}],',
  ' "elements":[{"kind":"name","x":40,"y":18,"w":50,"h":10,"align":"left",',
  '   "color":"#rrggbb","weight":"bold","size":"xl","caps":false,"round":false}]}',
  "",
  "All x,y,w,h are PERCENT of the card (0-100), x,y = top-left corner.",
  "background = the card's base surface. panels = every OTHER solid surface:",
  "  colored bands, side panels, footer bars, accent stripes (thin bars are",
  "  panels with small h or w).",
  'elements: one entry per piece of content, kinds only from this list:',
  '  "name","title","company","phone","email","website","address" (text),',
  '  "headshot","logo" (images). Skip QR codes entirely. Skip icons.',
  'size = relative text prominence: "xl" the largest text, "xs" the smallest.',
  '"round": true when the photo/logo is displayed in a circle.',
  "Measure carefully — where things sit is the whole job. Omit what is not there.",
].join("\n");

const clamp = (v: unknown, lo: number, hi: number, fb: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fb;
  return Math.min(hi, Math.max(lo, n));
};
const hex = (v: unknown, fb: string): string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : fb;

const KINDS = new Set<FaceElementKind>(["name", "title", "company", "phone", "email", "website", "address", "headshot", "logo"]);

/** Model output → renderable layout. Whitelist + clamp everything; a hostile
 *  or confused reading can only produce a plain card, never bad values. */
export function faceLayoutFromScan(raw: unknown): FaceLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const panels = (Array.isArray(r.panels) ? r.panels : []).slice(0, 8).flatMap((p) => {
    if (!p || typeof p !== "object") return [];
    const q = p as Record<string, unknown>;
    return [{
      x: clamp(q.x, 0, 100, 0), y: clamp(q.y, 0, 100, 0),
      w: clamp(q.w, 0.5, 100, 10), h: clamp(q.h, 0.5, 100, 10),
      color: hex(q.color, "#e5e7eb"),
    }];
  });
  const seen = new Set<string>();
  const elements = (Array.isArray(r.elements) ? r.elements : []).slice(0, 16).flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const q = e as Record<string, unknown>;
    const kind = typeof q.kind === "string" ? (q.kind.toLowerCase() as FaceElementKind) : null;
    if (!kind || !KINDS.has(kind) || seen.has(kind)) return [];
    seen.add(kind);
    return [{
      kind,
      x: clamp(q.x, 0, 96, 5), y: clamp(q.y, 0, 96, 5),
      w: clamp(q.w, 2, 100, 40), h: clamp(q.h, 2, 100, 10),
      align: (q.align === "center" || q.align === "right" ? q.align : "left") as FaceElement["align"],
      color: hex(q.color, "#111827"),
      weight: q.weight === "normal" ? "normal" as const : "bold" as const,
      size: (["xs", "sm", "md", "lg", "xl"] as const).includes(q.size as never) ? (q.size as FaceElement["size"]) : "md",
      caps: q.caps === true,
      round: q.round === true,
    }];
  });
  const background = hex(r.background, "#ffffff");
  if (!elements.some((e) => e.kind === "name")) {
    // A reading without a name slot was REJECTED at first — and that killed
    // real, otherwise-good readings in production (the model sometimes labels
    // the big text something else, or the elements list truncates). The name
    // is the one thing we can always place sensibly ourselves: right of the
    // widest full-height side panel, dark-on-light or light-on-dark.
    const side = panels
      .filter((p) => p.x <= 2 && p.h >= 80 && p.w < 60)
      .reduce((m, p) => Math.max(m, p.x + p.w), 0);
    const n = parseInt(background.slice(1), 16);
    const lum = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + ((n & 255) * 114)) / 1000;
    elements.unshift({
      kind: "name", x: Math.min(side + 5, 60), y: 14, w: Math.max(30, 90 - side), h: 12,
      align: "left", color: lum < 128 ? "#ffffff" : "#111827", weight: "bold", size: "xl",
      caps: false, round: false,
    });
  }
  return { background, panels, serif: r.serif === true, elements };
}

// Design px on the 1400×800 canvas, by prominence tier. Measured against
// printed-card conventions (name ≈ 2-3× body size).
const FACE_PX: Record<FaceElement["size"], number> = { xs: 26, sm: 32, md: 42, lg: 58, xl: 84 };

/** Typeset the owner's details onto the measured layout. 1400×800 (1.75:1). */
export async function renderFaceImage(
  layout: FaceLayout,
  id: TransferIdentity,
  images: { headshot?: string | null; logo?: string | null },
): Promise<Buffer> {
  const W = 1400, H = 800;
  const value = (k: FaceElementKind): string | null => {
    switch (k) {
      case "name": return id.name || null;
      case "title": return id.title?.trim() || null;
      case "company": return id.company?.trim() || null;
      case "phone": return id.phone?.trim() || null;
      case "email": return id.email?.trim() || null;
      case "website": return id.website?.trim() || null;
      case "address": return id.address?.trim() || null;
      default: return null;
    }
  };
  const res = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: layout.background, fontFamily: "sans-serif" }}>
        {layout.panels.map((p, i) => (
          <div key={`p${i}`} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, background: p.color, display: "flex" }} />
        ))}
        {layout.elements.map((e, i) => {
          if (e.kind === "headshot" || e.kind === "logo") {
            const src = e.kind === "headshot" ? images.headshot : images.logo;
            if (!src) return null;
            const px = (e.w / 100) * W, py = (e.h / 100) * H;
            return (
              // eslint-disable-next-line @next/next/no-img-element -- Satori element
              <img key={`e${i}`} src={src} width={Math.round(px)} height={Math.round(py)}
                style={{ position: "absolute", left: `${e.x}%`, top: `${e.y}%`, objectFit: e.kind === "logo" ? "contain" : "cover", borderRadius: e.round ? 9999 : 12 }} />
            );
          }
          const text = value(e.kind);
          if (!text) return null;
          return (
            <div key={`e${i}`} style={{
              position: "absolute", left: `${e.x}%`, top: `${e.y}%`, width: `${e.w}%`, minHeight: `${e.h}%`,
              display: "flex", alignItems: "center",
              justifyContent: e.align === "center" ? "center" : e.align === "right" ? "flex-end" : "flex-start",
              fontSize: FACE_PX[e.size], fontWeight: e.weight === "bold" ? 700 : 400, color: e.color,
              textTransform: e.caps ? "uppercase" : "none", lineHeight: 1.15,
              letterSpacing: e.caps ? 2 : 0,
            }}>
              {text}
            </div>
          );
        })}
      </div>
    ),
    { width: W, height: H },
  );
  return Buffer.from(await res.arrayBuffer());
}
