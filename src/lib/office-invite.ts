// Shared invitation constants + expiry helpers so the invite, join, decline, and
// dashboard-display code all agree on the 14-day window.

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// True if a pending invite has passed its acceptance window. Prefers the stored
// expires_at (set on invite creation once the migration is run); falls back to
// invited_at + TTL for older rows / pre-migration.
//
// NOTE: the column on office_members is `invited_at` (default now()) — there is
// no created_at on that table. Selecting one made PostgREST fail the WHOLE
// query, which silently emptied the admin Team list and the pending-seat count.
export function isInviteExpired(
  row: { status?: string | null; expires_at?: string | null; invited_at?: string | null },
  now: number = Date.now(),
): boolean {
  if (row.status && row.status !== "pending") return false; // only pending invites "expire"
  const exp = row.expires_at ? new Date(row.expires_at).getTime()
    : row.invited_at ? new Date(row.invited_at).getTime() + INVITE_TTL_MS
    : NaN;
  if (Number.isNaN(exp)) return false;
  return now > exp;
}

// Whole days until a pending invite expires (0 if already expired). For display.
export function inviteDaysLeft(
  row: { expires_at?: string | null; invited_at?: string | null },
  now: number = Date.now(),
): number {
  const exp = row.expires_at ? new Date(row.expires_at).getTime()
    : row.invited_at ? new Date(row.invited_at).getTime() + INVITE_TTL_MS
    : NaN;
  if (Number.isNaN(exp)) return 0;
  return Math.max(0, Math.ceil((exp - now) / (24 * 60 * 60 * 1000)));
}
