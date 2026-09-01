import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("agent_action_history")
      .select("*, agent_queue_items(agent_id, item_type, title, target_url, status)")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw error;
    return NextResponse.json({ ready: true, history: data });
  } catch {
    return NextResponse.json({ ready: false, history: [] });
  }
}
