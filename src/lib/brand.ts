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
const ALTERNATE_NAMES = ["Swift Card", "swiftcard.me"];

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
export function jsonLdScript(node: unknown): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}
