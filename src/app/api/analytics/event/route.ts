import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { username, event_type, event_data } = await req.json();
    if (!username || !event_type) return NextResponse.json({ ok: true });

    const supabase = getAdminSupabase();
    await supabase.from("analytics_events").insert({ username, event_type, event_data: event_data ?? {} });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never fail silently
  }
}
