import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone } from "@/lib/milestones";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;

  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const location = city && country
    ? `${decodeURIComponent(city)}, ${country}`
    : country || null;

  const supabase = getAdminSupabase();
  await supabase.from("card_views").insert({ username, ip, location });

  // Mirror the view to the owner's CRM (SwiftCard vs SwiftLink). Gated by their
  // "card & link views" CRM preference; no-op for everyone else.
  const isLinks = username.endsWith("__links");
  await dispatchCrmEvent(username, {
    type: isLinks ? "view.swiftlink" : "view.card",
    surface: isLinks ? "links" : "card",
    location: location ?? undefined,
  });

  // Achievement check: notify the owner when this card lands on a view
  // milestone (5, 10, 25, 50, 100, …). Best-effort — never blocks tracking.
  await checkViewMilestone(username);

  return NextResponse.json({ ok: true });
}
