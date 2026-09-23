import { getAdminSupabase } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";
import { displayLabelFrom, notifyOffice } from "@/lib/office-notify";
import { NextResponse } from "next/server";

// POST /api/office/decline { token }
// An invitee declines an invitation. Proof is the unguessable invite token, so
// no account/sign-in is required (an invitee who doesn't want to join shouldn't
// have to create an account first). Declining sets status='declined', which
// releases the reserved seat (spec §2: declined invitations release the seat).
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return NextResponse.json({ error: "Token required" }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: member } = await admin
    .from("office_members")
    .select("id, status, office_id, invite_email, invite_name")
    .eq("invite_token", token)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Invalid invite link." }, { status: 404 });
  if (member.status === "active") return NextResponse.json({ error: "This invitation was already accepted." }, { status: 400 });
  // Idempotent: declining an already-declined/revoked invite is a no-op success.
  if (member.status === "declined" || member.status === "revoked") return NextResponse.json({ ok: true });

  // Guard the pending→declined transition at the DB level. Two near-simultaneous
  // POSTs of the same token can both pass the status pre-checks above; scoping the
  // UPDATE to status='pending' means only ONE of them actually changes a row (the
  // other matches zero), so the audit + team-inbox notification fire exactly once.
  const { data: declined, error } = await admin
    .from("office_members")
    .update({ status: "declined" })
    .eq("id", member.id)
    .eq("status", "pending")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only when THIS request performed the transition — never double-fire on a race.
  if ((declined?.length ?? 0) > 0) {
    await writeAudit({ action: "invite.declined", orgId: member.office_id as string, targetId: (member.invite_email as string) ?? member.id });

    // Team inbox (admin bell): the admin should know so they can re-invite or reuse
    // the now-free seat. Best-effort; never blocks the decline.
    // WHO declined, in the title — "An invitation was declined" made the
    // admin open it to find out which of their invites it was.
    await notifyOffice(member.office_id as string, {
      type: "invite_declined",
      title: `${displayLabelFrom(member.invite_name as string | null, member.invite_email as string | null)} declined your invitation`,
      meta: { memberId: member.id },
      body: member.invite_email
        ? `${member.invite_email} declined the invitation — their seat is free again.`
        : "An invitee declined — their seat is free again.",
    });
  }

  return NextResponse.json({ ok: true });
}
