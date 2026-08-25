import Foundation
import Capacitor
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// ExternalPurchase — opens the subscribe page in the DEFAULT BROWSER.
//
// WHY A NATIVE PLUGIN AND NOT A LINK
//
// capacitor.config.ts allow-lists `swiftcard.me` under server.allowNavigation,
// because the whole shell IS that origin. Every ordinary route through the
// purchase page therefore stays inside the WKWebView:
//
//   • <a href="https://swiftcard.me/upgrade">        → in-webview navigation
//   • <a target="_blank">                            → allow-listed host, same
//   • window.open(url)                               → same
//   • @capacitor/browser Browser.open()              → SFSafariViewController,
//                                                      which is an IN-APP sheet
//
// None of those leave the app, and the last one is the trap: an SFSafari sheet
// looks like Safari and is not. App Review's rejection wording is specific —
// apps on the United States storefront "may link out to the DEFAULT BROWSER".
// UIApplication.open is the only call that does that, so the compliant path has
// to cross the bridge.
//
// WHY THIS IS ALLOWED AT ALL
//
// Guideline 3.1.1(a): "These entitlements are not required for developers to
// include buttons, external links, or other calls to action in their United
// States storefront apps." The StoreKit External Purchase Link Entitlement is a
// non-US mechanism; on the US storefront the link needs no entitlement and no
// modal sheet. This is why the app must ship US-only while this is the purchase
// path — in any other storefront the same button is a 3.1.1 violation, not a
// remedy. If availability is ever widened, this plugin must be gated on the
// StoreKit storefront country or replaced by real In-App Purchase.
//
// The web half is src/lib/external-purchase.ts, which fails CLOSED: if this
// plugin is missing (an older build, or the widened-availability case above) it
// renders no button at all rather than falling back to an in-webview link that
// would look compliant and not be.
// ─────────────────────────────────────────────────────────────────────────────

@objc(ExternalPurchasePlugin)
public class ExternalPurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalPurchasePlugin"
    public let jsName = "ExternalPurchase"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    // Only our own origin — plus Apple's subscription-management page — may be
    // opened. The URL arrives from web code running in a remote-origin webview,
    // so it is not inherently trusted input: without this an injected string
    // could turn a compliance affordance into an arbitrary-URL opener.
    //
    // apps.apple.com is here for manageIapSubscription() (lib/iap.ts): Apple-
    // billed subs are canceled on the App Store's own page, and iOS hands that
    // URL to the system subscription sheet. Before it was allow-listed, the
    // "Manage subscription" button resolved a rejection into a swallowed catch
    // — a silently dead button, in front of exactly the reviewer who just
    // sandbox-purchased.
    private static let allowedHosts: Set<String> = ["swiftcard.me", "www.swiftcard.me", "apps.apple.com"]

    @objc func open(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"),
              let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "https",
              let host = url.host?.lowercased(),
              Self.allowedHosts.contains(host)
        else {
            call.reject("A https swiftcard.me url is required")
            return
        }

        DispatchQueue.main.async {
            // `options: [:]` with a completion handler, not the deprecated
            // openURL(_:) — the deprecated form is a no-op from an extension
            // context and gives no success signal, so a failure to open would
            // resolve as if the browser had launched.
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve(["opened": true])
                } else {
                    call.reject("The system declined to open the url")
                }
            }
        }
    }
}
