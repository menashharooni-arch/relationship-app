import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone } from "@/lib/milestones";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isOwnerRequest } from "@/lib/self-traffic";
import { clientIp } from "@/lib/client-ip";
import { isLikelyBot } from "@/lib/bot-detection";
import { requestLocation } from "@/lib/request-geo";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: rawUsername } = await params;
  const username = rawUsername.toLowerCase();

  // Public, unauthenticated endpoint — cap per (IP, card) so a caller that
  // omits visitorId (bypassing the reload-dedup below entirely) can't loop
  // this to inflate a card's view count or spam its owner's view-milestone
  // notifications.
  const ip = clientIp(req)
    ?? "unknown";
  if (await isRateLimited(`views:${ip}:${username}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: true, rateLimited: true });
  }

  // Bot/crawler/synthetic-monitor traffic never counts as a real view. Checked
  // against the actual request header (not the client-supplied device_info),
  // so it holds even against a direct scripted POST.
  if (isLikelyBot(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, bot: true });
  }

  // Browser prefetch/prerender/link-preview machinery announces itself in
  // these headers. Our tracker fires from a user-visible page (and skips
  // document.prerendering itself), so anything that arrives pre-flagged is a
  // speculative load, not a person.
  const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""} ${req.headers.get("x-purpose") ?? ""}`.toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) {
    return NextResponse.json({ ok: true, prefetch: true });
  }

  const body = await req.json().catch(() => null);
  // Type + length validation: both fields are permanent row values and the
  // dedup/traffic-source pipelines key on them, so a non-string or unbounded
  // payload must degrade to "absent", never reach the database. (Recorded
  // source values aren't validated against SOURCE_LABELS — an unrecognized
  // value just falls back to its raw string in the UI via getSourceLabel.)
  const visitorId: string | null =
    typeof body?.visitorId === "string" && body.visitorId.trim()
      ? body.visitorId.trim().slice(0, 64)
      : null;
  const source: string | null =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 48)
      : null;

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

  const location = requestLocation(req);

  const supabase = getAdminSupabase();

  // Dedupe within ONE VISIT (see view-window.ts): a reload, double-fire, or
  // back-navigation inside the window is the same visit and must not add a
  // row. Beyond the window, the same visitor coming back is a GENUINE REPEAT
  // VIEW and records again — total views count visits, distinct visitor_ids
  // count unique viewers, and the difference is repeat interest. (This used to
  // be a 24h window, which silently erased every same-day return — the
  // dashboard could never show that a hot lead opened the card three times.)
  if (visitorId) {
    const since = new Date(Date.now() - VIEW_VISIT_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("card_views")
      .select("id, source")
      .eq("username", username)
      .eq("visitor_id", visitorId)
      .gte("viewed_at", since)
      // Newest first — with multiple rows in range the source upgrade below
      // must touch the row for THIS visit, not an arbitrary older one.
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      // A same-visit reload doesn't get a new row, but if this hit carries a
      // more specific source (e.g. a QR scan minutes after the same visitor
      // opened a plain link) than what got recorded first, upgrade it in place
      // — otherwise that scan silently vanishes from traffic-source
      // attribution. Never downgrades an already-specific source.
      const isGeneric = (s: string | null) => !s || s === "direct_link";
      if (source && !isGeneric(source) && isGeneric(recent.source as string | null)) {
        await supabase.from("card_views").update({ source }).eq("id", recent.id);
      }
      return NextResponse.json({ ok: true, deduped: true });
    }
  } else {
    // No visitor id (storage-blocked client, scripted POST) — there is nothing
    // to dedupe rows on, so hold this path to one counted view per (IP, card)
    // per visit window. A NAT full of distinct real visitors still counts:
    // real browsers virtually always manage a visitor id.
    if (await isRateLimited(`views-anon:${ip}:${username}`, 1, VIEW_VISIT_WINDOW_MS)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  // Record the view. Surface a failure in the logs instead of silently dropping
  // it (a missing column / RLS issue would otherwise make views vanish with no
  // signal). Tracking must never break the visitor's page load, so we still
  // return ok — but the error is now visible.
  // viewed_at is set explicitly (not left to a column DEFAULT) so a view always
  // has the timestamp the dashboard filters/counts on — no dependency on the
  // production table having the DEFAULT now() the migration specifies.
  // NOTE: the raw IP is intentionally NOT persisted here (only used above for
  // the rate-limit key) — the privacy policy states visitor IPs are not stored
  // with views, so only the pre-derived, coarser `location` string is kept.
  // A concurrent duplicate insert for the same visitor (two tabs, a client
  // double-fire) is caught by the visit-bucket unique index added in
  // supabase/view-visit-window.sql and treated as a normal dedup, not a
  // failure — the check above narrows the window but is not atomic by itself.
  const { error: insertErr } = await supabase.from("card_views").insert({ username, location, visitor_id: visitorId, source, viewed_at: new Date().toISOString() });
  if (insertErr) {
    if (insertErr.code === "23505") return NextResponse.json({ ok: true, deduped: true });
    console.error("card_views insert failed:", insertErr.message, { username });
  }

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
