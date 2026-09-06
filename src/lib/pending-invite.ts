import { getAdminSupabase } from "@/lib/supabase-admin";
import { isInviteExpired } from "@/lib/office-invite";

// A team invite is claimed ONLY by tapping its /join/<token> link while signed
// in with the invited address. Someone who installs the iPhone app first and
// signs in with Google (same email) therefore lands as a plain Free account,
// with no way to reach their team's hub except going back to the email — and
// the admin sees "Pending" with nothing to do but "Remind" (owner report,
// 2026-09-06). This looks the invite up by the session's verified email so the
// dashboard and onboarding can hand them the Join step themselves.
//
// The token is the invite's secret, but the caller only ever gets it for the
// exact address it was sent to — the same rule /api/join enforces on accept.
export type PendingInvite = { token: string; officeName: string };

export async function findPendingInviteForEmail(email: string | null | undefined): Promise<PendingInvite | null> {
  const addr = email?.trim().toLowerCase();
  if (!addr) return null;
  try {
    const { data } = await getAdminSupabase()
      .from("office_members")
      .select("invite_token, invite_email, status, expires_at, invited_at, offices(name)")
      .eq("status", "pending")
      .ilike("invite_email", addr)
      .order("invited_at", { ascending: false })
      .limit(5);
    const row = (data ?? []).find((r) => r.invite_token && !isInviteExpired(r as { status?: string; expires_at?: string | null; invited_at?: string | null }));
    if (!row) return null;
    const office = row.offices as unknown as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(office) ? office[0]?.name : office?.name;
    return { token: row.invite_token as string, officeName: name || "your team" };
  } catch {
    return null; // never block a dashboard or signup on this lookup
  }
}
