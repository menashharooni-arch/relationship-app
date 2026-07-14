import { getAdminSupabase } from "@/lib/supabase-admin";
import { writeAudit } from "@/lib/audit";
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
    .select("id, status, office_id, invite_email")
    .eq("invite_token", token)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Invalid invite link." }, { status: 404 });
  if (member.status === "active") return NextResponse.json({ error: "This invitation was already accepted." }, { status: 400 });
  // Idempotent: declining an already-declined/revoked invite is a no-op success.
  if (member.status === "declined" || member.status === "revoked") return NextResponse.json({ ok: true });

  const { error } = await admin.from("office_members").update({ status: "declined" }).eq("id", member.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({ action: "invite.declined", orgId: member.office_id as string, targetId: (member.invite_email as string) ?? member.id });
  return NextResponse.json({ ok: true });
}
