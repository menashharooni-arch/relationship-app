import Foundation
import Capacitor
import StoreKit
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// AppReview — the system "Enjoying SwiftCard?" rating sheet.
//
// WHY THE NATIVE API FOR THE AUTOMATIC ASK
//
// SKStoreReviewController (AppStore.requestReview on iOS 16+) is the only
// sanctioned way to ask unprompted: iOS decides whether to display it at all,
// caps it at three times per 365 days per user, and silently ignores every
// request beyond that. The user-initiated "Rate us" button on /grow is the other
// half — a plain link to the write-review page, which Capacitor opens in the App
// Store app. This plugin never opens a link.
//
// WHEN IT IS CALLED
//
// Only from src/lib/app-review.ts, which requires a real win (a lead, or three
// shares of your own card), never runs on first launch or from a tap, and never
// looks at how anyone feels about us. `minInterval` below is the same 90-day rule
// enforced a second time here, in UserDefaults, so no web-side bug can ever turn
// into a prompt loop.
//
// The call is fire-and-forget by design. The sheet may not appear — throttled,
// disabled in Settings, or already shown three times this year — and there is no
// callback that says which. So nothing in the UI may depend on it, and nothing
// may say "leave us a review" next to it.
// ─────────────────────────────────────────────────────────────────────────────

@objc(AppReviewPlugin)
public class AppReviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppReviewPlugin"
    public let jsName = "AppReview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    private static let lastRequestedKey = "sc.appReview.lastRequested"
    private static let minInterval: TimeInterval = 90 * 24 * 60 * 60

    @objc func requestReview(_ call: CAPPluginCall) {
        // Check and stamp on the main queue, so two calls can never both pass
        // the check before either has written the date.
        DispatchQueue.main.async {
            let defaults = UserDefaults.standard
            if let last = defaults.object(forKey: Self.lastRequestedKey) as? Date,
               Date().timeIntervalSince(last) < Self.minInterval {
                call.resolve(["requested": false, "reason": "throttled"])
                return
            }

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

            defaults.set(Date(), forKey: Self.lastRequestedKey)
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
