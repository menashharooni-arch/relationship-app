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
//   contact_saved   someone saved their contact card      — high intent
//   card_view       one of their cards was opened         — batched, ≤1/hour
//   meeting_booked  a meeting was booked from their card
//   billing_problem a payment failed and access is at risk
//
// EXPLICITLY NOT: marketing, tips, product news, streaks, referral rewards,
// digests, "you're doing great" — none of it. Those go to the bell and to
// email, which the person reads when they choose to.
//
// A VIEW MILESTONE IS NOT A SIXTH CATEGORY. It still cannot cause a push: no
// milestone has ever rung a phone and none may. What it now does is retitle the
// card_view push THAT WAS ALREADY GOING OUT for the view that crossed it — same
// buzz, same category, same switch, one better headline ("50 views — on fire!"
// instead of "Card viewed"). Zero extra interruptions; see the note in
// /api/card-events where the two are folded together.
//
// WHY card_view REPLACED first_view. The rule used to be "the first time a card
// is EVER opened", enforced by a count === 1 check in the events route. That
// made a view push fire once in a card's entire lifetime: someone could share
// their card at a conference, collect forty views, and their phone would stay
// silent for all of them. Silence is its own failure — a product that never
// tells you it is working reads as a product that isn't — and "someone just
// opened your card" is the single best proof SwiftCard is earning its keep.
//
// The throttle below was always the right answer to the volume worry, and it
// was already built: at most one view push an hour, inside a five-a-day cap,
// and at most one per visitor per visit (lib/visit-notify.ts). Under a
// once-per-lifetime producer none of that machinery could ever engage. Now it
// does the job it was written for.
//
// NO PLAN GATE ANYWHERE IN THIS FILE. A Free account's first lead is the most
// important notification SwiftCard will ever send them; withholding it to make
// upgrading attractive is both hostile and self-defeating.

export type PushCategory =
  | "new_lead"
  | "lead_reply"
  | "contact_saved"
  | "card_view"
  | "meeting_booked"
  | "billing_problem";

export const PUSH_CATEGORIES: PushCategory[] = [
  "new_lead",
  "lead_reply",
  "contact_saved",
  "card_view",
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
  "contact_saved",
  "card_view",
  "billing_problem",
];

/** Copy shown in Settings. The label is what the person is agreeing to receive. */
export const PUSH_CATEGORY_COPY: Record<PushCategory, { label: string; hint: string }> = {
  new_lead: { label: "New contacts", hint: "Someone shares their details with you" },
  lead_reply: { label: "Replies", hint: "A contact answers one of your follow-ups" },
  // "downloaded", not "saved" — we hand the .vcf to the device and never learn
  // whether they tapped Add. Same honesty rule as the notification copy itself
  // (lib/card-event-notify.ts); the settings label must not claim more.
  contact_saved: { label: "Contact downloads", hint: "Someone downloads your contact card" },
  card_view: { label: "Card views", hint: "Someone opens one of your cards — at most one an hour" },
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
  contact_saved: true,
  card_view: true,
  meeting_booked: true,
  billing_problem: true,
};

export const DAILY_CAP = 5;          // excludes UNCAPPED categories
export const QUIET_START_HOUR = 22;  // 10pm local
export const QUIET_END_HOUR = 8;     // 8am local
/** How long quiet hours last, and therefore how far back the 8am catch-up looks. */
export const QUIET_WINDOW_MS = (24 - QUIET_START_HOUR + QUIET_END_HOUR) * 60 * 60 * 1000;
export const MAX_BODY_CHARS = 60;
// A lock-screen title truncates far earlier than the body — around 40
// characters on an iPhone, less with a long app name beside it. "New contact:
// Christopher Fairweather-Blenkinsop" is cut by the OS mid-surname; cutting it
// ourselves on a word boundary is the difference between a name and a stump.
export const MAX_TITLE_CHARS = 40;
export const VIEW_BATCH_MS = 60 * 60 * 1000; // ≤ 1 view ALERT an hour
// Inside that hour the extra views are not thrown away any more — they update
// the count on the banner already showing (mode "update" below), and this is how
// often that silent update is allowed to go out. Five minutes: fast enough that
// a card going off at an event feels live, slow enough that forty views in an
// hour cost APNs a dozen requests rather than forty.
export const VIEW_UPDATE_MIN_GAP_MS = 5 * 60 * 1000;
/** The collapse id every view-count update shares: ONE running counter, replaced in place. */
export const VIEW_ROLLUP_TAG = "views-hour";

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

