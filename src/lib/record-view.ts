import type { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone, type MilestoneNotice } from "@/lib/milestones";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isOwnerRequest } from "@/lib/self-traffic";
import { resolveLocation } from "@/lib/request-geo";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

export type RecordViewOutcome = "recorded" | "deduped" | "self" | "inactive" | "error";

/**
 * THE one place a view becomes a card_views row.
 *
 * The traffic chart, the SwiftCard/Swift Links counters and the Locations
 * split all read card_views; the owner's "viewed" notification used to be
 * decided by a SEPARATE request (/api/card-events) with its own dedupe key —
 * one that ignored card-vs-links — so the bell and the bars could disagree
 * (a notification with no bar, or a bar with no notification). Now the event
 * route records the view through this function and notifies only when it
 * returns "recorded": a notification exists exactly when a bar does.
 *
 * `username` is the card_views key: the card slug, or "<slug>__links" for
 * the Swift Links page.
 */
export async function recordView(opts: {
  req: NextRequest;
  username: string;
  visitorId: string | null;
  source: string | null;
  ip: string;
  /**
   * Hand the milestone back instead of pushing it. The caller is about to
   * notify the owner about this same visit and folds the achievement into that
   * one notification — two pushes a second apart for one visitor is the exact
   * duplicate we removed (lib/visit-notify.ts).
   */
  deferMilestonePush?: boolean;
}): Promise<{ outcome: RecordViewOutcome; location: string | null; milestone?: MilestoneNotice | null }> {
  const { req, visitorId, source, ip } = opts;
  const username = opts.username.toLowerCase();

  // Only record views for cards that actually serve. Blocks spam inflation of
  // view counts via direct POSTs for nonexistent/deleted/plan-deactivated slugs
  // (the "__links" suffix maps back to its card).
  const baseSlug = username.replace(/__links$/, "");
  if (!(await isCardActive(baseSlug))) return { outcome: "inactive", location: null };

  // Owner self-views NEVER count as traffic. Shared, identity-based check —
  // never IP-based (see self-traffic.ts).
  if (await isOwnerRequest(getAdminSupabase(), username)) return { outcome: "self", location: null };

  // Edge geo cross-checked against a second IP database (request-geo.ts):
  // two sources that name the same town are believed, two that disagree are
  // reported at the state they share. Looked up on every attempt (a deduped
  // reload hits the per-IP cache) so the value returned is always the one a
  // recorded row would carry.
  const location = await resolveLocation(req, ip);
  const supabase = getAdminSupabase();

  // Dedupe within ONE VISIT (see view-window.ts): a reload, double-fire, or
  // back-navigation inside the window is the same visit and must not add a
  // row. Beyond the window, the same visitor coming back is a GENUINE REPEAT
  // VIEW and records again.
  if (visitorId) {
    const since = new Date(Date.now() - VIEW_VISIT_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("card_views")
      .select("id, source")
      .eq("username", username)
      .eq("visitor_id", visitorId)
      .gte("viewed_at", since)
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      // Same visit, more specific source (a QR scan after a plain open):
      // upgrade in place so the scan isn't lost from attribution.
      const isGeneric = (s: string | null) => !s || s === "direct_link";
      if (source && !isGeneric(source) && isGeneric(recent.source as string | null)) {
        await supabase.from("card_views").update({ source }).eq("id", recent.id);
      }
      return { outcome: "deduped", location };
    }
  } else if (await isRateLimited(`views-anon:${ip}:${username}`, 1, VIEW_VISIT_WINDOW_MS)) {
    // No visitor id → one counted view per (IP, card) per visit window.
    return { outcome: "deduped", location };
  }

  // The raw IP is intentionally NOT persisted — only the coarse location.
  // A concurrent duplicate (two tabs) is caught by the visit-bucket unique
  // index (supabase/view-visit-window.sql) and treated as a normal dedup.
  const { error: insertErr } = await supabase
    .from("card_views")
    .insert({ username, location, visitor_id: visitorId, source, viewed_at: new Date().toISOString() });
  if (insertErr) {
    if (insertErr.code === "23505") return { outcome: "deduped", location };
    console.error("card_views insert failed:", insertErr.message, { username });
    return { outcome: "error", location };
  }

  // Mirror the view to the owner's CRM (SwiftCard vs SwiftLink).
  const isLinks = username.endsWith("__links");
  await dispatchCrmEvent(username, {
    type: isLinks ? "view.swiftlink" : "view.card",
    surface: isLinks ? "links" : "card",
    location: location ?? undefined,
  });

  // Milestone notification (5, 10, 25, 50, 100, …). Best-effort.
  const milestone = await checkViewMilestone(username, { deferPush: opts.deferMilestonePush });

  return { outcome: "recorded", location, milestone };
}
