import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

// ── Hot / Warm / Cold: who to follow up with first ──────────────────────────
//
// docs/plans/warm-lead-alerts.md §2.5. ONE function, every weight in one
// object, so tuning is an edit here and nowhere else.
//
// WHAT COUNTS: only activity the server tied to this contact (lead_id stamped
// by lib/known-contact.ts — never a forwarded-link device, never a visit the
// owner marked "Wrong person?"), inside the last WINDOW_DAYS:
//   a return visit     each visit after the one they were captured in
//   a link tap         more for a booking or listing link (HIGH_INTENT_HOSTS)
//   a contact download they saved the owner's card again
//   an inbound reply   they answered a text or email
// Capturing the contact adds nothing: a brand-new lead is only warm once they
// come back.
//
// RECENCY: every item decays by half every HALF_LIFE_DAYS, and a tier also
// needs activity recent enough (maxDaysSinceLast), so a burst three weeks ago
// is not "Hot" today.
//
// HONESTY (standing rule for anything shown to an owner): the reason is built
// from COUNTS of real things, never from the score, and never invents a trend.
// Location is never an input — IP geolocation can't carry that weight, and a
// Free account can't see it anyway.

export const INTENT = {
  halfLifeDays: 7,
  windowDays: 30,
  weights: {
    return_visit: 3,
    link_tap: 2,
    high_intent_link_tap: 4,
    vcard_download: 3,
    inbound_reply: 5,
  },
  hot: { minScore: 8, maxDaysSinceLast: 3 },
  // 1.5, not the plan's first draft of 3: one return visit decays below 3
  // within a day, and someone coming back at all is exactly who "Warm" is
  // for. One return stays Warm for about a week.
  warm: { minScore: 1.5, maxDaysSinceLast: 14 },
} as const;

/** Booking and listing sites: a tap on one is a step toward a meeting (D9). */
export const HIGH_INTENT_HOSTS = [
  "calendly.com", "cal.com", "acuityscheduling.com", "savvycal.com", "tidycal.com",
  "youcanbook.me", "zcal.co", "meetings.hubspot.com", "koalendar.com", "doodle.com",
  "zillow.com", "realtor.com", "redfin.com", "trulia.com", "homes.com", "compass.com",
  "apartments.com", "loopnet.com", "crexi.com", "showingtime.com",
];

export function isHighIntentHost(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().replace(/^www\./, "");
  return !!h && HIGH_INTENT_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

export type IntentTier = "hot" | "warm" | "cold";

export type IntentInput = {
  /** leads.created_at — visits inside the capture visit don't count. */
  capturedAt: string;
  /** One timestamp per recorded visit (card_views rows, all their browsers). */
  visits: string[];
  taps: { at: string; host: string | null; label: string | null }[];
  downloads: string[];
  replies: string[];
};

export type IntentResult = {
  tier: IntentTier;
  /** For sorting only. Never shown: the reason is. */
  score: number;
  /** "viewed 4× this week, tapped Calendly" — null when there is nothing to say. */
  reason: string | null;
  lastEngagedAt: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function prettyLink(t: { host: string | null; label: string | null }): string {
  if (t.label?.trim()) return t.label.trim();
  const host = (t.host ?? "").replace(/^www\./, "");
  const name = host.split(".")[0] ?? host;
  return name ? name[0].toUpperCase() + name.slice(1) : "a link";
}

export function scoreContact(input: IntentInput, now = Date.now()): IntentResult {
  const { weights } = INTENT;
  const since = now - INTENT.windowDays * DAY;
  const captureVisitEnds = Date.parse(input.capturedAt) + VIEW_VISIT_WINDOW_MS;
  const decay = (at: number) => Math.pow(0.5, (now - at) / DAY / INTENT.halfLifeDays);
  const inWindow = (iso: string) => {
    const at = Date.parse(iso);
    return Number.isFinite(at) && at >= since && at <= now + 60_000 ? at : null;
  };

  let score = 0;
  let last = 0;
  const add = (at: number, w: number) => {
    score += w * decay(at);
    if (at > last) last = at;
  };

  const visits = input.visits.map(inWindow).filter((at): at is number => at !== null && at > captureVisitEnds);
  for (const at of visits) add(at, weights.return_visit);

  const taps = input.taps
    .map((t) => ({ ...t, at: inWindow(t.at) }))
    .filter((t): t is typeof t & { at: number } => t.at !== null);
  for (const t of taps) add(t.at, isHighIntentHost(t.host) ? weights.high_intent_link_tap : weights.link_tap);

  const downloads = input.downloads.map(inWindow).filter((at): at is number => at !== null && at > captureVisitEnds);
  for (const at of downloads) add(at, weights.vcard_download);

  const replies = input.replies.map(inWindow).filter((at): at is number => at !== null);
  for (const at of replies) add(at, weights.inbound_reply);

  const daysSinceLast = last ? (now - last) / DAY : Infinity;
  const tier: IntentTier =
    score >= INTENT.hot.minScore && daysSinceLast <= INTENT.hot.maxDaysSinceLast
      ? "hot"
      : score >= INTENT.warm.minScore && daysSinceLast <= INTENT.warm.maxDaysSinceLast
        ? "warm"
        : "cold";

  // ── The reason: the two biggest real things, as counts ──────────────────
  const weekAgo = now - 7 * DAY;
  const phrases: { weight: number; text: string }[] = [];
  if (replies.length) {
    phrases.push({ weight: replies.length * weights.inbound_reply, text: replies.length === 1 ? "replied to you" : `replied ${replies.length}×` });
  }
  if (visits.length) {
    const thisWeek = visits.filter((at) => at >= weekAgo).length;
    const text = thisWeek
      ? `viewed ${thisWeek}× this week`
      : `viewed ${visits.length}× this month`;
    phrases.push({ weight: visits.length * weights.return_visit, text });
  }
  if (taps.length) {
    const best = [...taps].sort((a, b) =>
      Number(isHighIntentHost(b.host)) - Number(isHighIntentHost(a.host)) || b.at - a.at)[0];
    const others = new Set(taps.map(prettyLink)).size - 1;
    phrases.push({
      weight: taps.reduce((w, t) => w + (isHighIntentHost(t.host) ? weights.high_intent_link_tap : weights.link_tap), 0),
      text: `tapped ${prettyLink(best)}${others > 0 ? ` +${others}` : ""}`,
    });
  }
  if (downloads.length) {
    phrases.push({ weight: downloads.length * weights.vcard_download, text: "saved your contact" });
  }
  const reason = phrases.sort((a, b) => b.weight - a.weight).slice(0, 2).map((p) => p.text).join(", ") || null;

  return {
    tier,
    score: Math.round(score * 10) / 10,
    reason,
    lastEngagedAt: last ? new Date(last).toISOString() : null,
  };
}

/** Follow up first: hottest tier, then most recently engaged, then score. */
export function compareIntent(a: IntentResult, b: IntentResult): number {
  const rank: Record<IntentTier, number> = { hot: 2, warm: 1, cold: 0 };
  return (
    rank[b.tier] - rank[a.tier] ||
    (Date.parse(b.lastEngagedAt ?? "") || 0) - (Date.parse(a.lastEngagedAt ?? "") || 0) ||
    b.score - a.score
  );
}
