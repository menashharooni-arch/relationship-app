import { getAdminSupabase } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

// ONE NOTIFICATION PER PERSON, PER CARD, PER VISIT.
//
// The rule the owner actually wants: "someone views my card, I get one
// notification about that, not two." Before this file, a single person on a
// single visit could ring the owner's phone three times — the view, the
// milestone it happened to cross, and the contact save thirty seconds later —
// because each of those was written by a different piece of code that only
// ever deduped against ITSELF.
//
// So dedupe moved off the event and onto the VISIT. Every notification a
// visitor can cause carries the same visit_key; the partial unique index on
// that column (supabase/notifications-visit-key.sql) means the second one
// physically cannot insert. It upgrades the row that exists instead:
//
//   viewed your card  →  saved your contact card  →  shared their info
//
// and re-pushes under the SAME collapse id, so the lock screen REPLACES the
// banner rather than adding one. The owner ends a visit with exactly one
// notification, showing the furthest that person got.

/** How newsworthy an event is. A visit only ever moves up this list. */
export const VISIT_RANK: Record<string, number> = {
  card_viewed: 1,
  milestone: 2,
  contact_saved: 3,
  new_lead: 4,
};

export type VisitIdentity = {
  cardOwner: string;
  visitorId?: string | null;
  ip?: string | null;
  now?: number;
};

/**
 * The visit a piece of activity belongs to — plus the one before it.
 *
 * Same 30-minute length as the view counter (view-window.ts) so the bell, the
 * traffic chart and the lock screen can never disagree about whether two
 * touches were one visit. Anonymous visitors fall back to their IP: coarser,
 * but a visitor with no id is exactly the case where two events would
 * otherwise both notify.
 *
 * WHY TWO KEYS: the row dedupes elsewhere slide (now − 30min), but a key has
 * to be a fixed string to be unique-indexed, so it buckets on wall-clock
 * boundaries. A visitor who views at 10:29 and saves at 10:31 would land in
 * two different buckets and notify twice — every visit straddling :00 or :30
 * would duplicate, by construction. So the caller also checks the PREVIOUS
 * bucket and joins that visit when its notification is still inside the
 * window. That makes the window slide while the key stays indexable.
 */
export function visitKeys(opts: VisitIdentity): { current: string; previous: string } {
  const who = (opts.visitorId ?? "").trim() || `ip:${(opts.ip ?? "unknown").trim()}`;
  const bucket = Math.floor((opts.now ?? Date.now()) / VIEW_VISIT_WINDOW_MS);
  const key = (b: number) => `${opts.cardOwner.toLowerCase()}:${who}:${b}`;
  return { current: key(bucket), previous: key(bucket - 1) };
}

/** The visit key for a piece of activity, ignoring the boundary lookback. */
export function visitKey(opts: VisitIdentity): string {
  return visitKeys(opts).current;
}

// APNs caps apns-collapse-id at 64 bytes and a visit key can exceed that
// (visitor ids are up to 64 chars on their own), so the push tag is a short
// stable hash of the key. Same value on every push for the visit — that is the
// whole point: iOS replaces a banner carrying a collapse id it already showed.
export function visitPushTag(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `visit-${h.toString(36)}`;
}

export type VisitNotice = {
  /** notifications.type — also the VISIT_RANK lookup ("milestone_5" ranks as "milestone"). */
  type: string;
  title: string;
  body: string;
  /** Deep link for the push tap. */
  url: string;
  /**
   * Lock-screen wording when it differs from the bell row. A new lead reads
   * "Ali Khan shared their info with you" in the bell but shows their phone
   * number on the lock screen, where the useful thing is the number itself.
   */
  pushBody?: string;
  /** Attach a one-tap "Save contact" vCard to the push. */
  vcardUrl?: string;
};

function rankOf(type: string): number {
  if (type.startsWith("milestone_")) return VISIT_RANK.milestone;
  return VISIT_RANK[type] ?? 0;
}

export type VisitNotifyResult = "created" | "upgraded" | "suppressed" | "failed";

type OpenVisit = { id: string; type: string; visit_key: string };

