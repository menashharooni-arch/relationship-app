import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// Public marketing/informational pages only — authenticated app routes
// (dashboard, contacts, admin, settings, etc.) are excluded here and blocked
// in robots.ts, since there's nothing for search engines to index there.
export default function sitemap(): MetadataRoute.Sitemap {
  // NOTE: /templates is NOT public — it's an authenticated "choose your card
  // template" page gated by src/proxy.ts, redirecting anonymous visitors to
  // /login. Do not add it back here without also removing it from that gate.
  const routes = ["", "/pricing", "/compare", "/contact", "/privacy", "/login"];
  return routes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.6,
  }));
}
