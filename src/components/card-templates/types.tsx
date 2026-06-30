import { useContext } from "react";
import { HideQRContext } from "./qr-context";

export type CardLink = {
  emoji: string;
  label: string;
  url: string;
};

export type CardTestimonial = {
  name: string;
  text: string;
};

export type CustomElementType = "field" | "text" | "logo" | "headshot" | "socials";
export type CustomField = "name" | "title" | "company" | "phone" | "email" | "website";

export type CustomElement = {
  id: string;
  type: CustomElementType;
  field?: CustomField;   // for type "field"
  text?: string;         // for type "text"
  x: number;             // left, % of card width (0-100)
  y: number;             // top, % of card height (0-100)
  fontSize?: number;     // px (text/field/socials)
  color?: string;        // overrides layout text color
  bold?: boolean;        // text/field
  size?: number;         // px (logo/headshot)
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

export function MiniQR({ size = 52, bg = "#ffffff", fg = "#111827" }: { size?: number; bg?: string; fg?: string }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (useContext(HideQRContext)) return null;
  const p = size * 0.055;
  return (
    <div style={{ width: size, height: size, background: bg, padding: p, borderRadius: size * 0.1, flexShrink: 0 }}>
      <svg viewBox="0 0 21 21" style={{ width: "100%", height: "100%", display: "block" }}>
        {/* Finder top-left */}
        <rect x="0" y="0" width="7" height="7" fill={fg} />
        <rect x="1" y="1" width="5" height="5" fill={bg} />
        <rect x="2" y="2" width="3" height="3" fill={fg} />
        {/* Finder top-right */}
        <rect x="14" y="0" width="7" height="7" fill={fg} />
        <rect x="15" y="1" width="5" height="5" fill={bg} />
        <rect x="16" y="2" width="3" height="3" fill={fg} />
        {/* Finder bottom-left */}
        <rect x="0" y="14" width="7" height="7" fill={fg} />
        <rect x="1" y="15" width="5" height="5" fill={bg} />
        <rect x="2" y="16" width="3" height="3" fill={fg} />
        {/* Data modules */}
        <rect x="8" y="0" width="1" height="1" fill={fg} />
        <rect x="10" y="0" width="1" height="1" fill={fg} />
        <rect x="12" y="1" width="1" height="1" fill={fg} />
        <rect x="9" y="2" width="2" height="1" fill={fg} />
        <rect x="8" y="4" width="1" height="1" fill={fg} />
        <rect x="11" y="3" width="2" height="1" fill={fg} />
        <rect x="8" y="6" width="3" height="1" fill={fg} />
        <rect x="9" y="8" width="2" height="1" fill={fg} />
        <rect x="7" y="7" width="1" height="2" fill={fg} />
        <rect x="11" y="8" width="1" height="1" fill={fg} />
        <rect x="7" y="10" width="2" height="1" fill={fg} />
        <rect x="10" y="9" width="1" height="2" fill={fg} />
        <rect x="12" y="10" width="1" height="1" fill={fg} />
        <rect x="7" y="12" width="1" height="1" fill={fg} />
        <rect x="9" y="11" width="1" height="2" fill={fg} />
        <rect x="11" y="12" width="2" height="1" fill={fg} />
        <rect x="8" y="14" width="2" height="1" fill={fg} />
        <rect x="10" y="13" width="1" height="1" fill={fg} />
        <rect x="12" y="13" width="1" height="2" fill={fg} />
        <rect x="8" y="16" width="1" height="2" fill={fg} />
        <rect x="10" y="16" width="1" height="1" fill={fg} />
        <rect x="11" y="17" width="2" height="2" fill={fg} />
        <rect x="14" y="7" width="1" height="2" fill={fg} />
        <rect x="16" y="7" width="1" height="1" fill={fg} />
        <rect x="18" y="8" width="2" height="1" fill={fg} />
        <rect x="14" y="10" width="2" height="1" fill={fg} />
        <rect x="17" y="9" width="1" height="2" fill={fg} />
        <rect x="19" y="10" width="1" height="1" fill={fg} />
        <rect x="15" y="12" width="1" height="1" fill={fg} />
        <rect x="17" y="11" width="2" height="1" fill={fg} />
        <rect x="14" y="13" width="1" height="2" fill={fg} />
        <rect x="16" y="14" width="1" height="1" fill={fg} />
        <rect x="18" y="13" width="2" height="1" fill={fg} />
        <rect x="15" y="16" width="2" height="1" fill={fg} />
        <rect x="19" y="15" width="1" height="2" fill={fg} />
        <rect x="14" y="18" width="1" height="2" fill={fg} />
        <rect x="16" y="18" width="2" height="1" fill={fg} />
        <rect x="19" y="18" width="1" height="1" fill={fg} />
        <rect x="0" y="8" width="1" height="1" fill={fg} />
        <rect x="2" y="8" width="2" height="1" fill={fg} />
        <rect x="5" y="7" width="1" height="2" fill={fg} />
        <rect x="0" y="10" width="3" height="1" fill={fg} />
        <rect x="4" y="9" width="1" height="2" fill={fg} />
        <rect x="1" y="12" width="1" height="1" fill={fg} />
        <rect x="3" y="11" width="1" height="2" fill={fg} />
        <rect x="5" y="11" width="1" height="1" fill={fg} />
        <rect x="0" y="13" width="2" height="1" fill={fg} />
        <rect x="4" y="13" width="1" height="1" fill={fg} />
      </svg>
    </div>
  );
}
