// Brand identity for search engines — one source of truth for the schema.org
// nodes we emit. Both the root layout (site-wide) and /company rendered their
// own near-identical Organization literal; they drifted (different description,
// neither carried alternateName or sameAs), and two conflicting Organization
// nodes for one domain is exactly what confuses Google's brand box.
//
// Only VERIFIABLE facts belong here. Inventing a profile URL or a rating is a
// structured-data violation and can cost the brand box entirely.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Official profiles that belong to Swift Card Inc, for schema.org `sameAs`.
// This is the field Google uses to tie scattered profiles to ONE entity, which
// is what makes a knowledge panel appear and what lets us claim it later — so
// every new official profile (X, Instagram, Crunchbase, the App Store listing)
// should be appended here the day it goes live.
//
// EMPTY IS DELIBERATE, NOT UNFINISHED: a `sameAs` pointing at a page we do not
// control, or one that does not link back to swiftcard.me, is worse than none.
// Add a URL only once the profile is live, uses the SwiftCard name and logo,
// and links back to this domain.
export const BRAND_PROFILES: string[] = [];

// "SwiftCard" is one word, but people type it as two, and the domain is a third
// spelling. Listing them lets Google resolve all three to the same entity
// instead of treating "Swift Card" as a different (or generic) query.
const ALTERNATE_NAMES = ["Swift Card", "swiftcard.me", "swift card app", "SwiftCard app"];

const DESCRIPTION =
  "SwiftCard is a digital business card that shares itself — build your card once and share it by tap, QR code, Apple Wallet, or link, with built-in lead capture and automatic follow-up.";

export const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  // A stable @id so every page's node is understood as the SAME organization
  // rather than one more company that happens to share a name.
  "@id": `${APP_URL}/#organization`,
  name: "SwiftCard",
  alternateName: ALTERNATE_NAMES,
  legalName: "Swift Card Inc",
  url: APP_URL,
  logo: `${APP_URL}/brand-icon.png`,
  description: DESCRIPTION,
  founder: { "@type": "Person", name: "Menash Harooni", jobTitle: "Founder & Authorized Representative" },
  email: "hello@swiftcard.me",
  foundingLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" } },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "hello@swiftcard.me", url: `${APP_URL}/contact` },
  // Omitted entirely while there is nothing to list — `sameAs: []` is a claim
  // that the brand has no profiles anywhere.
  ...(BRAND_PROFILES.length ? { sameAs: BRAND_PROFILES } : {}),
};

// The WebSite node is what Google reads for the SITE NAME shown above the URL
// in results. Without it the name is guessed from the <title>, which is how a
// result ends up labelled with the whole tagline instead of "SwiftCard".
export const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${APP_URL}/#website`,
  name: "SwiftCard",
  alternateName: ALTERNATE_NAMES,
  url: APP_URL,
  description: DESCRIPTION,
  publisher: { "@id": `${APP_URL}/#organization` },
};

// Serialize for a <script type="application/ld+json"> block. The `<` escape is
// what keeps this safe the day someone interpolates a card or company name into
// a node: inside <script>, the literal sequence "</script>" in ANY string value
// closes the tag early and everything after it parses as markup.
// The homepage's SoftwareApplication node — the product itself, distinct from
// the Organization that makes it. Only verifiable facts: the Free plan is real
// (a $0 entry price), and the app runs on iOS and the web. NO aggregateRating —
// there is no eligible review source, and inventing one is a structured-data
// violation that can cost every rich result on the domain.
export const SOFTWARE_APPLICATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${APP_URL}/#software`,
  name: "SwiftCard",
  alternateName: ALTERNATE_NAMES,
  url: APP_URL,
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "iOS, Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free plan; Pro subscription available." },
  publisher: { "@id": `${APP_URL}/#organization` },
};

// Person + ProfilePage nodes for a PUBLIC card or Swift Links page — the
// mainEntity Person is what makes these pages eligible for profile-style
// treatment in search. `sameAs` keeps only full http(s) URLs the owner put on
// their own card; handles and empty strings are dropped, nothing is invented.
export function profilePageJsonLd(p: {
  name: string;
  title?: string;
  company?: string;
  image?: string;
  url: string;
  sameAs?: (string | undefined | null)[];
}) {
  const sameAs = (p.sameAs ?? []).filter((u): u is string => !!u && /^https?:\/\//i.test(u));
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${p.url}#profile`,
    url: p.url,
    mainEntity: {
      "@type": "Person",
      name: p.name,
      ...(p.title ? { jobTitle: p.title } : {}),
      ...(p.company ? { worksFor: { "@type": "Organization", name: p.company } } : {}),
      ...(p.image ? { image: p.image } : {}),
      url: p.url,
      ...(sameAs.length ? { sameAs } : {}),
    },
  };
}

export function jsonLdScript(node: unknown): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}
