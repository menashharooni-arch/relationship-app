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
        // Public card pages and Swift Links pages open in the app when
        // installed. /auth/callback is the return leg of the native login
        // flow: the system-browser OAuth round-trip ends there, the universal
        // link re-opens the app, and NativeAppBridge navigates the webview to
        // finish the PKCE exchange.
        paths: ["/card/*", "/links/*", "/auth/callback"],
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
