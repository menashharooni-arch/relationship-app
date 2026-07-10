import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone } from "@/lib/milestones";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isOwnerRequest } from "@/lib/self-traffic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Public, unauthenticated endpoint — cap per (IP, card) so a caller that
  // omits visitorId (bypassing the reload-dedup below entirely) can't loop
  // this to inflate a card's view count or spam its owner's view-milestone
  // notifications.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  if (await isRateLimited(`views:${ip}:${username}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: true, rateLimited: true });
  }

  const visitorId: string | null = await req.json().then((b) => b?.visitorId || null).catch(() => null);

  // Only record views for cards that actually serve. Blocks spam inflation of
  // view counts via direct POSTs for nonexistent/deleted/plan-deactivated slugs
  // (the "__links" suffix maps back to its card).
  const baseSlug = username.replace(/__links$/, "");
  if (!(await isCardActive(baseSlug))) {
    return NextResponse.json({ ok: true }); // don't reveal which slugs exist
  }

  // Owner self-views NEVER count as traffic. The pages already skip the tracker
  // for a logged-in owner, but this closes every other path (stale tabs, direct
  // calls, future components): if the caller's session owns this card, skip.
  // Shared, identity-based check — never IP-based (see self-traffic.ts).
  if (await isOwnerRequest(getAdminSupabase(), username)) {
    return NextResponse.json({ ok: true, self: true });
  }

  const city = req.headers.get("x-vercel-ip-city");
  const country = req.headers.get("x-vercel-ip-country");
  const location = city && country
    ? `${decodeURIComponent(city)}, ${country}`
    : country || null;

  const supabase = getAdminSupabase();

  // Dedupe by visitor: a page reload (same tab, same sessionStorage visitor id)
  // must not count as a second view. Only a fresh visitor id — a new tab/session,
  // or the same visitor coming back after 24h — counts as a new view.
  if (visitorId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("card_views")
      .select("id")
      .eq("username", username)
      .eq("visitor_id", visitorId)
      .gte("viewed_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) return NextResponse.json({ ok: true, deduped: true });
  }

  // Record the view. Surface a failure in the logs instead of silently dropping
  // it (a missing column / RLS issue would otherwise make views vanish with no
  // signal). Tracking must never break the visitor's page load, so we still
  // return ok — but the error is now visible.
  // viewed_at is set explicitly (not left to a column DEFAULT) so a view always
  // has the timestamp the dashboard filters/counts on — no dependency on the
  // production table having the DEFAULT now() the migration specifies.
  const { error: insertErr } = await supabase.from("card_views").insert({ username, ip, location, visitor_id: visitorId, viewed_at: new Date().toISOString() });
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
