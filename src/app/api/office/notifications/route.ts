import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireOfficeCapability } from "@/lib/office-roles";
import { listOfficeNotifications } from "@/lib/office-notify";

// The /office/admin team-inbox bell. Entirely separate from /api/notifications
// (the personal per-user bell): different table (office_notifications), different
// key (office_id, not user_id), different auth (an office capability, not just a
// logged-in user). So the two inboxes can never mix or bleed.
//
// Every handler re-derives the office from the session via requireOfficeCapability
// and scopes every query to ctx.officeId — a notification id from another office
// can't be read, marked, or dismissed by pasting it in.

// GET — the caller's office team inbox (newest first).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "view_org_analytics");
  if (!ctx) return NextResponse.json({ error: "You don't have access to team notifications." }, { status: 403 });

  const notifications = await listOfficeNotifications(ctx.officeId);
  return NextResponse.json(notifications);
}

// PATCH — mark one read/unread ({ id, read }) or mark all read (no id).
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "view_org_analytics");
  if (!ctx) return NextResponse.json({ error: "You don't have access to team notifications." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = getAdminSupabase();

  if (body.id) {
    const { error } = await admin
      .from("office_notifications")
      .update({ read: body.read ?? true })
      .eq("office_id", ctx.officeId)   // office scope FIRST — an id from another org can't be hit
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: "Couldn't update that notification." }, { status: 500 });
  } else {
    // Mark all read for this office.
    const { error } = await admin
      .from("office_notifications")
      .update({ read: true })
      .eq("office_id", ctx.officeId)
      .eq("read", false);
    if (error) return NextResponse.json({ error: "Couldn't update notifications." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — dismiss one ({ id }) or clear all already-read ({ read: true }).
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOfficeCapability(user.id, "view_org_analytics");
  if (!ctx) return NextResponse.json({ error: "You don't have access to team notifications." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const admin = getAdminSupabase();

  if (body.id) {
    const { error } = await admin
      .from("office_notifications")
      .delete()
      .eq("office_id", ctx.officeId)
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: "Couldn't dismiss that notification." }, { status: 500 });
  } else if (body.read) {
    const { error } = await admin
      .from("office_notifications")
      .delete()
      .eq("office_id", ctx.officeId)
      .eq("read", true);
    if (error) return NextResponse.json({ error: "Couldn't clear notifications." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
