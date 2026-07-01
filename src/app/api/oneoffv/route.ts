import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY diagnostic: verify card_views tracking (viewed_at set? counts working?).
const TOKEN = "sc-oneoff-7v3k9m2q";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "nope" }, { status: 404 });
  const u = req.nextUrl.searchParams.get("u") || "menash";
  const admin = getAdminSupabase();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const cutoff = todayStart.toISOString();

  const card = await admin.from("card_views").select("*", { count: "exact", head: true }).eq("username", u);
  const cardToday = await admin.from("card_views").select("*", { count: "exact", head: true }).eq("username", u).gte("viewed_at", cutoff);
  const link = await admin.from("card_views").select("*", { count: "exact", head: true }).eq("username", `${u}__links`);
  const recent = await admin.from("card_views").select("*").eq("username", u).order("viewed_at", { ascending: false, nullsFirst: false }).limit(3);

  return NextResponse.json({
    username: u,
    cardViews_allTime: card.count, cardViews_allTime_error: card.error?.message,
    cardViews_today: cardToday.count, cardViews_today_error: cardToday.error?.message,
    linkViews_allTime: link.count,
    recentRows: recent.data, recent_error: recent.error?.message,
  });
}
