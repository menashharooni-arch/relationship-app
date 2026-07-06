import QRCode from "qrcode";
import type { ReactElement } from "react";

export type CardLink = {
  emoji: string;
  label: string;
  url: string;
};

export type CardTestimonial = {
  name: string;
  text: string;
};

export type CustomElementType = "field" | "text" | "logo" | "headshot" | "socials" | "social" | "qr" | "divider";
export type CustomField = "name" | "title" | "company" | "phone" | "email" | "website" | "address" | "fax";
export type CustomSocial = "instagram" | "linkedin" | "twitter" | "tiktok" | "snapchat" | "youtube" | "facebook";

export type CustomElement = {
  id: string;
  type: CustomElementType;
  field?: CustomField;   // for type "field"
  text?: string;         // for type "text"
  social?: CustomSocial; // for type "social" (one platform: icon + handle)
  x: number;             // left, % of card width (0-100)
  y: number;             // top, % of card height (0-100)
  fontSize?: number;     // px (text/field/socials/social)
  color?: string;        // overrides layout text color
  bold?: boolean;        // text/field
  italic?: boolean;      // text/field
  size?: number;         // px (logo/headshot/qr)
  width?: number;        // px (divider)
};

export type CustomLayout = {
  background: string;
  fontFamily: string;
  textColor: string;
  elements: CustomElement[];
};

export type CardAddress = {
  street?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export type PhoneLabel = "mobile" | "office";

export type CardPhone = {
  number: string;
  label: PhoneLabel;
  showOnCard: boolean;
};

export type CardCustomization = {
  accentColor?: string;
  font?: string;
  snapchat?: string;
  about?: string;
  address?: CardAddress;
  links?: CardLink[];
  testimonials?: CardTestimonial[];
  customLayout?: CustomLayout;
  phones?: CardPhone[];
  fax?: string;
};

export type CardData = {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website?: string;
  address?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  tiktok?: string;
  snapchat?: string;
  about?: string;
  initials?: string;
  photoUrl?: string | null;
  logoUrl?: string | null;
  cardUrl?: string;
  customization?: CardCustomization;
};

// Socials are shown in the "Swift Links" section, not on the card design itself.
// Strip them from the data given to the standard templates.
export function withoutSocials(data: CardData): CardData {
  return { ...data, instagram: "", twitter: "", tiktok: "", linkedin: "", snapchat: "" };
}

export const SAMPLE_DATA: CardData = {
  name: "Alex Morgan",
  title: "Founder & CEO",
  company: "Morgan & Co.",
  phone: "(555) 123-4567",
  email: "alex@morganandco.com",
  website: "www.morganandco.com",
  address: "123 Main Street, New York, NY",
  instagram: "@morganandco",
  twitter: "@alexmorgan",
  tiktok: "@morganandco",
  linkedin: "linkedin.com/in/alexmorgan",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};

// A REAL, scannable QR of the card's URL. The module matrix is computed
// synchronously (QRCode.create) with NO React hooks, so this stays safe to
// server-render inside the card templates. Dark runs are merged per row to keep
// the node count low. Falls back to swiftcard.me if no URL is supplied.
export function MiniQR({ size = 52, bg = "#ffffff", fg = "#111827", url }: { size?: number; bg?: string; fg?: string; url?: string }) {
  const p = size * 0.055;
  const raw = (url ?? "").trim();
  const target = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : "https://swiftcard.me";

  let count = 0;
  const rects: ReactElement[] = [];
  try {
    const qr = QRCode.create(target, { errorCorrectionLevel: "M" });
    count = qr.modules.size;
    const cells = qr.modules.data; // Uint8Array, 1 = dark module
    for (let r = 0; r < count; r++) {
      let c = 0;
      while (c < count) {
        if (cells[r * count + c]) {
          let w = 1;
          while (c + w < count && cells[r * count + (c + w)]) w++;
          rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={w} height={1} fill={fg} />);
          c += w;
        } else {
          c++;
        }
      }
    }
  } catch {
    count = 0;
  }

  return (
    <div data-qr="1" style={{ width: size, height: size, background: bg, padding: p, borderRadius: size * 0.1, flexShrink: 0 }}>
      {count > 0 && (
        <svg viewBox={`0 0 ${count} ${count}`} shapeRendering="crispEdges" style={{ width: "100%", height: "100%", display: "block" }}>
          {rects}
        </svg>
      )}
    </div>
  );
}
