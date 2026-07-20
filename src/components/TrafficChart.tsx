"use client";

import { useState } from "react";

export type TrafficBucket = { count: number; ts: number }; // ts = bucket start (epoch ms)

// A small, dependency-free traffic chart with a real time axis. Each bucket is
// one hour (Today) or one day (Week/Month); the newest bucket is highlighted and
// hovering any bar shows its exact date/time + view count. Zero-view buckets keep
// a faint baseline nub so the series reads as an evenly-spaced timeline rather
// than a lone bar floating in empty space.
export default function TrafficChart({
  buckets,
  range,
  max,
}: {
  buckets: TrafficBucket[];
  range: "today" | "week" | "month";
  max: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = buckets.length;
  if (n === 0) return null;

  const fmtAxis = (ts: number) =>
    range === "today"
      ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric" })
      : new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const fmtTip = (ts: number) =>
    range === "today"
      ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // ~4–5 evenly spaced ticks (or every day for the 7-day week view).
  const tickTarget = range === "week" ? 7 : range === "today" ? 4 : 5;
  const tickIdxs = Array.from(
    new Set(Array.from({ length: tickTarget }, (_, k) => Math.round((k * (n - 1)) / (tickTarget - 1)))),
  );

  return (
    <div className="mt-4">
      <div className="relative flex items-end gap-1 h-20">
        {buckets.map((b, i) => {
          const last = i === n - 1;
          const active = hover === i;
          const h = b.count > 0 ? Math.max(8, Math.round((b.count / max) * 100)) : 3;
          return (
            <div
              key={i}
              className="relative flex-1 min-w-0 h-full flex items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
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
              {active && b.count > 0 && (
                <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-center shadow-lg ring-1 ring-black/20">
                  <span className="block text-[11px] font-bold text-white tabular-nums">
                    {b.count} view{b.count !== 1 ? "s" : ""}
                  </span>
                  <span className="block text-[10px] text-slate-400">{fmtTip(b.ts)}</span>
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
