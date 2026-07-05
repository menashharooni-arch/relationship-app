import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { getProAnalytics } from "@/lib/analytics";

// Full segmented analytics — a Pro feature, enforced HERE on the server (not just
// hidden in the UI). Free accounts get a 402.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("plan, username").eq("id", user.id).single();

  if (!isPaidPlan(profile?.plan)) {
    return NextResponse.json(
      { error: "upgrade", message: "Full analytics is a Pro feature. Upgrade to unlock traffic sources, locations, and conversion.", upgrade: "/pricing" },
      { status: 402 }
    );
  }

  const rangeDays = req.nextUrl.searchParams.get("range") === "7" ? 7 : 30;
  const cardParam = req.nextUrl.searchParams.get("card");

  const { data: cards } = await admin.from("cards").select("username").eq("user_id", user.id);
  let usernames = (cards ?? []).map((c) => c.username as string);
  // Scope to one card when asked (and owned); else aggregate across all cards.
  if (cardParam && usernames.includes(cardParam)) usernames = [cardParam];
  // Legacy accounts with no card rows fall back to the profile slug.
  if (!usernames.length && profile?.username) usernames = [profile.username as string];

  const data = await getProAnalytics(admin, usernames, rangeDays);
  return NextResponse.json(data);
}
