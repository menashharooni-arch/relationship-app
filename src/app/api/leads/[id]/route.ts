import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

async function getOwnerUsername(userId: string) {
  const admin = getAdminSupabase();
  const { data } = await admin.from("profiles").select("username").eq("id", userId).single();
  return data?.username ?? "__none__";
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status", "notes", "tags", "follow_up_date", "name", "email", "phone", "company", "message",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await req.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow updates to specific fields
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_PATCH_FIELDS.has(key)) body[key] = raw[key];
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const username = await getOwnerUsername(user.id);
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("leads")
    .update(body)
    .eq("id", id)
    .eq("card_owner", username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = await getOwnerUsername(user.id);
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("card_owner", username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
