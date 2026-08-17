import UIKit
import Capacitor

// ─────────────────────────────────────────────────────────────────────────────
// The app's bridge view controller, existing for exactly one reason: to
// register WidgetBridgePlugin.
//
// Capacitor does NOT discover plugins by scanning the Objective-C runtime.
// `CapacitorBridge.registerPlugins()` builds its list from five hardcoded
// built-ins plus the class names in capacitor.config.json's `packageClassList`
// — and `npx cap sync ios` regenerates that list from installed npm packages
// only. An app-local plugin therefore never appears in it, no matter that the
// class is in the binary and conforms to CAPBridgedPlugin.
//
// Without this, `window.Capacitor.Plugins.WidgetBridge` is undefined, the
// optional call in NativeAppBridge.tsx quietly no-ops, and the home-screen
// widget stays on its empty state forever — the exact bug WidgetBridge was
// written to fix.
//
// `registerPluginType(_:)` is NOT the API to use here: it early-returns while
// `autoRegisterPlugins` is true, which is the default. `registerPluginInstance`
// is the supported path for app-local plugins.
//
// Wired up in Base.lproj/Main.storyboard, whose customClass points at this
// class instead of the stock CAPBridgeViewController.
// ─────────────────────────────────────────────────────────────────────────────

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        // Same reason as above — app-local plugins are never auto-discovered.
        // Without this line window.Capacitor.Plugins.ExternalPurchase is
        // undefined, and src/lib/external-purchase.ts (which fails closed)
        // renders no subscribe button, which is the 3.1.1 rejection again.
        bridge?.registerPluginInstance(ExternalPurchasePlugin())

        // No scroll indicators: the flashing bar on the right of every scroll
        // is drawn by iOS on the webview's scroll view — CSS can't reach it.
        // Native apps built with UIKit lists show one too, but on a webview it
        // reads as "this is a web page"; the owner wants it gone (2026-08-10).
        webView?.scrollView.showsVerticalScrollIndicator = false
        webView?.scrollView.showsHorizontalScrollIndicator = false

        // THE APP NEVER ZOOMS.
        //
        // globals.css already sets `touch-action: pan-x pan-y` on the shell,
        // which drops the pinch and double-tap gestures — but only for content
        // the stylesheet reaches. It cannot cross into a cross-origin iframe,
        // and it does not govern the zoom iOS performs by itself when a form
        // control smaller than 16px is focused (a floor in globals.css handles
        // ours; a third-party embed's fields are beyond it).
        //
        // Zooming in a webview is the SCROLL VIEW's zoom, so disabling it here
        // covers every one of those cases at once, including inside iframes.
        // Pinning minimum == maximum == 1 additionally means there is no zoomed
        // state to be left stranded in, which was the actual bug: the previous
        // approach disabled the user's pinch while leaving the automatic
        // zoom-in intact, so the app zoomed itself in with no way back out.
        //
        // bouncesZoom must be off too, or a pinch still rubber-bands the whole
        // page and springs back — visually identical to a zoom that "sticks"
        // for a moment.
        //
        // Native rather than web-only because this survives any future CSS
        // regression, and because delegate-level zoom cannot be re-enabled by
        // page content.
        pinZoom()

        // capacitorDidLoad() runs ONCE, at bridge creation — and this shell
        // loads a REMOTE url (server.url = https://swiftcard.me) that performs
        // genuine full-document navigations after that point, starting with
        // sc-boot's location.replace('/dashboard') on the very first launch.
        // WebKit re-derives minimum/maximumZoomScale from each new document's
        // viewport meta and rebuilds its gesture recognisers, so a one-shot pin
        // is undone by the first navigation — i.e. before the user ever sees a
        // screen. Re-applying on every committed URL change is what makes it
        // hold for the life of the app.
        //
        // KVO on `url` rather than the navigation delegate or the scroll-view
        // delegate: Capacitor owns both (CAPBridgeViewController installs its
        // WebViewDelegationHandler as each), and taking either from it breaks
        // the bridge — plugin calls, app-bound-domain handling and its own
        // zoom guard all hang off them.
        urlObservation = webView?.observe(\.url, options: [.new]) { [weak self] _, _ in
            self?.pinZoom()
        }
    }

    /// Zoom pinned to exactly 1.0, in every direction it can be changed.
    ///
    /// bouncesZoom must be off too: with it on, a pinch still rubber-bands the
    /// whole page and springs back, which reads as a zoom that "sticks" for a
    /// moment rather than one that never happens.
    private func pinZoom() {
        guard let scrollView = webView?.scrollView else { return }
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 1.0
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    private var urlObservation: NSKeyValueObservation?

    deinit {
        urlObservation?.invalidate()
    }
}
