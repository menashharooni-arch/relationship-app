// ── When is an agent due, and did it actually run? ──────────────────────────
//
// Schedules are written in the owner's own timezone (ET) and support:
//   daily@17:30          one time a day
//   daily@12:00,17:00    several times a day  ← Atlas's midday + end-of-day
//   every@4h             every N hours, on the hour
//
// THE BUG THIS REPLACES: dispatch used to ask "does NOW fall inside a ±30-minute
// window around the due time?" That is only correct if the dispatcher actually
// runs every 30 minutes. It didn't — GitHub's cron is best-effort and was firing
// every 2.5–5 hours, so windows were missed outright and the run never happened
// at all. Vera was skipped for a whole day that way, silently.
//
// So the question is now "is it PAST the due time, and has this agent not run
// since?" That is catch-up semantics: a late dispatcher produces a late run
// instead of no run. A missed report is a bug; a report at 12:04 instead of
// 12:00 is not.

/** Wall-clock hour/minute in New York, DST-correct. */
export function nyHourMinute(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  return {
    h: Number(parts.find((p) => p.type === "hour").value) % 24,
    m: Number(parts.find((p) => p.type === "minute").value),
  };
}

/**
 * Every time this schedule is due TODAY, as minutes past ET midnight, ascending.
 * Returns [] for an unparseable or empty schedule.
 */
export function dueTimesToday(schedule) {
  if (!schedule) return [];
  const s = String(schedule).trim();

  const every = s.match(/^every@(\d{1,2})h$/);
  if (every) {
    const n = Number(every[1]);
    if (!n || n > 24) return [];
    const out = [];
    for (let h = 0; h < 24; h += n) out.push(h * 60);
    return out;
  }

  const daily = s.match(/^daily@(.+)$/);
  if (daily) {
    const times = daily[1].split(",").map((t) => t.trim()).filter(Boolean);
    const out = [];
    for (const t of times) {
      const hm = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!hm) continue;
      const h = Number(hm[1]), m = Number(hm[2]);
      if (h > 23 || m > 59) continue;
      out.push(h * 60 + m);
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }

  return [];
}

/**
 * Should this agent be dispatched right now?
 *
 * True when the most recent due time that has already passed today has no run
 * after it. `lastRunAt` is an ISO string or null.
 *
 * `graceMin` stops a very old miss from firing hours later: if the whole day's
 * dispatching was down, we don't want a 12:00 report arriving at 23:00 — it
 * would be stale and confusing. Late is fine; wrong-day late is not.
 */
export function isDue(schedule, lastRunAt, now = new Date(), graceMin = 180) {
  const times = dueTimesToday(schedule);
  if (!times.length) return false;
  const { h, m } = nyHourMinute(now);
  const minsNow = h * 60 + m;

  // The latest due time that has already passed today.
  const passed = times.filter((t) => t <= minsNow);
  if (!passed.length) return false;
  const target = passed[passed.length - 1];

  // Too long ago to still be worth sending.
  if (minsNow - target > graceMin) return false;

  if (!lastRunAt) return true;

  // Did the last run happen after that due time, on this same ET day?
  const last = new Date(lastRunAt);
  if (Number.isNaN(last.getTime())) return true;
  const lastNy = nyHourMinute(last);
  const sameEtDay = etDayStamp(last) === etDayStamp(now);
  if (!sameEtDay) return true; // last run was a different day → today's is owed
  return (lastNy.h * 60 + lastNy.m) < target;
}

/** YYYY-MM-DD in New York — the day boundary the owner's schedules live on. */
export function etDayStamp(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** Which of today's due times this dispatch is FOR — lets a report label itself. */
export function currentSlot(schedule, now = new Date()) {
  const times = dueTimesToday(schedule);
  const { h, m } = nyHourMinute(now);
  const minsNow = h * 60 + m;
  const passed = times.filter((t) => t <= minsNow);
  if (!passed.length) return null;
  const target = passed[passed.length - 1];
  return { minutes: target, label: `${String(Math.floor(target / 60)).padStart(2, "0")}:${String(target % 60).padStart(2, "0")}` };
}
