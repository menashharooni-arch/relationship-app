import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Public marketing/informational pages only — authenticated app routes
// (dashboard, contacts, admin, settings, etc.) are excluded here and blocked
// in robots.ts, since there's nothing for search engines to index there.
// The nine /products/[slug] pages, which are statically generated and linked
// from the main nav and footer. Kept in sync by hand with the PRODUCTS map in
// src/app/products/[slug]/page.tsx (a page file can't safely export it).
// The /for/[slug] vertical landing pages — kept in sync by hand with
// FOR_VERTICALS in src/app/for/[slug]/page.tsx.
const FOR_SLUGS = [
  "real-estate-agents",
  "contractors",
  "insurance-agents",
  "loan-officers",
  "lawyers",
  "photographers",
  "barbers-and-stylists",
  "car-salespeople",
];

// /compare/[slug] competitor-alternative pages — kept in sync by hand with
// COMPETITORS in src/app/compare/[slug]/page.tsx.
const COMPARE_SLUGS = [
  "linktree-alternative",
  "popl-alternative",
  "blinq-alternative",
  "hihello-alternative",
];

const PRODUCT_SLUGS = [
  "digital-cards",
  "swiftlinks",
  "email-signatures",
  "lead-capture",
  "analytics",
  "teams",
  "wallet",
  "watch",
  "integrations",
];

export default function sitemap(): MetadataRoute.Sitemap {
  // /templates IS public (the earlier note here claimed the opposite — it is not
  // in the src/proxy.ts matcher and anonymous visitors can load it). It's linked
  // from the main nav and footer, so it belongs in the sitemap and is no longer
  // disallowed in robots.ts.
  const routes = [
    "", "/pricing", "/compare", "/contact", "/privacy", "/terms", "/company",
    "/sms-terms", "/sms-consent", "/login", "/templates", "/testimonials",
    ...PRODUCT_SLUGS.map((s) => `/products/${s}`),
    ...FOR_SLUGS.map((s) => `/for/${s}`),
    ...COMPARE_SLUGS.map((s) => `/compare/${s}`),
  ];
  return routes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.6,
  }));
}
