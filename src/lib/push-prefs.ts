import { getAdminSupabase } from "@/lib/supabase-admin";
import { readPushPrefs, type PushPrefs } from "@/lib/push-policy";

// ── Writing to profiles.customization._push without losing it ────────────────
//
// The push switches and the timezone quiet hours depend on live inside
// `profiles.customization`, a JSONB column several unrelated features share.
// PostgREST has no partial JSONB update, so every writer does read-modify-write
// on the WHOLE object — and a writer holding a stale snapshot silently deletes
// whatever landed after it read.
//
// This is not theoretical. On the first dashboard load of a new account the
// server runs two one-time migrations (ensureUserCards, backfillCardPhotos)
// that each rewrite `customization` from the snapshot the page rendered with,
// while the browser reports its timezone from the same page. Measured against a
// real production build: the PATCH returned 200, the client remembered "already
// reported", and `_push` was gone — the account kept a UTC quiet-hours window
// for good, which is the exact bug the timezone reporting exists to fix.
//
// So every _push write goes through here, and here READS BACK what it wrote.
// A lost write is retried against the fresh object instead of being reported as
// a success. The migrations were fixed too (they now merge from a fresh read),
// which closes the same window from the other side; this is the half that
// cannot be forgotten by a future writer.

const MAX_ATTEMPTS = 3;

export type PushPrefsWrite =
  | { ok: true; prefs: PushPrefs }
  | { ok: false };

/**
 * Apply `mutate` to this person's _push object and make sure it sticks.
 *
 * `mutate` must be pure-ish and idempotent: it is applied to a FRESH copy on
 * every attempt, and a no-op mutation short-circuits without writing at all.
 */
export async function writePushPrefs(
  userId: string,
  mutate: (push: Record<string, unknown>) => void,
): Promise<PushPrefsWrite> {
  const admin = getAdminSupabase();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data } = await admin
      .from("profiles").select("customization").eq("id", userId).maybeSingle();
    const customization = (data?.customization ?? {}) as Record<string, unknown>;
    const push = { ...((customization._push ?? {}) as Record<string, unknown>) };

    const before = JSON.stringify(push);
    mutate(push);
    const wanted = JSON.stringify(push);

    // Nothing to write. The common case by far: the browser reports the same
    // timezone on every load, and rewriting a shared column to store what it
    // already holds is a pointless write and a pointless chance to clobber.
    if (wanted === before) return { ok: true, prefs: readPushPrefs(customization) };

    const { error } = await admin
      .from("profiles")
      .update({ customization: { ...customization, _push: push } })
      .eq("id", userId);
    if (error) return { ok: false };

    const { data: after } = await admin
      .from("profiles").select("customization").eq("id", userId).maybeSingle();
    const stored = ((after?.customization ?? {}) as Record<string, unknown>)._push ?? {};
    if (JSON.stringify(stored) === wanted) {
      return { ok: true, prefs: readPushPrefs(after?.customization) };
    }
    // Someone else rewrote the column underneath us. Go round again against
    // what is actually there now.
  }

  return { ok: false };
}
