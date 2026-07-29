import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

// ── Sentry build integration (monitoring only) ───────────────────────────────
//
// Wraps the config above WITHOUT altering it: every header and redirect is
// unchanged. All this adds is build-time source-map handling so a minified
// production stack trace maps back to real source.
//
// The build must never fail because monitoring isn't configured. Source-map
// upload needs SENTRY_AUTH_TOKEN, which only exists on Vercel — so it's gated on
// the token being present. Without it (local builds, forks, CI) the wrapper is a
// pass-through and `next build` behaves exactly as before.
const uploadSourceMaps = !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Don't turn the build log into noise; errors still surface.
  silent: true,
  telemetry: false,

  // Skip the upload step entirely when unconfigured, rather than letting the
  // plugin try and warn on every single build.
  sourcemaps: { disable: !uploadSourceMaps },

  // Source maps are uploaded to Sentry, then deleted from the deployed output so
  // they are never publicly served — readable traces for us, not for everyone.
  widenClientFileUpload: true,

  // Tree-shake the SDK's own debug logger out of the client bundle.
  disableLogger: true,
});
