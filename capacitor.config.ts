import type { CapacitorConfig } from "@capacitor/cli";

/**
 * SwiftCard native iOS shell — Capacitor configuration.
 *
 * Architecture: a REMOTE-URL shell. The WKWebView loads the production site
 * (https://swiftcard.me) directly; Capacitor injects `window.Capacitor` into
 * that content, which is exactly what `src/lib/platform.ts` keys native-mode
 * detection off (PlanGate, native login, selling suppression, etc.).
 *
 * webDir points at a tiny local stub (capacitor-shell/www) that satisfies the
 * CLI; it is NOT what users see — server.url replaces it. Keep the stub as the
 * emergency offline page only.
 *
 * allowNavigation: hosts allowed to load INSIDE the webview. Everything else
 * (social links on cards, external sites) opens in the system browser via
 * Capacitor's default navigation policy — which is what Apple expects.
 *  - supabase.co: the OAuth redirect flow's callback hop.
 *  - accounts.google.com / appleid.apple.com: provider login pages for the
 *    native OAuth-redirect flow. ⚠️ Google frequently blocks OAuth inside
 *    embedded webviews (403 disallowed_useragent). If that occurs in device
 *    testing, the fix is the @capacitor/browser (ASWebAuthenticationSession)
 *    or native-SDK sign-in path — see docs/ios-review/SHELL-RUNBOOK.md §Auth.
 *
 * appId must stay `me.swiftcard.app` — it is already baked into the served
 * AASA (apple-app-site-association) appID and the Apple sign-in scaffolding.
 */
const config: CapacitorConfig = {
  appId: "me.swiftcard.app",
  appName: "SwiftCard",
  webDir: "capacitor-shell/www",
  server: {
    url: "https://swiftcard.me",
    // Attack-surface note: provider hosts (accounts.google.com /
    // appleid.apple.com) are deliberately NOT allowed in-webview — native
    // OAuth runs in the system browser sheet (src/lib/native-auth.ts), and
    // Google blocks embedded webview OAuth anyway (403 disallowed_useragent).
    allowNavigation: [
      "swiftcard.me",
      "www.swiftcard.me",
      "grxmovpmlgmjncnyiyrt.supabase.co",
    ],
  },
  ios: {
    // Match Safari's cookie/storage behavior for the remote origin so Supabase
    // auth sessions persist exactly like the website.
    limitsNavigationsToAppBoundDomains: false,
    contentInset: "automatic",
  },
  plugins: {
    // Store Preferences in the shared App Group so the home-screen QR widget
    // (SwiftCardWidget extension) can read the active card. Both the app and
    // widget targets must carry the matching application-groups entitlement.
    Preferences: {
      group: "group.me.swiftcard.app",
    },
  },
};

export default config;
