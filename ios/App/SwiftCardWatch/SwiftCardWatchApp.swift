import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// SwiftCard for Apple Watch.
//
// A standalone watchOS app (WKApplication), not a WatchKit extension: since
// watchOS 7 the app IS the target, and the companion iPhone app is named in
// Info.plist via WKCompanionAppBundleIdentifier.
//
// The store is created here and only here. It owns the WCSession delegate, and
// WatchConnectivity permits exactly one delegate per process — building a
// second one anywhere would silently steal delivery from the first.
// ─────────────────────────────────────────────────────────────────────────────

@main
struct SwiftCardWatchApp: App {

    // @StateObject, not @State or a fresh instance in the body: the session
    // must outlive every view update, and activating a WCSession per redraw
    // would thrash the connection to the phone.
    @StateObject private var store = WatchCardStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
