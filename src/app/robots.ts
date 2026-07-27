import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/contacts",
        "/admin",
        "/settings",
        "/onboarding",
        "/profile",
        // NOT /templates — it's a PUBLIC marketing gallery linked from the main
        // nav and footer (it isn't in the src/proxy.ts auth matcher), so blocking
        // it here was hiding an indexable page from search.
        "/cards",
        "/office",
        "/api",
        "/auth",
        "/join",
        "/account-deleted",
        "/r",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
