"use client";

import { useState } from "react";

// ts = bucket start (epoch ms). card/links: the per-surface split of `count`
// (SwiftCard page vs Swift Links page); when absent the bar is drawn as one.
export type TrafficBucket = { count: number; ts: number; card?: number; links?: number };

// A small, dependency-free traffic chart with a real time axis. Each bucket is
// one hour (Today) or one day (Week/Month); the newest bucket is highlighted and
// hovering any bar shows its exact date/time + view count. Zero-view buckets keep
// a faint baseline nub so the series reads as an evenly-spaced timeline rather
// than a lone bar floating in empty space.
export default function TrafficChart({
  buckets,
  range,
  max,
  tz,
}: {
  buckets: TrafficBucket[];
  range: "today" | "week" | "month";
  max: number;
  // IANA zone the server bucketed the data in. Formatting the axis in the SAME
  // zone keeps each label aligned to the bucket it sits under (a bar server-
  // bucketed as "Jul 20 local" must also READ "Jul 20"). Omit → viewer-local.
  tz?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = buckets.length;
  if (n === 0) return null;

  const fmtAxis = (ts: number) =>
    range === "today"
      ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", timeZone: tz })
      : new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });

  const fmtTip = (ts: number) =>
    range === "today"
      ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
      : new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });

  // ~4–5 evenly spaced ticks (or every day for the 7-day week view).
  const tickTarget = range === "week" ? 7 : range === "today" ? 4 : 5;
  const tickIdxs = Array.from(
    new Set(Array.from({ length: tickTarget }, (_, k) => Math.round((k * (n - 1)) / (tickTarget - 1)))),
  );

  const split = buckets.some((b) => b.card != null || b.links != null);
  const CARD = "#3b82f6", LINKS = "#a78bfa";

  return (
    <div className="mt-4">
      {split && (
        <div className="mb-2 flex items-center gap-4 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: CARD }} />SwiftCard</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: LINKS }} />Swift Links</span>
        </div>
      )}
      <div className="relative flex items-end gap-1 h-20">
        {buckets.map((b, i) => {
          const last = i === n - 1;
          const active = hover === i;
          const h = b.count > 0 ? Math.max(8, Math.round((b.count / max) * 100)) : 3;
          const card = b.card ?? b.count;
          const links = b.links ?? 0;
          return (
            <div
              key={i}
              className="relative flex-1 min-w-0 h-full flex items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(active ? null : i)}
            >
              {split && b.count > 0 ? (
                /* Stacked: card views on the bottom, links views on top — the
                   same colours as the legend, dimmed unless newest/hovered. */
                <div className="w-full flex flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${h}%`, opacity: last || active ? 1 : 0.7 }}>
                  {links > 0 && <div style={{ flex: links, background: LINKS }} />}
                  {card > 0 && <div style={{ flex: card, background: CARD }} />}
                </div>
              ) : (
              <div
                className="w-full rounded-t-md transition-colors"
                style={{
                  height: `${h}%`,
                  background:
                    b.count === 0
                      ? "#232a45"
                      : last || active
                        ? "linear-gradient(180deg,#60a5fa 0%,#2563eb 100%)"
                        : "#3b4a80",
                }}
              />
              )}
              {active && b.count > 0 && (
                /* Inline colors, no theme-remapped classes: the light theme
                   flips .text-white dark and .bg-slate-800 white, which turned
                   this tooltip into dark-on-pale. A tooltip is a floating chip,
                   not a surface — it stays dark with light text in BOTH themes,
                   like ViewsChart's. */
                <div
                  className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-center shadow-lg ring-1 ring-black/20"
                  style={{ backgroundColor: "#1e293b" }}
                >
                  <span className="block text-[11px] font-bold tabular-nums" style={{ color: "#ffffff" }}>
                    {b.count} view{b.count !== 1 ? "s" : ""}
                  </span>
                  {split && (
                    <span className="block text-[10px] tabular-nums" style={{ color: "#cbd5e1" }}>
                      <span style={{ color: CARD }}>●</span> {card} SwiftCard · <span style={{ color: LINKS }}>●</span> {links} Swift Links
                    </span>
                  )}
                  <span className="block text-[10px]" style={{ color: "#cbd5e1" }}>{fmtTip(b.ts)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* baseline */}
      <div className="h-px w-full bg-gray-800" />

      {/* time axis */}
      <div className="relative mt-1 h-3.5 text-[10px] text-gray-500">
        {tickIdxs.map((idx) => {
          const isFirst = idx === 0;
          const isLast = idx === n - 1;
          // Week/Month: the last daily bucket is the current 24h → "Today".
          // Today (hourly): the last bucket is the 11 PM hour, not "now", so
          // just label its hour like every other tick.
          const label = isLast && range !== "today" ? "Today" : fmtAxis(buckets[idx].ts);
          // Anchor edge labels to the edges so they don't clip; center the rest
          // over their bucket.
          const style = isFirst
            ? { left: 0 }
            : isLast
              ? { right: 0 }
              : { left: `${((idx + 0.5) / n) * 100}%`, transform: "translateX(-50%)" };
          return (
            // suppressHydrationWarning: toLocale* formats in the VIEWER's
            // timezone, so the server (UTC) and client can produce different
            // label text for the same timestamp (React #418). Hover re-renders
            // settle any stale server text; the drift is cosmetic.
            <span key={idx} suppressHydrationWarning className="absolute top-0 tabular-nums whitespace-nowrap" style={style}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
