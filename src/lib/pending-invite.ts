import { getAdminSupabase } from "@/lib/supabase-admin";
import { isInviteExpired } from "@/lib/office-invite";
import { officeCompanyName } from "@/lib/office-display-name";

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
//
// officeName is the company the invitee will recognise (lib/office-display-
// name), or null when the office has none — never "My Office".
export type PendingInvite = { token: string; officeName: string | null };

// ILIKE treats `_` and `%` as wildcards, so `j_smith@acme.com` matched a
// pending invite for `jasmith@acme.com` — handing one person another person's
// token, sending every sign-in of theirs to a Join page that could only 403,
// and hiding their own plan step behind it. Escaped, the match is exact
// (case-insensitive, which is the part ILIKE is here for).
function likeExact(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findPendingInviteForEmail(
  email: string | null | undefined,
  /** The signed-in account. Pass it so an invite they can't accept is skipped. */
  userId?: string | null,
): Promise<PendingInvite | null> {
  const addr = email?.trim().toLowerCase();
  if (!addr) return null;
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from("office_members")
      .select("invite_token, invite_email, status, expires_at, invited_at, office_id, offices(name, owner_id, brand_company)")
      .eq("status", "pending")
      .ilike("invite_email", likeExact(addr))
      .order("invited_at", { ascending: false })
      .limit(5);
    const live = (data ?? []).filter((r) => r.invite_token && !isInviteExpired(r as { status?: string; expires_at?: string | null; invited_at?: string | null }));
    if (!live.length) return null;

    // An office OWNER can't join another team (/api/join refuses it), so
    // routing them to Join would send every sign-in to a dead end.
    if (userId) {
      const { data: owned } = await admin.from("offices").select("id").eq("owner_id", userId).limit(1).maybeSingle();
      if (owned) return null;
    }

    for (const row of live) {
      const office = row.offices as unknown as { name?: string; owner_id?: string; brand_company?: string } | { name?: string; owner_id?: string; brand_company?: string }[] | null;
      const o = Array.isArray(office) ? office[0] : office;
      // The team's subscription must still be active — /api/join refuses a
      // lapsed office (the cancel cascade suspends members, not pending
      // invites), and onboarding, /welcome and the dashboard would otherwise
      // keep steering this person to an Accept button that can only fail,
      // with their own plan step hidden behind it for up to 14 days.
      if (o?.owner_id) {
        const { data: owner } = await admin.from("profiles").select("plan").eq("id", o.owner_id).maybeSingle();
        if (owner?.plan !== "enterprise") continue;
      }
      const officeName = await officeCompanyName(row.office_id as string, {
        brandCompany: o?.brand_company ?? null,
        storedName: o?.name ?? null,
        ownerId: o?.owner_id ?? null,
      });
      return { token: row.invite_token as string, officeName };
    }
    return null;
  } catch {
    return null; // never block a dashboard or signup on this lookup
  }
}
