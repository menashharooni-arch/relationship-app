import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateCustomization } from "@/lib/profile-customization";

// ── Monthly free-plan usage meters ───────────────────────────────────────────
// Free plans get a set number of leads / AI drafts PER MONTH that refresh on the
// 1st. The counters live on the ACCOUNT (profiles.customization._usage), NOT the
// card — so deleting or remaking a card can never reset them. The period is a
// UTC year-month string; when it rolls over, everything reads as 0 again.
//
// There is no "scans" meter: the card scanner is Pro-only (unlimited), so there
// is nothing to count. Old rows may still carry a stale `scans` key — it's
// simply ignored on read and dropped on the next write.

export type UsageKey = "leads" | "drafts";
export type UsageBlock = { period: string; leads: number; drafts: number };

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Read this account's usage for the CURRENT month. A stale (previous-month)
// block reads as all-zero — that's the monthly reset, no cron needed.
export function readUsage(customization: unknown): UsageBlock {
  const period = currentPeriod();
  const u = (customization as { _usage?: Partial<UsageBlock> } | null)?._usage;
  if (!u || u.period !== period) return { period, leads: 0, drafts: 0 };
  return { period, leads: u.leads ?? 0, drafts: u.drafts ?? 0 };
}

// Increment one monthly counter and persist it back onto the profile.
//
// THE COUNT ONLY EVER GOES UP, and that is the whole point: a contact that was
// added is spent whether or not it is still there. Deleting one has never given
// a slot back (the meter is on the ACCOUNT, not a row count), and nothing here
// decrements — save-it-to-your-phone-then-delete-it buys nothing.
//
// The read-modify-write goes through mutateCustomization, which reads back what
// it wrote and retries against fresh data. `customization` is a column several
// features share; a writer with a stale snapshot can erase a key outright, and
// for this key that would hand someone a whole free month. The passed-in
// snapshot is now only a HINT for the caller's convenience — the number that
// gets stored is computed from what is actually in the database at write time,
// so two captures landing together can no longer settle on the same value.
//
// Best-effort in the sense that a write failure never blocks the caller's
// action: a lead is the product, and losing one to a counter would be worse
// than an uncounted contact.
export async function bumpUsage(
  admin: SupabaseClient,
  userId: string,
  customization: Record<string, unknown> | null | undefined,
  key: UsageKey,
  by = 1,
): Promise<number> {
  // THE HIGH-WATER MARK. Every value we have seen for this counter this month,
  // including the caller's own snapshot. A retry recomputes from whatever is in
  // the database NOW — and if the reason for the retry was another writer
  // wiping the key, "now" is zero. Counting up from zero would silently give
  // the month back, which is the one thing this meter must never do. So the
  // write is always floor + by, and the floor only ever rises.
  let floor = readUsage(customization)[key];
  let stored = floor + by;
  try {
    const result = await mutateCustomization<UsageBlock>(
      userId,
      "_usage",
      (current) => {
        // `current` is the live row, not the caller's snapshot — and readUsage
        // turns last month's block into zeroes, which IS the monthly reset, so
        // the floor is only ever applied within the same period.
        const cur = readUsage({ _usage: current });
        floor = Math.max(floor, cur[key]);
        const next: UsageBlock = { ...cur, [key]: floor + by };
        stored = next[key];
        return next;
      },
      admin,
    );
    if (!result.ok) stored = floor + by;
  } catch { /* best-effort */ }
  return stored;
}
