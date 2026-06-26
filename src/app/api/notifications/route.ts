import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; read?: boolean } = {};
  try { body = await req.json(); } catch { /* no body = mark all read */ }

  if (body.id) {
    // Toggle a single notification's read state.
    await supabase
      .from("notifications")
      .update({ read: body.read ?? true })
      .eq("user_id", user.id)
      .eq("id", body.id);
  } else {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  }

  return NextResponse.json({ success: true });
}

// Dismiss notifications: { id } removes one, { read: true } clears all read ones.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; read?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  if (body.id) {
    await supabase.from("notifications").delete().eq("user_id", user.id).eq("id", body.id);
  } else if (body.read) {
    await supabase.from("notifications").delete().eq("user_id", user.id).eq("read", true);
  }

  return NextResponse.json({ success: true });
}
