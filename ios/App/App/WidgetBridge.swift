import Foundation
import Capacitor
import WidgetKit

// ─────────────────────────────────────────────────────────────────────────────
// WidgetBridge — hands the active card to the SwiftCardWidget extension.
//
// Why this exists instead of @capacitor/preferences:
// the Preferences plugin's `group` option is NOT an iOS App Group. Its iOS
// implementation always writes to `UserDefaults.standard` and uses `group`
// only as a key prefix (see node_modules/@capacitor/preferences/ios/.../
// Preferences.swift). `UserDefaults.standard` lives in the app's own
// container, which a widget extension cannot read — so a card written that
// way is invisible to the widget no matter how the strings line up.
//
// This plugin writes to the real shared suite, `UserDefaults(suiteName:
// APP_GROUP)`, under the exact key the widget reads, and then asks WidgetKit
// to refresh — without the reload the widget would keep its stale snapshot for
// up to the 6-hour timeline policy in SwiftCardWidget.swift.
//
// The App target and the SwiftCardWidget target must both carry the
// `group.me.swiftcard.app` App Groups entitlement for the suite to resolve.
// ─────────────────────────────────────────────────────────────────────────────

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setCard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCard", returnType: CAPPluginReturnPromise)
    ]

    // Must match APP_GROUP / STORE_KEY in SwiftCardWidget.swift.
    private static let appGroup = "group.me.swiftcard.app"
    private static let storeKey = "widget_card"

    private var shared: UserDefaults? {
        UserDefaults(suiteName: Self.appGroup)
    }

    @objc func setCard(_ call: CAPPluginCall) {
        guard let url = call.getString("url"), !url.isEmpty else {
            call.reject("Must provide a card url")
            return
        }
        // Shape must stay in sync with `CardInfo` in SwiftCardWidget.swift —
        // its JSONDecoder requires all three keys to be present.
        let payload: [String: String] = [
            "url": url,
            "name": call.getString("name") ?? "My SwiftCard",
            "company": call.getString("company") ?? ""
        ]

        guard
            let defaults = shared,
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8)
        else {
            // Almost always a missing/mismatched App Groups entitlement. Fail
            // loudly rather than silently: the JS side logs it, and a widget
            // stuck on its empty state is otherwise very hard to diagnose.
            call.reject("App Group \(Self.appGroup) is unavailable — check the App Groups entitlement")
            return
        }

        defaults.set(json, forKey: Self.storeKey)
        reloadWidgets()
        call.resolve()
    }

    @objc func clearCard(_ call: CAPPluginCall) {
        shared?.removeObject(forKey: Self.storeKey)
        reloadWidgets()
        call.resolve()
    }

    private func reloadWidgets() {
        WidgetCenter.shared.reloadTimelines(ofKind: "SwiftCardQR")
    }
}
