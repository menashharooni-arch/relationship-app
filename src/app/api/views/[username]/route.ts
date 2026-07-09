import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone } from "@/lib/milestones";
import { isCardActive } from "@/lib/card-active";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Only record views for cards that actually serve. Blocks spam inflation of
  // view counts via direct POSTs for nonexistent/deleted/plan-deactivated slugs
  // (the "__links" suffix maps back to its card).
  const baseSlug = username.replace(/__links$/, "");
  if (!(await isCardActive(baseSlug))) {
    return NextResponse.json({ ok: true }); // don't reveal which slugs exist
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;

  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const location = city && country
    ? `${decodeURIComponent(city)}, ${country}`
    : country || null;

  const supabase = getAdminSupabase();
  // Record the view. Surface a failure in the logs instead of silently dropping
  // it (a missing column / RLS issue would otherwise make views vanish with no
  // signal). Tracking must never break the visitor's page load, so we still
  // return ok — but the error is now visible.
  // viewed_at is set explicitly (not left to a column DEFAULT) so a view always
  // has the timestamp the dashboard filters/counts on — no dependency on the
  // production table having the DEFAULT now() the migration specifies.
  const { error: insertErr } = await supabase.from("card_views").insert({ username, ip, location, viewed_at: new Date().toISOString() });
  if (insertErr) console.error("card_views insert failed:", insertErr.message, { username });

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
