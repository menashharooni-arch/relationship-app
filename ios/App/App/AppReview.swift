import Foundation
import Capacitor
import StoreKit
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// AppReview — the system "Enjoying SwiftCard?" rating sheet.
//
// WHY THE NATIVE API AND NOT A LINK
//
// The App Store rating prompt is Apple's to show, not ours. SKStoreReviewController
// (AppStore.requestReview on iOS 16+) is the ONLY sanctioned way: iOS decides
// whether to display it at all, caps it at three times per 365 days per user,
// and silently ignores every request beyond that. Anything else — a button that
// deep-links to the write-review page unprompted, a "rate us 5 stars" plea —
// is a 1.1.1/2.3 problem and, worse, is the thing users hate.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//
// It does not gate on sentiment. src/components/RateUsCard.tsx asks how you feel
// and routes unhappy answers to a private feedback box — that is fine for
// Trustpilot, and it is exactly what Apple forbids for the App Store prompt
// ("don't discourage negative reviews"). So the native prompt is never wired to
// the star rating: the web side (src/lib/app-review.ts) decides only that the
// person has USED the product meaningfully, never that they liked it.
//
// The call is fire-and-forget by design. The prompt may not appear — throttled,
// disabled in Settings, or already shown three times this year — and there is no
// callback that says which. So nothing in the UI may depend on it, and the web
// side must never say "leave us a review" next to it.
// ─────────────────────────────────────────────────────────────────────────────

@objc(AppReviewPlugin)
public class AppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppReviewPlugin"
    public let jsName = "AppReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // The scene, not the window: on iPadOS and on an Apple Silicon Mac
            // the app can have more than one, and requesting on a detached or
            // background scene does nothing at all.
            guard let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
                ?? UIApplication.shared.connectedScenes.first as? UIWindowScene
            else {
                // Not an error the caller can act on — see the header: the
                // prompt is never guaranteed. Resolve so the JS side is uniform.
                call.resolve(["requested": false])
                return
            }

            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            // "requested", not "shown" — iOS never tells us which.
            call.resolve(["requested": true])
        }
    }
}
