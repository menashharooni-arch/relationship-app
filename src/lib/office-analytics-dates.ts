// ── Office analytics date ranges — UTC calendar days throughout ─────────────
// No per-office timezone setting exists anywhere in the app (every other
// date-bucket in the codebase, e.g. office-team.ts's monthStartIso, already
// uses UTC), so this dashboard follows the same convention rather than
// inventing a new one. `until` is always EXCLUSIVE — the start of the day
// after the range's last included day — so every query can filter with a
// plain `< until` and never needs a time-of-day component.

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
): DateRange {
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

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return { since: new Date(todayStart - days * DAY_MS).toISOString(), until: new Date(tomorrowStart).toISOString() };
}

// The immediately-preceding period of the same length, for "change vs
// previous period" deltas — e.g. for the last 30 days, the 30 days before that.
export function previousPeriod(range: DateRange): DateRange {
  const sinceMs = new Date(range.since).getTime();
  const untilMs = new Date(range.until).getTime();
  const length = untilMs - sinceMs;
  return { since: new Date(sinceMs - length).toISOString(), until: new Date(sinceMs).toISOString() };
}
