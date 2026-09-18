// ── Asking again, at the one moment it is obviously worth it ─────────────────
//
// Owner, 2026-09-18: most people skip the notifications switch when they
// create their card. When something important then arrives — "Shantal shared
// her contact information with you" — the bell should say, right there, "turn
// on push notifications to get these on your phone". But "not on all their
// notifications, because it's going to be too spammy. After reminding them a
// few times, if they really don't want push notifications on, they don't want
// it on."
//
// So the rules, all of them here, pure, and applied by the server:
//
//   • ONLY the notifications worth a buzz: someone shared their details, a
//     contact replied, someone downloaded your contact card. Never a view —
//     the dashboard box already asks about views ("Your card is getting
//     opened"), and asking twice about the same thing is the spam.
//   • ONE ROW AT A TIME: the newest unread one of those, nothing else.
//   • AT MOST PUSH_ASK_MAX REMINDERS PER ACCOUNT, EVER, at least
//     PUSH_ASK_GAP_MS apart. Per ACCOUNT, not per device — a person who said no
//     on their phone has said no, and must not meet the same question again on
//     their laptop.
//   • NEVER when the account already receives pushes on any device, and never
//     again once they chose "Don't ask again", tapped "Don't Allow" at the
//     phone's own prompt, or switched push OFF themselves.
//
// The ledger lives on profiles.customization._pushAsk, written through
// mutateCustomization (read-back verified), next to — not inside — _push, whose
// shape the send path parses.

export const PUSH_ASK_KEY = "_pushAsk";

/** The notification types that may carry the ask. */
export const PUSH_ASK_TYPES = ["new_lead", "lead_reply", "contact_saved"] as const;

/** Reminders per account, ever. */
export const PUSH_ASK_MAX = 2;

/** Minimum time between two reminders. */
export const PUSH_ASK_GAP_MS = 3 * 24 * 60 * 60 * 1000;

/** An old unread notification is not "what just happened" — no ask on it. */
export const PUSH_ASK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type PushAskLedger = {
  /** Reminders shown so far. */
  n: number;
  /** When the latest one was first shown (ISO). */
  at: string | null;
  /** The notification it is attached to. */
  id: string | null;
  /** "Not now" was tapped on that one. */
  later: boolean;
  /** Never ask again. */
  stop: boolean;
};

const EMPTY: PushAskLedger = { n: 0, at: null, id: null, later: false, stop: false };

/** Normalise whatever is stored (or nothing) into a ledger. */
export function readPushAsk(raw: unknown): PushAskLedger {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  return {
    n: typeof r.n === "number" && Number.isFinite(r.n) && r.n > 0 ? Math.floor(r.n) : 0,
    at: typeof r.at === "string" ? r.at : null,
    id: typeof r.id === "string" ? r.id : null,
    later: r.later === true,
    stop: r.stop === true,
  };
}

export function isAskableType(type: string | null | undefined): boolean {
  return (PUSH_ASK_TYPES as readonly string[]).includes(type ?? "");
}

export type AskCandidateRow = { id: string; type: string; read: boolean; created_at: string };

/**
 * Which row, if any, may carry the ask: the NEWEST unread notification of an
 * askable type that is still recent. Everything else carries nothing.
 */
export function pickAskCandidate(rows: AskCandidateRow[], now: number = Date.now()): string | null {
  let best: AskCandidateRow | null = null;
  for (const r of rows) {
    if (r.read || !isAskableType(r.type)) continue;
    const at = Date.parse(r.created_at);
    if (!Number.isFinite(at) || now - at > PUSH_ASK_MAX_AGE_MS) continue;
    if (!best || at > Date.parse(best.created_at)) best = r;
  }
  return best?.id ?? null;
}

/**
 * May the ask be shown on notification `id` right now — and what does the
 * ledger become?
 *
 * The same notification keeps its ask (it is one reminder however often the
 * bell is opened) until "Not now". A DIFFERENT notification is a new reminder,
 * and only if the budget and the gap allow one. `next` is null when nothing
 * needs writing.
 */
export function decidePushAsk(
  ledger: PushAskLedger,
  id: string,
  now: number = Date.now(),
): { show: boolean; next: PushAskLedger | null } {
  if (ledger.stop) return { show: false, next: null };
  if (ledger.id === id) return { show: !ledger.later, next: null };
  if (ledger.n >= PUSH_ASK_MAX) return { show: false, next: null };
  if (ledger.at) {
    const last = Date.parse(ledger.at);
    if (Number.isFinite(last) && now - last < PUSH_ASK_GAP_MS) return { show: false, next: null };
  }
  return {
    show: true,
    next: { n: ledger.n + 1, at: new Date(now).toISOString(), id, later: false, stop: false },
  };
}

/** "Not now" on the reminder that is showing. Only that one — never a stale id. */
export function laterPushAsk(ledger: PushAskLedger, id: string): PushAskLedger | null {
  if (ledger.id !== id || ledger.later) return null;
  return { ...ledger, later: true };
}

/**
 * "Not now" on the DASHBOARD BOX. It is the same question, so it starts the
 * same quiet period — no reminder under a notification for PUSH_ASK_GAP_MS —
 * and retires any reminder still pending. Without this, "Not now" on the box
 * and opening the bell a second later was two asks in a row.
 */
export function snoozePushAsk(ledger: PushAskLedger, now: number = Date.now()): PushAskLedger | null {
  if (ledger.stop) return null;
  return { ...ledger, at: new Date(now).toISOString(), later: true };
}

/** Until when nothing may ask (box or reminder): PUSH_ASK_GAP_MS after the last ask. */
export function pushAskQuietUntil(ledger: PushAskLedger): number | null {
  if (!ledger.at) return null;
  const at = Date.parse(ledger.at);
  return Number.isFinite(at) ? at + PUSH_ASK_GAP_MS : null;
}

/** Never ask again. */
export function stopPushAsk(ledger: PushAskLedger): PushAskLedger | null {
  return ledger.stop ? null : { ...ledger, stop: true };
}

/** The ask's words, for the device it is on. */
export function pushAskCopy(onPhone: boolean): { title: string; sub: string } {
  return {
    title: onPhone ? "Get notifications like this on your phone" : "Get notifications like this on this computer",
    sub: "So you're alerted right away, even when SwiftCard is closed.",
  };
}
