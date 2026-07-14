import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability, isAssignableRole } from "@/lib/office-roles";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

// POST /api/office/role { memberId, role }
// Assign a member's role. Requires the manage_roles capability (owner only).
// role ∈ { admin, manager, billing_admin, employee }. The member must belong to
// the caller's office. Server-side authorization — never trust the UI.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, role } = await req.json().catch(() => ({}));
  if (!memberId || typeof memberId !== "string") return NextResponse.json({ error: "Member ID required" }, { status: 400 });
  if (!role || !isAssignableRole(role)) {
    return NextResponse.json({ error: "Invalid role. Use admin, manager, billing_admin, or employee." }, { status: 400 });
  }

  const ctx = await requireOfficeCapability(user.id, "manage_roles");
  if (!ctx) return NextResponse.json({ error: "Only the office owner can change roles." }, { status: 403 });

  const admin = getAdminSupabase();
  // Scope strictly to the caller's office so an id from another org can't be hit.
  const { data: member } = await admin
    .from("office_members")
    .select("id, status, invite_email, user_id")
    .eq("id", memberId)
    .eq("office_id", ctx.officeId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Member not found in your office." }, { status: 404 });

  const { error } = await admin.from("office_members").update({ role }).eq("id", memberId).eq("office_id", ctx.officeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "role.changed",
    actorId: user.id,
    orgId: ctx.officeId,
    targetId: (member.user_id as string) ?? (member.invite_email as string) ?? memberId,
    metadata: { role },
  });

  return NextResponse.json({ ok: true, role });
}
