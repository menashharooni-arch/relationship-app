// ── What may become a push notification, and when ───────────────────────────
//
// A push is the most expensive message we can send: it interrupts. The moment
// one arrives that did not need to, the switch goes off and every future
// notification is lost with it — including the one that was worth £5,000 of
// commission. So the list of things allowed to buzz a phone is short, closed,
// and lives here.
//
// ALLOWED, and nothing else:
//   new_lead        someone shared their details          — the whole product
//   lead_reply      a lead answered a follow-up           — a live conversation
//   first_view      their card was opened for the 1st time — batched, ≤1/hour
//   meeting_booked  a meeting was booked from their card
//   billing_problem a payment failed and access is at risk
//
// EXPLICITLY NOT: marketing, tips, product news, view milestones, streaks,
// referral rewards, digests, "you're doing great" — none of it. Those go to the
// bell and to email, which the person reads when they choose to.
//
// NO PLAN GATE ANYWHERE IN THIS FILE. A Free account's first lead is the most
// important notification SwiftCard will ever send them; withholding it to make
// upgrading attractive is both hostile and self-defeating.

export type PushCategory =
  | "new_lead"
  | "lead_reply"
  | "first_view"
  | "meeting_booked"
  | "billing_problem";

export const PUSH_CATEGORIES: PushCategory[] = [
  "new_lead",
  "lead_reply",
  "first_view",
  "meeting_booked",
  "billing_problem",
];

/**
 * Categories that something in the product can actually FIRE today.
 *
 * `meeting_booked` is deliberately absent. SwiftCard has no booking feature —
 * a card can carry a Calendly link, but the booking happens on Calendly and
 * nothing tells us about it. The rule is written, tested and ready, and the
 * category is left out of Settings until there is a producer: a switch that can
 * never change anything is worse than no switch, because it implies a feature.
 */
export const LIVE_CATEGORIES: PushCategory[] = [
  "new_lead",
  "lead_reply",
  "first_view",
  "billing_problem",
];

/** Copy shown in Settings. The label is what the person is agreeing to receive. */
export const PUSH_CATEGORY_COPY: Record<PushCategory, { label: string; hint: string }> = {
  new_lead: { label: "New contacts", hint: "Someone shares their details with you" },
  lead_reply: { label: "Replies", hint: "A contact answers one of your follow-ups" },
  first_view: { label: "First view of a card", hint: "The first time a card is opened — at most once an hour" },
  meeting_booked: { label: "Meetings booked", hint: "Someone books time with you from your card" },
  billing_problem: { label: "Billing problems", hint: "A payment failed and your plan is at risk" },
  // NOTE: quiet hours apply to this one too — see decidePush().
};

/**
 * Categories that ignore the daily cap.
 *
 * A lead and a failed payment are the two things a person would be angry to
 * have withheld. Everything else is capped, so a busy day can never turn into
 * a stream of interruptions.
 */
export const UNCAPPED: PushCategory[] = ["new_lead", "lead_reply", "billing_problem"];

/** Everything on by default. Switching one off is a decision the person makes. */
export const DEFAULT_PUSH_PREFS: Record<PushCategory, boolean> = {
  new_lead: true,
  lead_reply: true,
  first_view: true,
  meeting_booked: true,
  billing_problem: true,
};

export const DAILY_CAP = 5;          // excludes UNCAPPED categories
export const QUIET_START_HOUR = 22;  // 10pm local
export const QUIET_END_HOUR = 8;     // 8am local
export const MAX_BODY_CHARS = 60;
// A lock-screen title truncates far earlier than the body — around 40
// characters on an iPhone, less with a long app name beside it. "New contact:
// Christopher Fairweather-Blenkinsop" is cut by the OS mid-surname; cutting it
// ourselves on a word boundary is the difference between a name and a stump.
export const MAX_TITLE_CHARS = 40;
export const FIRST_VIEW_BATCH_MS = 60 * 60 * 1000; // ≤ 1 first-view push an hour

export type PushPrefs = Record<PushCategory, boolean> & { quietHours?: boolean; timezone?: string | null };

/** Read the per-category switches out of profiles.customization. */
export function readPushPrefs(customization: unknown): PushPrefs {
  const c = (customization ?? {}) as Record<string, unknown>;
  const stored = (c._push ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PUSH_PREFS } as PushPrefs;
  for (const cat of PUSH_CATEGORIES) {
    if (typeof stored[cat] === "boolean") out[cat] = stored[cat] as boolean;
  }
  // Quiet hours are ON unless deliberately switched off.
  out.quietHours = stored.quietHours !== false;
  out.timezone = typeof stored.timezone === "string" ? stored.timezone : null;
  return out;
}

/**
 * The local hour for a person, from an IANA timezone.
 *
 * Falls back to UTC when we have not learned their zone yet. That is the honest
 * failure: a wrong quiet-hours window is better than none, and the browser
 * reports the zone the first time they open the app.
 */
export function localHour(now: number, timezone: string | null | undefined): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "numeric",
      hour12: false,
    });
    return Number(fmt.format(new Date(now)));
  } catch {
    return new Date(now).getUTCHours();
  }
}

/** 10pm–8am in the person's own timezone. */
export function inQuietHours(now: number, timezone: string | null | undefined): boolean {
  const h = localHour(now, timezone);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

export type PolicyInput = {
  category: PushCategory;
  prefs: PushPrefs;
  /** Pushes already sent today in CAPPED categories. */
  cappedSentToday: number;
  /** When the last first_view push went out, for the hourly batch. */
  lastFirstViewAt?: number | null;
  now?: number;
};

export type PolicyResult =
  | { send: true }
  | { send: false; reason: "category_off" | "quiet_hours" | "daily_cap" | "batched" };

/**
 * The whole decision, pure so every rule is testable without a database.
 *
 * Order matters and is deliberate: an explicit switch-off beats everything, and
 * a billing problem still respects it — if someone turned billing pushes off,
 * that was their call and the email still goes.
 */
export function decidePush(input: PolicyInput): PolicyResult {
  const { category, prefs, cappedSentToday, lastFirstViewAt } = input;
  const now = input.now ?? Date.now();

  if (prefs[category] === false) return { send: false, reason: "category_off" };

  // Batch the first-view notification: several people can open a card in the
  // same minute after one QR is printed on a sign, and that is one piece of
  // news, not eight.
  if (category === "first_view" && lastFirstViewAt && now - lastFirstViewAt < FIRST_VIEW_BATCH_MS) {
    return { send: false, reason: "batched" };
  }

  // NOTHING is exempt, billing included.
  //
  // I had carved out billing_problem on the theory that a failed payment is
  // urgent enough to wake someone. It isn't: Stripe retries a declined card
  // over several days, nobody loses access overnight, the email goes out
  // immediately either way, and at 3am there is nothing they can do that
  // 8am does not do just as well. A 3am banner would be the product's
  // convenience, not theirs.
  if (prefs.quietHours !== false && inQuietHours(now, prefs.timezone)) {
    return { send: false, reason: "quiet_hours" };
  }

  if (!UNCAPPED.includes(category) && cappedSentToday >= DAILY_CAP) {
    return { send: false, reason: "daily_cap" };
  }

  return { send: true };
}

/**
 * Trim a body to the notification budget.
 *
 * iOS shows roughly this much on a lock screen before truncating mid-word, and
 * a sentence cut by the OS reads as broken software. Cutting on a word boundary
 * ourselves is the difference between "Dana Whitfield shared their…" and
 * "Dana Whitfield shared their in".
 */
export function fitBody(body: string, max: number = MAX_BODY_CHARS): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:.\s]+$/, "")}…`;
}
