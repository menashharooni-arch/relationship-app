import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

async function getOwnerUsernames(userId: string): Promise<string[]> {
  const admin = getAdminSupabase();
  const [{ data: profile }, { data: cards }] = await Promise.all([
    admin.from("profiles").select("username").eq("id", userId).single(),
    admin.from("cards").select("username").eq("user_id", userId),
  ]);
  return [
    profile?.username ?? "__none__",
    ...(cards ?? []).map((c: { username: string }) => c.username),
  ];
}

const ALLOWED_PATCH_FIELDS = new Set([
  "status", "notes", "tags", "follow_up_date", "name", "email", "phone", "company", "message",
  "where_met", "convo_details", "company_description", "follow_up_sequence",
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

  const usernames = await getOwnerUsernames(user.id);
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("leads")
    .update(body)
    .eq("id", id)
    .in("card_owner", usernames);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If dissolving, clear automation tags and follow_up_sequence
  if (body.status === "dissolved") {
    const { data: lead } = await admin.from("leads").select("tags").eq("id", id).single();
    if (lead?.tags) {
      const cleanTags = (lead.tags as string[]).filter(
        (t: string) => !t.startsWith("preset-") && t !== "flow-paused"
      );
      await admin.from("leads").update({ tags: cleanTags, follow_up_sequence: [] }).eq("id", id);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usernames = await getOwnerUsernames(user.id);
  const admin = getAdminSupabase();

  const { error } = await admin
    .from("leads")
    .delete()
    .eq("id", id)
    .in("card_owner", usernames);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
