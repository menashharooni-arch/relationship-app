import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// The wrist screen.
//
// It does ONE thing: put a scannable QR code of the active card in front of the
// other person as fast as a wrist can be turned. Apple's watchOS guidance is to
// pick the single most important thing and make it the whole screen, and for a
// digital business card that is not a menu, a contact list or an analytics
// number — it is the code someone else points a camera at.
//
// Everything else on the screen is below the fold, reachable by the crown, and
// exists only to answer "whose card is this?" while it is being scanned.
// ─────────────────────────────────────────────────────────────────────────────

struct ContentView: View {
    @EnvironmentObject private var store: WatchCardStore

    var body: some View {
        Group {
            if let card = store.card {
                CardView(card: card)
            } else {
                EmptyStateView(isConnecting: store.isConnecting)
            }
        }
        // Black, edge to edge. On an OLED watch this is genuinely off pixels,
        // which both saves power in the always-on state and gives the white QR
        // tile the highest contrast frame a camera can be handed.
        .background(Color.black.ignoresSafeArea())
    }
}

// MARK: - The card

private struct CardView: View {
    let card: WatchCard

    /// True in the always-on dimmed state. watchOS reduces the panel's
    /// luminance itself; what we control is how much is on screen to dim.
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                QRTile(card: card, dimmed: isLuminanceReduced)
                    // Leave a sliver of the screen for the name underneath.
                    //
                    // At full width the tile is taller than the visible area on
                    // every watch size, so the first screen was nothing but QR
                    // and there was no way to tell WHICH card was on the wrist
                    // without scrolling — which matters, because an account can
                    // hold several and the watch only ever shows the active
                    // one. 88% costs a couple of millimetres of scan distance
                    // and buys the name peeking below the fold, which both
                    // answers that question and shows the screen scrolls.
                    .containerRelativeFrame(.vertical) { height, _ in height * 0.88 }

                // Hidden while dimmed: in the always-on state the wrist is
                // usually down and pointed at other people, and a name and
                // company are the two things on a business card that are
                // nobody else's business until it is offered. The QR stays —
                // it is opaque to a passer-by and useless without a camera.
                if !isLuminanceReduced {
                    VStack(spacing: 2) {
                        Text(card.displayName)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .foregroundStyle(.white)

                        if !card.company.isEmpty {
                            Text(card.company)
                                .font(.system(size: 12, weight: .medium))
                                .multilineTextAlignment(.center)
                                .lineLimit(1)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 2)

                    // Only when there is actually something to scan. With the
                    // grid missing the tile already says to open the phone, and
                    // inviting someone to scan a placeholder is a promise the
                    // screen cannot keep.
                    if card.qrModules != nil {
                        Label("Scan to connect", systemImage: "viewfinder")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.scBlue)
                            .padding(.top, 2)
                    }

                    // The readable address, for the times a camera is not
                    // convenient and someone just wants to type it in.
                    Text(prettyLink)
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 2)
            .padding(.bottom, 6)
        }
    }

    /// `https://swiftcard.me/jane-doe?source=widget` → `swiftcard.me/jane-doe`.
    /// The scheme and the tracking parameter are noise on a 40mm screen, and
    /// the parameter in particular would be actively misleading to read aloud.
    private var prettyLink: String {
        guard let components = URLComponents(string: card.url),
              let host = components.host else { return card.url }
        let path = components.path
        return path.isEmpty || path == "/" ? host : host + path
    }
}

// MARK: - QR

private struct QRTile: View {
    let card: WatchCard
    let dimmed: Bool

    var body: some View {
        ZStack {
            if let modules = card.qrModules {
                WatchQRCode(modules: modules)
                    .padding(5)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                // No grid: the phone's encoder failed, or this card was cached
                // by a build that predates the watch app. Say what to do about
                // it rather than showing an empty white square.
                VStack(spacing: 5) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(.secondary)
                    Text("Open SwiftCard on your iPhone to load your code")
                        .font(.system(size: 10))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .padding(8)
            }
        }
        // Square, and as wide as the watch allows. The single biggest factor in
        // whether a phone camera locks on from across a table is how many
        // physical millimetres each QR module occupies, so the tile gets the
        // full width and everything else queues up underneath it.
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: .infinity)
        // In the dimmed always-on state the tile is the only thing left, so it
        // gets the vertical space the labels were using.
        .padding(.top, dimmed ? 6 : 0)
    }
}

// MARK: - Empty state

private struct EmptyStateView: View {
    let isConnecting: Bool

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(Color.scBlue)

            if isConnecting {
                // Said for the second or two an activation takes. Without it
                // the app accuses a person with a perfectly good card of not
                // having one, every single cold launch.
                Text("Checking your iPhone…")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
            } else {
                Text("Open SwiftCard\non your iPhone")
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)

                Text("Your card appears here on its own, and works without your phone after that.")
                    .font(.system(size: 11))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8)
    }
}

// MARK: - Colour

extension Color {
    /// The app's brand blue (#2563EB), the same one the iOS widget and the web
    /// app use for "Scan to connect".
    static let scBlue = Color(red: 0.145, green: 0.388, blue: 0.922)
}

#Preview("Card") {
    // A fixed 21x21 grid (QR version 1) so the preview draws something QR-
    // shaped without a phone, a session, or CoreImage — none of which exist in
    // a watchOS canvas.
    CardPreviewHarness()
}

private struct CardPreviewHarness: View {
    var body: some View {
        let width = 21
        let bytes = (width * width + 7) / 8
        let bits = Data((0..<bytes).map { UInt8(($0 * 37) % 251) }).base64EncodedString()
        let card = WatchCard(
            url: "https://swiftcard.me/jane-doe",
            name: "Jane Doe",
            company: "Malve Capital",
            qrWidth: width,
            qrBits: bits
        )
        return CardView(card: card)
            .background(Color.black)
    }
}
