import { getAdminSupabase } from "@/lib/supabase-admin";
import { isInviteExpired } from "@/lib/office-invite";

// ── A team invite is for ONE address ────────────────────────────────────────
// Owner, 2026-09-24: "If the admin sent the sub-user the link to create their
// card, they sent a specific email address and they want it to be on that
// email address … there really shouldn't be a login button." So the invite
// offers one way in, fixed to the invited address: Create my account — or,
// only when that address ALREADY has a SwiftCard account (creating it again
// would fail), Sign in. Never a choice between the two.

/**
 * Does the invited address already have an account? Asked only about the
 * address stored on an invite row (never one a visitor typed), through a
 * service-role-only function. Any failure answers false: the create path is
 * the right default for an invite, and LoginForm catches "already registered"
 * and turns that one form into the sign-in for the same address.
 */
export async function invitedEmailHasAccount(email: string | null | undefined): Promise<boolean> {
  const addr = email?.trim().toLowerCase();
  if (!addr) return false;
  try {
    const { data, error } = await getAdminSupabase().rpc("auth_email_registered", { p_email: addr });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * The invited address behind a `/join/<token>` destination, when that invite
 * can still be accepted. /login uses it to fix the email field to the invited
 * address. The token is the invite's secret; whoever holds the link already
 * sees this address on the /join page itself.
 */
export async function inviteEmailForNext(next: string | null | undefined): Promise<string | null> {
  const m = /^\/join\/([A-Za-z0-9_-]{8,128})$/.exec(next ?? "");
  if (!m) return null;
  try {
    const { data } = await getAdminSupabase()
      .from("office_members")
      .select("invite_email, status, expires_at, invited_at")
      .eq("invite_token", m[1])
      .maybeSingle();
    if (!data?.invite_email || data.status !== "pending") return null;
    if (isInviteExpired(data as { status?: string; expires_at?: string | null; invited_at?: string | null })) return null;
    return String(data.invite_email).trim().toLowerCase();
  } catch {
    return null;
  }
}
