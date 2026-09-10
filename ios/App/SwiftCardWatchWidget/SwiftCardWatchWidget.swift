import WidgetKit
import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// The watch-face complication.
//
// This is the part that makes the watch app worth having. Without it, sharing a
// card means pressing the crown, finding SwiftCard in the app grid and waiting
// for it to launch — slower than pulling the phone out, which is the only thing
// the watch app has to beat. With a complication on the face it is one tap from
// a raised wrist.
//
// It deliberately does NOT render a QR code. At 30-odd points across, a QR is a
// grey smudge no camera will read, and offering an unscannable code is worse
// than offering none. The complication is a door: a mark you can recognise at a
// glance, whose only job is to open the app that shows the real thing.
//
// It reads the App Group slot WatchCardStore writes, so it shows the person's
// own name and never falls out of step with the app.
// ─────────────────────────────────────────────────────────────────────────────

struct WatchComplicationEntry: TimelineEntry {
    let date: Date
    let card: WatchCard?
}

struct WatchComplicationProvider: TimelineProvider {

    func placeholder(in context: Context) -> WatchComplicationEntry {
        WatchComplicationEntry(
            date: .now,
            card: WatchCard(url: "https://swiftcard.me", name: "Your card", company: "", qrWidth: nil, qrBits: nil)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchComplicationEntry) -> Void) {
        completion(WatchComplicationEntry(date: .now, card: WatchCardStorage.load() ?? placeholder(in: context).card))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchComplicationEntry>) -> Void) {
        // The content only changes when the phone sends a new card, and that
        // path calls reloadTimelines directly. `.never` is therefore correct
        // AND the kind that costs the battery nothing — a scheduled refresh
        // would wake the extension all day to re-read a string that did not
        // change.
        completion(Timeline(entries: [WatchComplicationEntry(date: .now, card: WatchCardStorage.load())], policy: .never))
    }
}

// MARK: - Views

struct WatchComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WatchComplicationEntry

    var body: some View {
        switch family {
        case .accessoryRectangular:
            // The only family with room for words. Name first: on a face
            // crowded with numbers, a name is what the eye finds.
            VStack(alignment: .leading, spacing: 1) {
                Label("SwiftCard", systemImage: "qrcode")
                    .font(.system(size: 12, weight: .semibold))
                    .widgetAccentable()
                Text(entry.card?.displayName ?? "Open on iPhone")
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                Text(entry.card == nil ? "No card yet" : "Tap to show your QR")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

        case .accessoryInline:
            // A single line the system draws in the face's own font, beside
            // the date. No styling of ours survives here, so say the one useful
            // thing plainly.
            Label(entry.card?.displayName ?? "SwiftCard", systemImage: "qrcode")

        case .accessoryCorner:
            Image(systemName: "qrcode")
                .font(.system(size: 18, weight: .medium))
                .widgetLabel("SwiftCard")

        default: // .accessoryCircular
            // Circular is the family people actually use, and it is a glyph
            // slot. A bare qrcode symbol inside the system's tinted ring reads
            // instantly at a glance and cannot be mistaken for a data readout.
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "qrcode")
                    .font(.system(size: 20, weight: .medium))
            }
        }
    }
}

// MARK: - Widget

@main
struct SwiftCardWatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WATCH_COMPLICATION_KIND, provider: WatchComplicationProvider()) { entry in
            WatchComplicationView(entry: entry)
                // Required on watchOS: without a container background the
                // complication renders with no backing at all on some faces.
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("My SwiftCard")
        .description("One tap from your watch face to the QR code people scan.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .accessoryCorner,
        ])
    }
}
