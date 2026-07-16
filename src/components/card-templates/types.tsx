export type CardLink = {
  emoji?: string; // legacy — new links have no emoji (picker removed)
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
  // ── Preset-template style overrides (Pro) ──────────────────────────────────
  // Optional. When absent, each template falls back to its own baked-in design,
  // so cards saved before these existed render exactly as before.
  bgColor?: string;      // primary branding surface (navy panel, dark bg, stripe…)
  textColor?: string;    // hero/name text color
  fontFamily?: string;   // card typography (a full CSS font stack)
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

// MiniQR moved to ./MiniQR.tsx — this module is value-imported by ~30 files
// including several client homepage components, so it must stay free of the
// `qrcode` encoder (performance audit).
