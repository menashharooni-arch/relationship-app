import type { SupabaseClient } from "@supabase/supabase-js";

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

// Increment one monthly counter and persist it back onto the profile, preserving
// every other customization key. Returns the NEW value. Not strictly atomic
// (two simultaneous captures could under-count by one) — fine for a monthly
// courtesy cap. Best-effort: a write failure never blocks the caller's action.
export async function bumpUsage(
  admin: SupabaseClient,
  userId: string,
  customization: Record<string, unknown> | null | undefined,
  key: UsageKey,
  by = 1,
): Promise<number> {
  const cur = readUsage(customization);
  const next: UsageBlock = { ...cur, [key]: cur[key] + by };
  try {
    await admin.from("profiles").update({ customization: { ...(customization ?? {}), _usage: next } }).eq("id", userId);
  } catch { /* best-effort */ }
  return next[key];
}
