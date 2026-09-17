import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOwnerUsernames } from "@/lib/owner-usernames";
import { isPaidUser } from "@/lib/notification-privacy";
import { warmVisitors, warmOnly, WARM_WINDOW_DAYS } from "@/lib/visitor-intel";

// Private: the owner's own visitors. card_views has RLS enabled with ZERO
// policies (supabase/view-visit-window.sql) — it is service-role only, so this
// route IS the tenancy boundary, exactly like GET /api/card-events. Every read
// below is scoped to slugs resolved from the session user id; nothing in the
// query string can widen it.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = req.nextUrl.searchParams;
    // "all" returns known contacts too, for the Contacts activity sort. The
    // default is the dashboard's list: strangers worth chasing.
    const scope = params.get("scope") === "all" ? "all" : "warm";
    const days = Number(params.get("days")) || WARM_WINDOW_DAYS;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);

    const usernames = await getOwnerUsernames(user.id);
    // Plan decides whether a place name exists in the payload at all. Unknown
    // plan resolves to Free inside isPaidUser — withholding is the safe failure.
    const paid = await isPaidUser(user.id);

    const all = await warmVisitors(usernames, { paid, days });
    const rows = scope === "all" ? all : warmOnly(all);

    return NextResponse.json({
      visitors: rows.slice(0, limit),
      total: rows.length,
      days,
    });
  } catch {
    // An analytics read that fails is an empty list, never a 500 on the
    // dashboard: the rest of the page is more important than this box.
    return NextResponse.json({ visitors: [], total: 0, days: WARM_WINDOW_DAYS });
  }
}
