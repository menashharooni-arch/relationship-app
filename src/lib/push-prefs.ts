import { mutateCustomization } from "@/lib/profile-customization";
import { readPushPrefs, type PushPrefs } from "@/lib/push-policy";

// ── Writing to profiles.customization._push without losing it ────────────────
//
// The push switches and the timezone quiet hours depend on live inside
// `profiles.customization`, a JSONB column several unrelated features share,
// and a writer holding a stale snapshot silently deletes whatever landed after
// it read. That is not theoretical: it erased the timezone on the first
// dashboard load of every new account. The whole story, and the verified
// read-back that fixes it, is in lib/profile-customization.ts.

export type PushPrefsWrite =
  | { ok: true; prefs: PushPrefs }
  | { ok: false };

/**
 * Apply `mutate` to this person's _push object and make sure it sticks.
 *
 * `mutate` is applied to a FRESH copy on every attempt, and a no-op mutation
 * short-circuits without writing at all.
 */
export async function writePushPrefs(
  userId: string,
  mutate: (push: Record<string, unknown>) => void,
): Promise<PushPrefsWrite> {
  const result = await mutateCustomization<Record<string, unknown>>(userId, "_push", (current) => {
    const push = { ...((current ?? {}) as Record<string, unknown>) };
    mutate(push);
    return push;
  });
  return result.ok ? { ok: true, prefs: readPushPrefs(result.customization) } : { ok: false };
}
