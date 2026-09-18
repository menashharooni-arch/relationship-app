import type { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { dispatchCrmEvent } from "@/lib/crm-events";
import { checkViewMilestone, type MilestoneNotice } from "@/lib/milestones";
import { isCardActive } from "@/lib/card-active";
import { isRateLimited } from "@/lib/rate-limit";
import { isOwnerRequest } from "@/lib/self-traffic";
import { resolveGeo, type GeoResult } from "@/lib/request-geo";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

export type RecordViewOutcome = "recorded" | "deduped" | "self" | "inactive" | "hosting" | "error";

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
  /** The DURABLE identity from lib/visit-identity.ts — the sc_vid cookie, the
   *  client's adopted localStorage id, or a freshly minted one. Callers must
   *  resolve it there rather than passing the request body's value straight
   *  through; that is what stopped one visit counting four times. */
  visitorId: string | null;
  /** Last-resort dedupe key for a browser whose storage cannot hold an
   *  identity at all (lib/visit-identity.ts). Null when there is no usable IP. */
  deviceKey?: string | null;
  /** True when this request arrived with NO durable identity and one had to be
   *  minted — the only case where the (shared-by-design) device key may dedupe.
   *  Defaults false: a caller that does not know must never drop a real visit. */
  identityMinted?: boolean;
  source: string | null;
  ip: string;
}): Promise<{
  outcome: RecordViewOutcome;
  location: string | null;
  /** The full geo answer, so the caller doesn't resolve it a second time and
   *  can store the same confidence on its own row. Null on the early exits. */
  geo?: GeoResult | null;
  milestone?: MilestoneNotice | null;
}> {
  const { req, visitorId, deviceKey = null, identityMinted = false, source, ip } = opts;
  const username = opts.username.toLowerCase();

  // Only record views for cards that actually serve. Blocks spam inflation of
  // view counts via direct POSTs for nonexistent/deleted/plan-deactivated slugs
  // (the "__links" suffix maps back to its card).
  const baseSlug = username.replace(/__links$/, "");
  if (!(await isCardActive(baseSlug))) return { outcome: "inactive", location: null, geo: null };

  // Owner self-views NEVER count as traffic. Shared, identity-based check —
  // never IP-based (see self-traffic.ts).
  if (await isOwnerRequest(getAdminSupabase(), username)) return { outcome: "self", location: null, geo: null };

  // Edge geo cross-checked against a second IP database (request-geo.ts):
  // two sources that name the same town are believed, two that disagree are
  // reported at the state they share. Looked up on every attempt (a deduped
  // reload hits the per-IP cache) so the value returned is always the one a
  // recorded row would carry.
  //
  // resolveGeo, not resolveLocation: the same work, but it also hands back HOW
  // MUCH of the answer is real (city / city_approx / region / country). That
  // used to be computed and thrown away, which is why a state-level guess and a
  // confirmed town were indistinguishable once stored — see request-geo.ts and
  // lib/location-display.ts.
  const geo = await resolveGeo(req, ip);
  const location = geo.label;
  const supabase = getAdminSupabase();

  // A datacenter is not a person. Cloud/hosting egress that is NOT a consumer
  // privacy relay never becomes a view, a location, a CRM event or a push —
  // see the two patterns in request-geo.ts for why those are now separable and
  // what evidence turned this from a downgrade into an exclusion. iCloud
  // Private Relay and VPN traffic is unaffected and still counts.
  if (geo.isHosting) return { outcome: "hosting", location, geo };

  // ── Dedupe within ONE VISIT (see view-window.ts) ───────────────────────────
  // A reload, a double-fire, a back-navigation or a retry inside the window is
  // the same visit and must not add a row. Beyond the window, the same visitor
  // coming back is a GENUINE REPEAT VIEW and records again.
  //
  // TWO KEYS, CHECKED IN ORDER, and the second is the fix for the four-views-
  // per-visit bug. The identity key alone was never enough: a browser that
  // cannot keep an id hands up a brand new one on every load, matches nothing,
  // and — because the per-IP backstop used to live in an `else` — skipped the
  // only other check there was. Now the device key is consulted whenever the
  // identity key found nothing, so a storage-less client is still one visit.
  const since = new Date(Date.now() - VIEW_VISIT_WINDOW_MS).toISOString();
  const recentBy = async (column: "visitor_id" | "device_key", value: string) => {
    const { data, error } = await supabase
      .from("card_views")
      .select("id, source")
      .eq("username", username)
      .eq(column, value)
      .gte("viewed_at", since)
      .order("viewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Column not migrated yet (device_key): treat as "nothing found" rather
    // than letting a failed filter read as a duplicate and silently stop
    // counting every view on the card.
    if (error) return null;
    return data ?? null;
  };

  let recent = visitorId ? await recentBy("visitor_id", visitorId) : null;
  // The device key is sha256(slug + ip + user-agent), and on iOS that is NOT
  // unique per person: two iPhones on the same iOS build behind one Wi-Fi send
  // byte-identical user agents, so they share a key. Consulting it for a
  // visitor who HAS a durable identity deleted the second person's visit — at
  // exactly the moment this product is for, a QR code passed around a room.
  // So it is consulted only for a browser that could keep no identity at all,
  // which is the case it was built for (visit-identity's "minted").
  if (!recent && deviceKey && identityMinted) recent = await recentBy("device_key", deviceKey);

  if (recent) {
    // Same visit, more specific source (a QR scan after a plain open):
    // upgrade in place so the scan isn't lost from attribution.
    const isGeneric = (s: string | null) => !s || s === "direct_link";
    if (source && !isGeneric(source) && isGeneric(recent.source as string | null)) {
      await supabase.from("card_views").update({ source }).eq("id", recent.id);
    }
    return { outcome: "deduped", location, geo };
  }

  if (!visitorId && !deviceKey && await isRateLimited(`views-anon:${ip}:${username}`, 1, VIEW_VISIT_WINDOW_MS)) {
    // Neither key available — the last backstop, unchanged: one counted view
    // per (IP, card) per visit window.
    return { outcome: "deduped", location, geo };
  }

  // The raw IP is intentionally NOT persisted — only the coarse location.
  // A concurrent duplicate (two tabs) is caught by the visit-bucket unique
  // index (supabase/view-visit-window.sql) and treated as a normal dedup.
  const viewRow = {
    username,
    location,
    visitor_id: visitorId,
    source,
    viewed_at: new Date().toISOString(),
    // Added by supabase/analytics-accuracy.sql. The label alone cannot say
    // whether "New York, US" is a city or the state two disagreeing databases
    // fell back to, which is how the Locations tab came to show a region as if
    // it were a town (lib/location-display.ts renders the pair).
    geo_accuracy: geo.accuracy,
    geo_source: geo.source,
    // Salted hash of (card + IP + User-Agent) — never the IP, never an
    // identity, never displayed. Added by supabase/view-identity-hardening.sql
    // so the dedupe above has something to match on when the visitor's browser
    // cannot keep an id of its own.
    device_key: deviceKey,
  };
  let { error: insertErr } = await supabase.from("card_views").insert(viewRow);
  if (insertErr && (insertErr.code === "42703" || insertErr.code === "PGRST204")) {
    // Confidence/device columns not migrated yet — record the view without them
    // rather than losing it. Same degrade-and-carry-on pattern as
    // card_events.location and notifications.visit_key.
    const { geo_accuracy: _ga, geo_source: _gs, device_key: _dk, ...legacyRow } = viewRow;
    void _ga; void _gs; void _dk;
    ({ error: insertErr } = await supabase.from("card_views").insert(legacyRow));
  }
  if (insertErr) {
    if (insertErr.code === "23505") return { outcome: "deduped", location, geo };
    console.error("card_views insert failed:", insertErr.message, { username });
    return { outcome: "error", location, geo };
  }

  // Mirror the view to the owner's CRM (SwiftCard vs SwiftLink).
  const isLinks = username.endsWith("__links");
  await dispatchCrmEvent(username, {
    type: isLinks ? "view.swiftlink" : "view.card",
    surface: isLinks ? "links" : "card",
    location: location ?? undefined,
  });

  // Milestone notification (5, 10, 25, 50, 100, …). Best-effort.
  const milestone = await checkViewMilestone(username);

  return { outcome: "recorded", location, geo, milestone };
}
