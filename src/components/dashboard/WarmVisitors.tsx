import { BlurredPlace } from "@/components/NotificationBody";
import { getSourceLabel } from "@/lib/source-labels";
import { relativeTime } from "@/lib/relative-time";
import { hasMarkedPlace, splitLocationParts } from "@/lib/location-privacy";
import type { WarmVisitor } from "@/lib/visitor-intel";

// ── "Came back 3 times, never left their info" ───────────────────────────────
//
// The people in this box are the ones the product could never show before: a
// visitor with no lead row was invisible everywhere, however many times they
// returned. Their id is a browser id and nothing here pretends otherwise —
// there is no name, no avatar, no "John from Acme". Saying more than we know
// is the failure mode this whole box has to avoid.
//
// WHAT AN OWNER DOES WITH IT. They cannot contact an anonymous visitor, so the
// honest job of this list is to tell them WHICH conversation is still warm:
// the QR code from Tuesday's open house pulled someone back three times, so
// that's the room worth following up on. That's also why source and card are on
// every row, and why a single drive-by view never appears (lib/visitor-intel
// warmOnly) — a list that includes everyone is a list nobody reads.

function VisitorPlace({ label }: { label: string }) {
  // A Free account's label arrived here already replaced with blocks on the
  // server; the blur is the finish, not the lock. A paid label is plain text
  // and splitLocationParts gives it back as one ordinary part.
  if (!hasMarkedPlace(label)) return <>{label}</>;
  return (
    <>
      {splitLocationParts(label).map((part, i) =>
        part.place ? <BlurredPlace key={i} text={part.text} /> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}

function visitLine(v: WarmVisitor): string {
  if (v.visits > 1) return `Came back ${v.visits} times`;
  if (v.savedContact) return "Saved your contact";
  return "Tapped your links";
}

export default function WarmVisitors({
  visitors,
  totalWarm,
}: {
  visitors: WarmVisitor[];
  totalWarm: number;
}) {
  if (!visitors.length) return null;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-white font-semibold text-sm">Still interested</h2>
        <span className="text-gray-600 text-[0.6875rem]">
          {totalWarm.toLocaleString("en-US")} in the last 90 days
        </span>
      </div>

      {/* Said once, at the top, rather than hedged on every row. */}
      <p className="text-gray-500 text-[0.6875rem] mb-3">
        People who came back or tapped through, and haven&apos;t shared their details.
      </p>

      <ul className="space-y-2">
        {visitors.map((v) => (
          <li
            key={v.visitorId}
            className="flex items-start justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-gray-200 text-xs font-medium">
                {visitLine(v)}
                {v.linkTaps > 0 && (
                  <span className="text-gray-500 font-normal">
                    {" · "}
                    {v.linkTaps.toLocaleString("en-US")} link{v.linkTaps === 1 ? "" : "s"} tapped
                  </span>
                )}
              </p>
              <p className="text-gray-500 text-[0.6875rem] mt-0.5 truncate">
                {v.sources.length > 0 ? getSourceLabel(v.sources[0]) : "Direct link"}
                {v.cards.length > 0 && <> · /{v.cards[0]}</>}
                {v.location && (
                  <>
                    {" · "}
                    <VisitorPlace label={v.location} />
                  </>
                )}
              </p>
            </div>
            {/* suppressHydrationWarning: relative time is computed from the
                clock, so the server string and the first client render can
                legitimately differ by a minute. Same treatment as the bell. */}
            <span
              suppressHydrationWarning
              className="text-gray-600 text-[0.6875rem] shrink-0 whitespace-nowrap"
            >
              {relativeTime(v.lastSeen)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
