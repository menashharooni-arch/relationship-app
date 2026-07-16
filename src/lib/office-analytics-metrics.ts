// ── Office analytics — pure business-metric calculations ────────────────────
// Kept out of office-analytics.ts (which does the DB/RPC calls) so the actual
// formulas are reviewable and unit-testable in isolation, matching this
// codebase's convention (see tests/authz-negative.test.ts) of extracting the
// meaningful logic into plain, dependency-free functions.

// null (not 0 or Infinity) when there's no traffic to convert — a "0%"
// conversion rate reads as "nobody converted", which is misleading when the
// real story is "nobody has visited yet".
export function computeConversionRate(leads: number, totalViews: number): number | null {
  if (totalViews <= 0) return null;
  return leads / totalViews;
}

// null (not 0 or +Infinity) when there's no prior-period baseline to compare
// against — "new this period" is a different story than "0% change" or an
// undefined blow-up.
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

export type DailyPoint = { date: string; views: number };

// Zero-fills every UTC day in [sinceIso, untilIso) missing from `rows`, so a
// day-bucketed chart always renders an evenly spaced series — the aggregate
// SQL functions only return rows for days that actually had views.
export function fillDateRange(rows: DailyPoint[], sinceIso: string, untilIso: string): DailyPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r.views]));
  const since = new Date(sinceIso);
  const until = new Date(untilIso);
  let cursor = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const end = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  const out: DailyPoint[] = [];
  while (cursor < end) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    out.push({ date, views: byDate.get(date) ?? 0 });
    cursor += 24 * 60 * 60 * 1000;
  }
  return out;
}

export type SortableEmployeeRow = { leads: number; contactsSaved: number; name: string };

// The employee table's default ranking: leads, then contacts saved, then name.
// Deliberately NEVER ranks by raw views first — the task this dashboard was
// built for is explicit that raw traffic isn't "performance", conversions are.
export function defaultEmployeeSort<T extends SortableEmployeeRow>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.leads - a.leads || b.contactsSaved - a.contactsSaved || a.name.localeCompare(b.name)
  );
}
