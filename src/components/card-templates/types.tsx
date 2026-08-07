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

// ── Block layout (the current custom designer) ──────────────────────────────
// Blocks FLOW inside zones instead of floating at x/y. That is the whole reason
// a custom card can no longer overlap, clip a value, or drift between the editor
// and the published card: there is no arrangement that produces those, because
// nothing is positioned absolutely. Size comes from `emphasis`, never from a
// number the owner types, so it stays proportional to the card at any width.
export type CardZone = "left" | "right";
export type CardEmphasis = "hero" | "normal" | "quiet";
/** How the two zones sit relative to each other. */
export type CardSkeleton = "split" | "mirror" | "stacked";

export type CustomBlock = {
  id: string;
  type: CustomElementType;
  field?: CustomField;   // type "field"
  social?: CustomSocial; // type "social"
  text?: string;         // type "text"
  /** Off blocks stay in the list so turning one back on restores it in place. */
  on: boolean;
  zone: CardZone;
  emphasis: CardEmphasis;
  color?: string;
};

export type CustomLayout = {
  background: string;
  fontFamily: string;
  textColor: string;
  /** Icons, job title, hairlines. */
  accentColor?: string;
  skeleton?: CardSkeleton;
  /** Present on every layout built by the current designer. */
  blocks?: CustomBlock[];
  /**
   * LEGACY absolute-positioned elements. Kept so a card saved by the old
   * designer still renders exactly as its owner left it; nothing new writes it.
   */
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
  // Socials that live ONLY here, with no top-level CardData field: the save
  // writes them into customization and CustomCard reads them back out of it.
  // They were missing from this type, so CustomCard had to reach them through
  // a cast — which in turn hid them from the card builders, whose previewData
  // is typed as CardData. Result: the Custom template's live preview dropped
  // both icons while the saved card showed them. Declared here so the compiler
  // keeps preview and card in agreement.
  snapchat?: string;
  facebook?: string;
  youtube?: string;
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
  title: "Realtor®",
  company: "Coastline Realty",
  phone: "(415) 555-0188",
  email: "alex@coastlinerealty.com",
  website: "coastlinehomes.com",
  address: "1200 Ocean Ave, San Francisco, CA 94122",
  instagram: "@coastlinerealty",
  twitter: "@alexmorgan",
  tiktok: "@coastlinerealty",
  linkedin: "linkedin.com/in/alexmorgan",
  initials: "AM",
  photoUrl: null,
  logoUrl: null,
  cardUrl: "swiftcard.me/card/alexmorgan",
};

// The one demo headshot used across the marketing site. Deliberately NOT on
// SAMPLE_DATA: that object is spread into real users' live previews (see
// OnboardingForm), and inheriting a stock face there would show a signed-in
// person a stranger's photo on their own card.
export const DEMO_HEADSHOT = "/marketing/demo-girl.jpg";

// SAMPLE_DATA for marketing surfaces, where the demo person SHOULD have a face
// — notably Photo First, which is nothing but the photo.
export const SAMPLE_DATA_WITH_PHOTO: CardData = { ...SAMPLE_DATA, photoUrl: DEMO_HEADSHOT };

// MiniQR moved to ./MiniQR.tsx — this module is value-imported by ~30 files
// including several client homepage components, so it must stay free of the
// `qrcode` encoder (performance audit).
