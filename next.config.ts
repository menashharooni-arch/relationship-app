import type { NextConfig } from "next";

// Security headers applied to every response. Deliberately conservative so
// nothing legitimate breaks:
//  - HSTS forces HTTPS (the site is HTTPS-only on Vercel already).
//  - X-Frame-Options + CSP frame-ancestors block clickjacking — no other site
//    can iframe SwiftCard (e.g. overlaying a fake "Save Contact" on a public
//    card page). `frame-ancestors 'self'` is the ONLY CSP directive set, so it
//    can't break script/style/third-party loading (Stripe, Google, Supabase).
//  - nosniff stops MIME-type confusion attacks.
//  - Referrer-Policy trims what we leak to outbound links.
//  - Permissions-Policy allows same-origin camera (the card scanner needs it)
//    and geolocation, disables microphone, and opts out of the Topics API.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Canonicalize the domain: send www.swiftcard.me → apex so search engines
      // don't index two copies of every page. 308 keeps the method + is cached.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.swiftcard.me" }],
        destination: "https://swiftcard.me/:path*",
        permanent: true,
      },
      // /signup is the most-guessed URL for a product like this; land it on the
      // real card-creation flow instead of a 404.
      {
        source: "/signup",
        destination: "/cards/new",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