// The visit this person already has open on this card, if any: a notification
// under either the current or the previous bucket whose timestamp is still
// inside the window. Returns null when the column isn't migrated yet, which
// degrades the whole file to insert-and-push (i.e. the old behaviour).
async function openVisit(
  admin: ReturnType<typeof getAdminSupabase>,
  keys: { current: string; previous: string },
  now: number,
): Promise<OpenVisit | null> {
  const { data } = await admin
    .from("notifications")
    .select("id, type, visit_key, created_at")
    .in("visit_key", [keys.current, keys.previous])
    .gte("created_at", new Date(now - VIEW_VISIT_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  return row ? { id: row.id as string, type: row.type as string, visit_key: row.visit_key as string } : null;
}

/**
 * Tell the owner about one thing a visitor did — at most once per visit.
 *
 * Returns what happened, which callers use to decide whether to fire their own
 * side effects (a CRM mirror still fires per event; a push does not).
 *
 * Degrades safely: if the visit_key column hasn't been migrated yet, this falls
 * back to plain insert-and-push, i.e. exactly the old behaviour.
 */
export async function notifyVisit(opts: {
  userId: string;
  cardOwner: string;
  visitorId?: string | null;
  ip?: string | null;
  notice: VisitNotice;
  now?: number;
}): Promise<VisitNotifyResult> {
  const admin = getAdminSupabase();
  const { notice } = opts;
  const now = opts.now ?? Date.now();
  const keys = visitKeys({ cardOwner: opts.cardOwner, visitorId: opts.visitorId, ip: opts.ip, now });

  // Join the visit already in progress when this person's last notification is
  // still inside the window — even if the clock has since crossed a bucket
  // boundary. Otherwise start a new one.
  const open = await openVisit(admin, keys, now);
  const key = open?.visit_key ?? keys.current;
  const tag = visitPushTag(key);

  const push = async () => {
    await sendPushToUser(opts.userId, {
      title: notice.title,
      body: notice.pushBody ?? notice.body,
      url: notice.url,
      ...(notice.vcardUrl ? { vcardUrl: notice.vcardUrl } : {}),
      // Same tag for every notification in this visit → the messenger replaces
      // the banner instead of stacking a second one.
      tag,
    }).catch(() => { /* a dead subscription must never fail the event */ });
  };

  const row = {
    user_id: opts.userId,
    card_owner: opts.cardOwner,
    type: notice.type,
    title: notice.title,
    body: notice.body,
    visit_key: key,
  };

  // Known open visit: upgrade it, or stay quiet. No second row, no second buzz.
  if (open) {
    if (rankOf(notice.type) <= rankOf(open.type)) return "suppressed";
    return (await upgrade(admin, open.id, notice)) ? (await push(), "upgraded") : "failed";
  }

  const { error } = await admin.from("notifications").insert(row);
  if (!error) {
    await push();
    return "created";
  }

  const code = (error as { code?: string } | null)?.code;

  // Column not migrated yet — behave exactly as before the visit ledger existed.
  if (code === "42703" || code === "PGRST204") {
    const { visit_key: _unused, ...legacy } = row;
    void _unused;
    const { error: retryError } = await admin.from("notifications").insert(legacy);
    if (retryError) return "failed";
    await push();
    return "created";
  }

  // 23505 = a concurrent request opened this visit between the lookup above and
  // this insert. The unique index is the race backstop; fall into the same
  // upgrade-or-stay-quiet path rather than writing a second row.
  if (code === "23505") {
    const { data: existing } = await admin
      .from("notifications")
      .select("id, type")
      .eq("visit_key", key)
      .maybeSingle();
    if (!existing) return "failed";
    if (rankOf(notice.type) <= rankOf(existing.type as string)) return "suppressed";
    return (await upgrade(admin, existing.id as string, notice)) ? (await push(), "upgraded") : "failed";
  }

  return "failed";
}

/** Rewrite the visit's notification to say the newer, bigger thing. */
async function upgrade(
  admin: ReturnType<typeof getAdminSupabase>,
  id: string,
  notice: VisitNotice,
): Promise<boolean> {
  const { error } = await admin
    .from("notifications")
    .update({
      type: notice.type,
      title: notice.title,
      body: notice.body,
      read: false,
      // Sorts back to the top of the bell: this visit just became news again.
      created_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}
