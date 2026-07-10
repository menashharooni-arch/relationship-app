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
        "/templates",
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
