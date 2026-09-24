// ── Office analytics date ranges — the viewer's LOCAL calendar days ─────────
// These were UTC days, so for a New York office "today" began at 8pm the
// evening before and every evening's views landed on the next day's bar —
// unlike the personal dashboard, which has always used the browser's time zone
// (sc_tz, lib/tz-days). Given `tz` they now do the same; without it (or for a
// custom range, whose dates arrive as plain days) they stay UTC.
// `until` is always EXCLUSIVE — the start of the day after the range's last
// included day — so every query can filter with a plain `< until`.

import { startOfLocalDayUtc } from "@/lib/tz-days";

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";
export type DateRange = { since: string; until: string };

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

// `now` is passed in (never read internally) so this stays a pure, testable
// function — the caller supplies `new Date()` at the actual request site.
export function resolveDateRange(
  preset: DateRangePreset,
  now: Date,
  custom?: { since: string; until: string },
  tz?: string,
): DateRange {
  if (tz && !(preset === "custom" && custom)) {
    const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
    return {
      since: startOfLocalDayUtc(days - 1, tz, now).toISOString(),
      until: startOfLocalDayUtc(-1, tz, now).toISOString(),
    };
  }
  const todayStart = utcDayStart(now);
  const tomorrowStart = todayStart + DAY_MS;

  if (preset === "custom" && custom) {
    const sinceStart = utcDayStart(new Date(custom.since));
    const untilStart = utcDayStart(new Date(custom.until));
    // A backwards range (since after until) clamps to a single-day range on
    // `since` rather than silently returning an inverted/empty window.
    const untilExclusive = Math.max(untilStart, sinceStart) + DAY_MS;
    return { since: new Date(sinceStart).toISOString(), until: new Date(untilExclusive).toISOString() };
  }

  // "(days - 1) back + today" = exactly `days` calendar days including today.
  // A plain `todayStart - days` spanned days+1 (e.g. "7 days" covered 8), so
  // every preset quietly overstated its labeled window by one day.
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return { since: new Date(todayStart - (days - 1) * DAY_MS).toISOString(), until: new Date(tomorrowStart).toISOString() };
}

// The immediately-preceding period of the same length, for "change vs
// previous period" deltas — e.g. for the last 30 days, the 30 days before that.
export function previousPeriod(range: DateRange): DateRange {
  const sinceMs = new Date(range.since).getTime();
  const untilMs = new Date(range.until).getTime();
  const length = untilMs - sinceMs;
  return { since: new Date(sinceMs - length).toISOString(), until: new Date(sinceMs).toISOString() };
}
