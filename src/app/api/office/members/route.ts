import { createClient } from "@/lib/supabase-server";
import { getOfficeBrand, stripBrandFromUserCards, memberFallbackPlan } from "@/lib/office-brand";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

// DELETE ?id=<member_id> — remove an active member, OR revoke a pending invite.
// A pending invite is REVOKED (status → 'revoked') rather than hard-deleted, so
// the action is tracked and its reserved seat is released. An active member is
// fully removed (plan reverted, office brand stripped) — that path is unchanged.
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("id");
  if (!memberId) return NextResponse.json({ error: "Member ID required" }, { status: 400 });

  // Verify the member belongs to this admin's office
  const { data: office } = await supabase
    .from("offices")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!office) return NextResponse.json({ error: "No office found" }, { status: 404 });

  const { data: member } = await supabase
    .from("office_members")
    .select("user_id, status, invite_email")
    .eq("id", memberId)
    .eq("office_id", office.id)
    .single();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Pending invite → revoke (tracked, seat released) instead of hard delete.
  if (member.status === "pending") {
    const { error } = await supabase
      .from("office_members")
      .update({ status: "revoked" })
      .eq("id", memberId)
      .eq("office_id", office.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await writeAudit({ action: "invite.revoked", actorId: user.id, orgId: office.id as string, targetId: (member.invite_email as string) ?? memberId });
    return NextResponse.json({ ok: true, revoked: true });
  }

  // Active member → full removal (revert plan, de-brand, delete row).
  if (member?.user_id) {
    // A member who still pays for their OWN subscription goes back to Pro, not
    // free — removal from a team must not clobber a plan they're paying for.
    const plan = await memberFallbackPlan(member.user_id);
    await supabase
      .from("profiles")
      .update({ plan, office_id: null })
      .eq("id", member.user_id);
    // Best-effort, separate like the webhook paths (column may not exist in
    // older schemas — must never block the critical plan revert above).
    await supabase.from("profiles").update({ plan_expires_at: null }).eq("id", member.user_id);
    // De-brand: the ex-member's live cards must not keep the office logo /
    // company (only fields still matching the office brand are cleared).
    try {
      const brand = await getOfficeBrand(office.id);
      await stripBrandFromUserCards(member.user_id, brand);
    } catch { /* best-effort */ }
  }

  const { error } = await supabase
    .from("office_members")
    .delete()
    .eq("id", memberId)
    .eq("office_id", office.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "member.removed", actorId: user.id, orgId: office.id as string, targetId: (member.user_id as string) ?? memberId });
  return NextResponse.json({ ok: true });
}
