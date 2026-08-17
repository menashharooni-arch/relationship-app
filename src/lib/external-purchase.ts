"use client";

// ── The US-storefront external purchase link ────────────────────────────────
//
// App Review rejected 1.0.0 (3) under Guideline 3.1.1: a paying customer signs
// into the app and uses features they bought on swiftcard.me, and that content
// "isn't available to purchase using In-App Purchase". The rejection itself
// named the remedy:
//
//   "Apps on the United States storefront may link out to the default browser,
//    using buttons, external links, or other calls to action, for payment
//    mechanisms other than in-app purchase."
//
// Guideline 3.1.1(a) confirms no entitlement is needed for that on the US
// storefront. So the compliant purchase path is a button that leaves the app.
//
// TWO THINGS THIS MODULE EXISTS TO GUARANTEE
//
// 1. It really leaves the app. `swiftcard.me` is allow-listed in
//    capacitor.config.ts (the shell IS that origin), so an <a>, a target=_blank
//    or a window.open all stay inside the WKWebView, and @capacitor/browser
//    opens an in-app SFSafariViewController that merely looks like Safari.
//    Only UIApplication.open reaches the default browser, which is what Apple
//    asked for — hence the native plugin in ios/App/App/ExternalPurchase.swift.
//
// 2. It fails CLOSED. If the plugin is missing — an older shell build, or a
//    non-US storefront if availability is ever widened — this returns false and
//    the caller renders NO button. A silent fallback to an in-webview link
//    would look compliant while being exactly the violation that got us
//    rejected, and it would ship to storefronts where the link is not allowed.

import { detectNativeApp } from "@/lib/platform";

type ExternalPurchasePlugin = {
  open: (options: { url: string }) => Promise<{ opened: boolean }>;
};

function plugin(): ExternalPurchasePlugin | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window as unknown as {
      Capacitor?: { Plugins?: { ExternalPurchase?: ExternalPurchasePlugin } };
    }
  ).Capacitor?.Plugins?.ExternalPurchase;
}

/**
 * Whether a compliant external purchase link can actually be offered right now.
 *
 * False on web (the site has its own checkout) and false in any shell build
 * whose native half predates the plugin. Callers MUST gate on this rather than
 * rendering a button and hoping — see the fail-closed note above.
 */
export function canOfferExternalPurchase(): boolean {
  return detectNativeApp() && !!plugin();
}

/** Where the link goes. `src` is for acquisition attribution, nothing more. */
export function externalPurchaseUrl(path = "/upgrade"): string {
  return `https://swiftcard.me${path}${path.includes("?") ? "&" : "?"}src=ios_link`;
}

/**
 * Open the subscribe page in the default browser.
 *
 * Resolves false when the plugin is absent or the system declined, so a caller
 * can surface a real failure instead of leaving the user staring at a button
 * that did nothing.
 */
export async function openExternalPurchase(path?: string): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    const { opened } = await p.open({ url: externalPurchaseUrl(path) });
    return !!opened;
  } catch {
    return false;
  }
}
