import Foundation
import SwiftUI
import WidgetKit

// ─────────────────────────────────────────────────────────────────────────────
// The model, the store and the QR renderer for the watch — compiled into BOTH
// watch targets (the app and its complication), which is the whole reason it is
// a file of its own. The app receives the card and writes it; the complication
// only ever reads it. They must agree on the suite, the key and the shape, and
// the way to guarantee that is to share the code rather than the convention.
//
// THE QR CODE IS NOT GENERATED HERE, AND CANNOT BE.
// watchOS has no CoreImage. `CIFilter.qrCodeGenerator()` — the two lines that
// draw the code on the phone and in the home-screen widget — does not exist on
// this platform, and a target importing CoreImage fails to resolve the module
// before it compiles a line. So the PHONE encodes the card into a grid of
// black/white modules (see WatchSessionBridge.qrMatrix) and sends the grid
// itself. The watch just draws squares.
//
// That division is better than it sounds. The grid is about 180 bytes, versus
// a couple of kilobytes for a rendered PNG; it needs no image decode on a slow
// CPU; and because it is drawn as vector rectangles it is exactly crisp at
// every watch size instead of being an upscaled bitmap.
//
// Nothing here talks to the network. The watch never fetches a card, so the QR
// works in a lift with no signal, which is exactly where someone hands over a
// business card.
// ─────────────────────────────────────────────────────────────────────────────

/// Shared between the watch app and its complication. Same identifier as the
/// phone's App Group, but a completely separate container: groups are shared
/// between an app and its extensions on ONE device, never across the pair.
let WATCH_APP_GROUP = "group.me.swiftcard.app"
let WATCH_STORE_KEY = "watch_card"
let WATCH_COMPLICATION_KIND = "SwiftCardWatchQR"

struct WatchCard: Codable, Equatable {
    let url: String
    let name: String
    let company: String

    /// The QR grid, as prepared by the phone. Optional so that a card cached by
    /// an older build still decodes — the person sees their name and link and a
    /// prompt to open the phone app, rather than the app deciding it has no
    /// card at all. Synthesised Codable treats a missing key for an Optional as
    /// nil, which is exactly the migration behaviour wanted here.
    let qrWidth: Int?
    /// Base64 of the grid packed one bit per module, row-major, MSB first.
    let qrBits: String?

    var displayName: String { name.isEmpty ? "My SwiftCard" : name }

    /// Row-major booleans, or nil when the grid is absent or malformed.
    /// Decoded once per card by the view that draws it.
    var qrModules: [[Bool]]? {
        guard
            let width = qrWidth, width > 0,
            let bits = qrBits,
            let data = Data(base64Encoded: bits),
            data.count * 8 >= width * width
        else { return nil }

        var rows: [[Bool]] = []
        rows.reserveCapacity(width)
        for y in 0..<width {
            var row: [Bool] = []
            row.reserveCapacity(width)
            for x in 0..<width {
                let index = y * width + x
                let byte = data[data.startIndex + index / 8]
                // MSB first, matching the packing on the phone. Getting this
                // backwards produces a mirrored grid that still looks like a QR
                // code and scans as nothing.
                row.append((byte >> (7 - UInt8(index % 8))) & 1 == 1)
            }
            rows.append(row)
        }
        return rows
    }
}

// MARK: - Storage

enum WatchCardStorage {

    /// App Group first, `.standard` as a fallback.
    ///
    /// The group is what lets the complication read what the app received, so
    /// it is the real store. But if the App Groups entitlement is ever missing
    /// or misspelled, `UserDefaults(suiteName:)` still hands back a working
    /// object that writes somewhere nothing else can see — the precise failure
    /// WidgetBridge documents on the phone side. Falling back to `.standard`
    /// means that mistake costs the complication and nothing else: the watch
    /// app itself still shows the card. A QR that renders is worth more than a
    /// purist store that is empty.
    private static var group: UserDefaults? {
        guard FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: WATCH_APP_GROUP
        ) != nil else { return nil }
        return UserDefaults(suiteName: WATCH_APP_GROUP)
    }

    private static var stores: [UserDefaults] { [group, .standard].compactMap { $0 } }

    static func load() -> WatchCard? {
        for store in stores {
            guard
                let raw = store.string(forKey: WATCH_STORE_KEY),
                let data = raw.data(using: .utf8),
                let card = try? JSONDecoder().decode(WatchCard.self, from: data),
                !card.url.isEmpty
            else { continue }
            return card
        }
        return nil
    }

    static func save(_ card: WatchCard?) {
        guard
            let card,
            let data = try? JSONEncoder().encode(card),
            let json = String(data: data, encoding: .utf8)
        else {
            // nil card = signed out on the phone. Clear both stores; a watch
            // that keeps showing the previous account's QR is the handed-on-
            // device problem the phone's clearCard exists to prevent.
            stores.forEach { $0.removeObject(forKey: WATCH_STORE_KEY) }
            reloadComplications()
            return
        }
        stores.forEach { $0.set(json, forKey: WATCH_STORE_KEY) }
        reloadComplications()
    }

    /// Without this the complication keeps its last snapshot for hours — the
    /// same stale-timeline trap the iOS widget has.
    static func reloadComplications() {
        WidgetCenter.shared.reloadTimelines(ofKind: WATCH_COMPLICATION_KIND)
    }
}

// MARK: - Drawing

/// The QR code, drawn as vector rectangles.
///
/// Canvas rather than an Image: there is no bitmap to show. Each module becomes
/// one filled rect on a white ground, so the code is pixel-exact at 40mm and at
/// 49mm alike, with none of the blur that upscaling a small bitmap introduces
/// and that scanners reject.
struct WatchQRCode: View {
    let modules: [[Bool]]

    var body: some View {
        Canvas { context, size in
            let count = modules.count
            guard count > 0 else { return }

            // One module in points. Deliberately NOT rounded to whole pixels:
            // a watch screen is 2x, the grid rarely divides evenly into the
            // available width, and rounding accumulates into a visibly skewed
            // code by the right edge. Sub-pixel edges scan fine; a drifting
            // grid does not.
            let module = size.width / CGFloat(count)

            for (y, row) in modules.enumerated() {
                for (x, on) in row.enumerated() where on {
                    context.fill(
                        Path(CGRect(
                            x: CGFloat(x) * module,
                            y: CGFloat(y) * module,
                            // A hair of overlap. Adjacent rects drawn at exactly
                            // their bounds leave hairline seams on a 2x display,
                            // and those seams are what a camera reads as broken
                            // modules.
                            width: module + 0.5,
                            height: module + 0.5
                        )),
                        with: .color(.black)
                    )
                }
            }
        }
        // The quiet zone is already part of the grid the phone sends (CoreImage
        // includes it), so no extra padding is needed for scanning — only for
        // looks against the black screen.
        .background(Color.white)
        .accessibilityLabel("Your SwiftCard QR code. Point a camera at it to open the card.")
    }
}
