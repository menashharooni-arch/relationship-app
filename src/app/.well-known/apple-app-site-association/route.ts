// Apple App Site Association (AASA) — served at the exact path
// /.well-known/apple-app-site-association with a JSON content-type and no
// redirect, which is what Apple's Universal Links CDN fetches. A Route Handler
// is used (rather than a static file in /public) so the content-type is
// application/json and the path can be served without a file extension.
//
// This is the web-servable half of Universal Links (Part 0). The matching
// native entitlement (applinks:swiftcard.me) and the real Apple Team ID are
// owner/Xcode actions tracked separately.
//
// ⚠️ TEAMID_PLACEHOLDER MUST be replaced with the real Apple Developer Team ID
// (a 10-char string like "ABCDE12345") once the site owner has it, giving an
// appID of "<TEAMID>.me.swiftcard.app". Universal Links will NOT work until the
// real Team ID is in place here AND the app ships with the matching entitlement.

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "TEAMID_PLACEHOLDER.me.swiftcard.app",
        // Public card pages, Swift Links pages, and Office invite links open
        // in the app when installed. /auth/callback is kept as a safety net
        // for any web-initiated OAuth round-trip that lands on a device with
        // the app installed — the primary native OAuth return leg is the
        // swiftcard://auth-callback custom scheme (see src/lib/native-auth.ts
        // + NativeAppBridge), not this universal link.
        paths: ["/card/*", "/links/*", "/join/*", "/auth/callback"],
      },
    ],
  },
};

export async function GET() {
  return new Response(JSON.stringify(AASA), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Apple caches this; a modest cache is fine and avoids staleness when the
      // real Team ID lands.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