/**
 * When quiet hours began for this person — the last 10pm in their own zone.
 *
 * The 8am catch-up looks back over exactly this span, and it has to be the real
 * boundary rather than `now − 10 hours`: a cron that fires at 8:00 and one that
 * is delayed to 8:40 must read the same night. Subtracting a fixed ten hours
 * would have made the late run silently skip the first forty minutes of it —
 * which, for a job that exists to rescue the 10:30pm lead, is the one part of
 * the night it cannot afford to miss.
 */
export function quietWindowStart(now: number, timezone: string | null | undefined): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
    }).formatToParts(new Date(now));
    const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    // formatToParts renders midnight as hour "24" in some ICU versions.
    const hour = at("hour") % 24;
    const sinceStart = ((hour - QUIET_START_HOUR + 24) % 24) * 3600 + at("minute") * 60 + at("second");
    return now - sinceStart * 1000;
  } catch {
    return now - QUIET_WINDOW_MS;
  }
}

export type PolicyInput = {
  category: PushCategory;
  prefs: PushPrefs;
  /** Pushes already sent today in CAPPED categories. */
  cappedSentToday: number;
  /** When the last card_view ALERT went out, for the hourly batch. */
  lastViewPushAt?: number | null;
  /** When the last silent view-count update went out, for its own throttle. */
  lastViewUpdateAt?: number | null;
  now?: number;
};

/**
 * How a push arrives.
 *
 *   alert  — the normal thing: a banner, a sound, the screen lights up.
 *   update — SILENT. Same notification, new text: it replaces the running
 *            view-count banner (VIEW_ROLLUP_TAG) with no sound and, on iOS, at
 *            interruption-level "passive", so the number climbs without the
 *            phone ever buzzing again. This is what "batched" used to throw
 *            away: at an event the owner got one alert an hour and no sense at
 *            all that their card was going off.
 */
export type PushMode = "alert" | "update";

export type PolicyResult =
  | { send: true; mode: PushMode }
  | { send: false; reason: "category_off" | "quiet_hours" | "daily_cap" | "batched" };

/**
 * The whole decision, pure so every rule is testable without a database.
 *
 * Order matters and is deliberate: an explicit switch-off beats everything, and
 * a billing problem still respects it — if someone turned billing pushes off,
 * that was their call and the email still goes.
 */
export function decidePush(input: PolicyInput): PolicyResult {
  const { category, prefs, cappedSentToday, lastViewPushAt, lastViewUpdateAt } = input;
  const now = input.now ?? Date.now();

  if (prefs[category] === false) return { send: false, reason: "category_off" };

  // NOTHING is exempt, billing included — and a silent count update is still
  // something arriving on a phone at 3am, so quiet hours are checked before the
  // view batch below rather than after it.
  //
  // I had carved out billing_problem on the theory that a failed payment is
  // urgent enough to wake someone. It isn't: Stripe retries a declined card
  // over several days, nobody loses access overnight, the email goes out
  // immediately either way, and at 3am there is nothing they can do that
  // 8am does not do just as well. A 3am banner would be the product's
  // convenience, not theirs.
  //
  // Nothing held here is LOST any more: /api/push/catchup announces it once, at
  // 8am in the person's own timezone, from the bell rows it left behind.
  if (prefs.quietHours !== false && inQuietHours(now, prefs.timezone)) {
    return { send: false, reason: "quiet_hours" };
  }

  // Batch the view notification: several people can open a card in the same
  // minute after one QR is printed on a sign, and that is one piece of news,
  // not eight. This is the throttle that lets every view be a candidate for a
  // push without a busy afternoon turning into a stream of interruptions.
  //
  // The extra views inside the hour used to be DROPPED. They now come back as a
  // silent update to the one running-count banner — no sound, no second buzz,
  // just a number that climbs while the card is being passed around. Held to
  // one update every VIEW_UPDATE_MIN_GAP_MS; past that it really is batched.
  if (category === "card_view" && lastViewPushAt && now - lastViewPushAt < VIEW_BATCH_MS) {
    if (lastViewUpdateAt && now - lastViewUpdateAt < VIEW_UPDATE_MIN_GAP_MS) {
      return { send: false, reason: "batched" };
    }
    // Deliberately ahead of the daily cap: the cap counts INTERRUPTIONS, and
    // this one cannot interrupt. It makes no sound and lights no screen.
    return { send: true, mode: "update" };
  }

  if (!UNCAPPED.includes(category) && cappedSentToday >= DAILY_CAP) {
    return { send: false, reason: "daily_cap" };
  }

  return { send: true, mode: "alert" };
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
