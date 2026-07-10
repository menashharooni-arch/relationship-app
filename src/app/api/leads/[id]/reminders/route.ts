import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { ownsLead } from "@/lib/lead-access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Verify the lead belongs to this user before returning its reminder history.
  const [{ data: lead }, usernames] = await Promise.all([
    admin.from("leads").select("card_owner").eq("id", id).single(),
    getOwnerUsernames(user.id),
  ]);
  if (!ownsLead(usernames, lead)) {
    return NextResponse.json({ reminders: [] });
  }

  const { data: reminders } = await admin
    .from("lead_reminders")
    .select("day_trigger, created_at")
    .eq("lead_id", id)
    .order("day_trigger", { ascending: true });

  return NextResponse.json({ reminders: reminders ?? [] });
}
