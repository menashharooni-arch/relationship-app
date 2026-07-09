// Shared design tokens, icons, and utilities for all card templates

import type { CardData } from "./types";

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw;
}

export type ShownPhone = { number: string; label: string };

// Phone numbers to display on the card: the ones flagged showOnCard, falling
// back to the legacy single `phone` field for cards saved before multi-phone.
export function cardPhones(data: CardData): ShownPhone[] {
  const phones = data.customization?.phones;
  if (Array.isArray(phones) && phones.length) {
    return phones
      .filter((p) => p?.showOnCard && p.number?.trim())
      .map((p) => ({ number: p.number, label: p.label || "" }));
  }
  return data.phone ? [{ number: data.phone, label: "" }] : [];
}

// Fax number (card-only).
export function cardFax(data: CardData): string {
  return data.customization?.fax?.trim() || "";
}

export function capLabel(label: string): string {
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

// Absolute URL for the card's website value (handles bare domains like "swiftcard.me").
export function webHref(site: string): string {
  const s = (site || "").trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
}

// ─── Auto-fit system ─────────────────────────────────────────────────────────
// Cards hold a variable amount of info (multiple phones, fax, address lines…).
// All templates size their contact block from ONE density factor so everything
// always fits — more rows → slightly smaller text and tighter rows — without
// ever cutting off the QR code or any wording. Pure functions of the card data,
// so templates stay server-renderable (no hooks — see card page requirement).

// Weighted count of contact rows on the card.
export function contactRowCount(data: CardData): number {
  const addrLines = data.address ? data.address.split("\n").filter(Boolean).length : 0;
  return (
    cardPhones(data).length +
    (data.email ? 1 : 0) +
    (data.website ? 0.9 : 0) +
    (cardFax(data) ? 0.9 : 0) +
    addrLines * 0.7
  );
}

// Density factor — the card always uses its FULL space:
//   sparse card (≤2 rows)  → up to 1.18: text, logo and QR grow into the room
//   normal (4 rows)        → 1
//   packed                 → eases down to 0.7 so nothing is ever cut off
export function fitFactor(data: CardData): number {
  const rows = contactRowCount(data);
  if (rows <= 4) return Math.min(1.18, 1 + (4 - rows) * 0.09);
  return Math.max(0.7, 1 - (rows - 4) * 0.075);
}

// Cap used for HERO text (names/companies) — they grow with sparseness but a
// touch less than rows so the layout stays balanced.
export function heroGrow(f: number): number {
  return Math.min(f, 1.14);
}

// Logo sizing that adapts to the logo's OWN shape without any JS measurement:
// height is fixed (scaled by density), width is auto — so a square logo renders
// height×height while a banner/wordmark logo naturally takes more width.
// object-contain guarantees nothing is ever cropped.
//
// CRITICAL: when the logo shares its row with the company name, maxWidth must
// be a PERCENTAGE of the row — a px cap ≥ the row width would squeeze the text
// to zero and wrap it letter-by-letter down past the card's bottom edge.
export function logoStyle(f: number, base: number, extra?: React.CSSProperties): React.CSSProperties {
  const h = Math.round(base * Math.min(Math.max(f, 0.85), 1.3));
  return {
    height: h,
    width: "auto",
    // Default assumes a text sibling: banner logos get at most half the row.
    maxWidth: "48%",
    objectFit: "contain",
    flexShrink: 0,
    ...extra,
  };
}

// Shrink one long value (a long email, name, or company) so it never truncates
// or wraps. Exact-fit curve: beyond the comfy length, font size scales inversely
// with length, so rendered width stays constant — a 40-char email occupies the
// same line width a 24-char one does, just smaller. (The old 0.6-power curve
// under-shrank long values, which is why long emails used to wrap to a second
// line.) Floor at 45% keeps pathological inputs legible.
export function fitPx(base: number, text: string | null | undefined, comfy: number): number {
  const len = (text ?? "").trim().length;
  if (len <= comfy) return base;
  return Math.max(base * 0.45, (base * comfy) / len);
}

// QR stays on the card at every density — it grows on sparse cards (more
// scannable from further away) and gives up a little room when packed.
export function qrSize(f: number): number {
  return f >= 1.12 ? 74 : f >= 1 ? 66 : f >= 0.85 ? 60 : 54;
}

// Last-resort safety valve: past the point where shrinking text can absorb the
// info, the card itself gets slightly taller (smaller width:height ratio) so
// nothing is EVER cut off — not the QR, not a single row. Stacked layouts
// (header on top, e.g. LocalBusiness) have less vertical room for contacts,
// so they pass a lower threshold to start growing earlier.
export function cardAspect(data: CardData, threshold = 8): string {
  const rows = contactRowCount(data);
  if (rows <= threshold) return "1.75 / 1";
  const ratio = Math.max(1.35, 1.75 - (rows - threshold) * 0.06);
  return `${ratio.toFixed(3)} / 1`;
}

// ─── Shared contact block ────────────────────────────────────────────────────
// One renderer for the contact rows on EVERY template, so the type hierarchy is
// identical and even across designs: phone (largest, bold) → email → website →
// fax → address (smallest). Templates keep their character via the palette.

export type RowPalette = {
  accent?: string;      // icon color; omit to have icons inherit each row's text color
  strong: string;       // phone numbers
  mid: string;          // email
  soft: string;         // website + fax
  muted: string;        // address
  phoneWeight?: number; // default 700; refined templates can use 600
};

export function ContactRows({ data, palette, f }: { data: CardData; palette: RowPalette; f: number }) {
  const ic = (rowColor: string) => ({ color: palette.accent ?? rowColor });
  const gap = Math.round(5 * f);
  // Email/website grow a bit less than the rest (capped at 1.1) and shrink on a
  // tighter budget — sized for the narrowest contact panel (ModernBold) so a
  // grown email can never poke past the card edge.
  const rowGrow = Math.min(f, 1.1);
  const emailSize = fitPx(13 * rowGrow, data.email, 22);
  const webSize = fitPx(11.5 * rowGrow, data.website, 24);
  return (
    <div className="flex flex-col" style={{ gap }}>
      {cardPhones(data).map((p, i) => (
        <a key={`ph${i}`} href={`tel:${p.number}`} className="flex items-center gap-2" style={{ color: palette.strong, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.strong)}><IcoPhone /></span>
          <span style={{ fontSize: 14.5 * f, fontWeight: palette.phoneWeight ?? 700, whiteSpace: "nowrap" }}>
            {formatPhone(p.number)}
            {p.label && <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 5, fontSize: 9 * f, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</span>}
          </span>
        </a>
      ))}
      {/* Email + website stay on ONE line always: fitPx guarantees the width
          and nowrap forbids the mid-address line break that used to appear. */}
      {data.email && (
        <a href={`mailto:${data.email}`} className="flex items-center gap-2 min-w-0" style={{ color: palette.mid, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.mid)}><IcoMail /></span>
          <span style={{ fontSize: emailSize, fontWeight: 600, whiteSpace: "nowrap" }}>{data.email}</span>
        </a>
      )}
      {data.website && (
        <a href={webHref(data.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0" style={{ color: palette.soft, textDecoration: "none" }}>
          <span className="shrink-0" style={ic(palette.soft)}><IcoGlobe /></span>
          <span style={{ fontSize: webSize, fontWeight: 500, whiteSpace: "nowrap" }}>{data.website}</span>
        </a>
      )}
      {cardFax(data) && (
        <div className="flex items-center gap-2" style={{ color: palette.soft }}>
          <span className="shrink-0" style={ic(palette.soft)}><IcoPhone /></span>
          <span style={{ fontSize: 11 * f, fontWeight: 500 }}>
            {formatPhone(cardFax(data))}
            <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 8.5 * f, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fax</span>
          </span>
        </div>
      )}
      {data.address && (
        <div className="flex items-start gap-2" style={{ color: palette.muted }}>
          <span className="shrink-0" style={{ ...ic(palette.muted), marginTop: 1 }}><IcoPin /></span>
          <span style={{ fontSize: 10.5 * f, lineHeight: 1.3, whiteSpace: "pre-line" }}>{data.address}</span>
        </div>
      )}
    </div>
  );
}

// ─── Contact Icons (stroke style) ────────────────────────────────────────────

export const IcoPhone = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

export const IcoMail = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
  </svg>
);

export const IcoGlobe = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
  </svg>
);

export const IcoPin = () => (
  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

// ─── Social Icons (fill style) ────────────────────────────────────────────────

export const IcoLinkedIn = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const IcoInsta = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

export const IcoX = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const IcoTikTok = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.16 8.16 0 004.77 1.52V6.83a4.85 4.85 0 01-1-.14z" />
  </svg>
);
