import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Verify lead belongs to this user
  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: reminders } = await admin
    .from("lead_reminders")
    .select("day_trigger, created_at")
    .eq("lead_id", id)
    .order("day_trigger", { ascending: true });

  return NextResponse.json({ reminders: reminders ?? [] });
}
