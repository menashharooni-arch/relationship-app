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
    }
}
