import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupabase } from "@/lib/supabase-admin";

// The Communications feed: the company chat log, newest first.
// Filters: kind = a2a | owner_in | owner_out; party = org party id (matches
// sender or recipient, and broadcasts to 'all' always match a party filter).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  try {
    const admin = getAdminSupabase();
    let q = admin.from("agent_messages").select("*").order("created_at", { ascending: false }).limit(Math.min(200, Number(p.get("limit") ?? 100)));
    const kind = p.get("kind");
    if (kind) q = q.eq("kind", kind);
    const party = p.get("party");
    if (party) q = q.or(`from_id.eq.${party},to_id.eq.${party},to_id.eq.all`);
    const before = p.get("before");
    if (before) q = q.lt("created_at", before);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ ready: true, messages: data });
  } catch {
    return NextResponse.json({ ready: false, messages: [] });
  }
}
