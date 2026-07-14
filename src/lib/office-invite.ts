// Shared invitation constants + expiry helpers so the invite, join, decline, and
// dashboard-display code all agree on the 14-day window.

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// True if a pending invite has passed its acceptance window. Prefers the stored
// expires_at (set on invite creation once the migration is run); falls back to
// created_at + TTL for older rows / pre-migration.
export function isInviteExpired(
  row: { status?: string | null; expires_at?: string | null; created_at?: string | null },
  now: number = Date.now(),
): boolean {
  if (row.status && row.status !== "pending") return false; // only pending invites "expire"
  const exp = row.expires_at ? new Date(row.expires_at).getTime()
    : row.created_at ? new Date(row.created_at).getTime() + INVITE_TTL_MS
    : NaN;
  if (Number.isNaN(exp)) return false;
  return now > exp;
}

// Whole days until a pending invite expires (0 if already expired). For display.
export function inviteDaysLeft(
  row: { expires_at?: string | null; created_at?: string | null },
  now: number = Date.now(),
): number {
  const exp = row.expires_at ? new Date(row.expires_at).getTime()
    : row.created_at ? new Date(row.created_at).getTime() + INVITE_TTL_MS
    : NaN;
  if (Number.isNaN(exp)) return 0;
  return Math.max(0, Math.ceil((exp - now) / (24 * 60 * 60 * 1000)));
}
