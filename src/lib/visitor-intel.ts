import { getAdminSupabase } from "@/lib/supabase-admin";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";
import { locationLabel } from "@/lib/location-display";
import { redactPlaceLabel } from "@/lib/location-privacy";
import type { GeoAccuracy } from "@/lib/request-geo";

// ── The visitor nobody could see ─────────────────────────────────────────────
//
// card_views has carried `visitor_id` since the dedupe work, and until now it
// was used for exactly two things: refusing a second row inside one visit, and
// count(DISTINCT) for the "unique viewers" tile. So a person who opened a card
// three times across three days — the single strongest buying signal a card
// owner can get — existed in the table and nowhere in the product. The only
// per-visitor surface we had was the contact timeline, which needs a `leads`
// row, and a visitor who never fills the form never gets one.
//
// This file is the missing rollup: per (owner, visitor), how many SEPARATE
// visits, what they tapped, where from, and whether we already know their name.
//
// THREE THINGS IT DELIBERATELY DOES NOT DO.
//
//   1. It does not identify anyone. `visitor_id` is a browser id; the only name
//      attached here is one the visitor typed into a lead form themselves.
//   2. It does not count a visit differently from the rest of the pipeline. A
//      visit is VIEW_VISIT_WINDOW_MS wide and bucketed the same way the DB's
//      card_view_bucket() does it, so "3 visits" here and "3 views" on the bar
//      chart can never disagree.
//   3. It does not decide who is hot. Ordering is recency and visit count only.
//      Scoring is a separate, retunable thing (lib/intent-score.ts) and it will
//      read this — mixing the two would bake weights into the data layer.

/** How far back a rollup looks. Older than this is history, not a live lead. */
export const WARM_WINDOW_DAYS = 90;

/** Rows pulled per owner. A ceiling, not a page: the tail is the coldest part. */
const MAX_ROWS = 4000;

export type WarmVisitor = {
  visitorId: string;
  /** Distinct visits (30-minute buckets), not raw rows. */
  visits: number;
  /** Raw card_views rows — always >= visits; the gap is reloads. */
  views: number;
  linkTaps: number;
  savedContact: boolean;
  firstSeen: string;
  lastSeen: string;
  /** Card slugs this visitor touched, base slug only (no __links suffix). */
  cards: string[];
  /** True when any of their views landed on the Swift Links page. */
  sawLinks: boolean;
  sources: string[];
  /** Already rendered AND already plan-redacted. Never a raw stored label. */
  location: string | null;
  /** Set when this visitor later gave their details. */
  leadId: string | null;
  leadName: string | null;
};

type ViewRow = {
  username: string;
  visitor_id: string | null;
  viewed_at: string;
  source: string | null;
  location: string | null;
  geo_accuracy: string | null;
};

/** The `<slug>__links` convention card_views uses for the Swift Links surface. */
const LINKS_SUFFIX = "__links";

function baseSlug(username: string): string {
  return username.endsWith(LINKS_SUFFIX)
    ? username.slice(0, -LINKS_SUFFIX.length)
    : username;
}

/**
 * The same bucket the database uses (supabase/view-visit-window.sql):
 * floor(epoch / window). Two rows in one bucket are one visit.
 */
function bucketOf(iso: string): number {
  return Math.floor(new Date(iso).getTime() / VIEW_VISIT_WINDOW_MS);
}

/**
 * Every visitor who touched this owner's cards in the window.
 *
 * `paid` decides whether a place name survives into the payload at all — the
 * Free-plan rule is a server-side redaction, the same one notification-privacy
 * applies, never a blur in the client. See [[free-plan-location-privacy]].
 */
export async function warmVisitors(
  usernames: string[],
  opts: { paid: boolean; days?: number },
): Promise<WarmVisitor[]> {
  const admin = getAdminSupabase();
  const days = opts.days ?? WARM_WINDOW_DAYS;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Both surfaces: the card page and the Swift Links page, which stores as
  // `<slug>__links`. Asking only for the base slugs would silently drop every
  // links view, and a links visitor is a visitor.
  const slugs = usernames.flatMap((u) => [u, `${u}${LINKS_SUFFIX}`]);

  // geo_accuracy is requested defensively: selecting a column that isn't
  // migrated yet fails the WHOLE query, and a rollup with coarse labels beats
  // no rollup at all.
  const base = "username, visitor_id, viewed_at, source, location";
  let rows: ViewRow[] = [];
  {
    const withGeo = await admin
      .from("card_views")
      .select(`${base}, geo_accuracy`)
      .in("username", slugs)
      .gte("viewed_at", since)
      .order("viewed_at", { ascending: false })
      .limit(MAX_ROWS);
    if (withGeo.error) {
      const plain = await admin
        .from("card_views")
        .select(base)
        .in("username", slugs)
        .gte("viewed_at", since)
        .order("viewed_at", { ascending: false })
        .limit(MAX_ROWS);
      rows = ((plain.data ?? []) as Omit<ViewRow, "geo_accuracy">[]).map((r) => ({
        ...r,
        geo_accuracy: null,
      }));
    } else {
      rows = (withGeo.data ?? []) as ViewRow[];
    }
  }

  const views = rows.filter((r) => r.visitor_id);
  if (!views.length) return [];

  const ids = [...new Set(views.map((r) => r.visitor_id as string))];

  // Events and leads for exactly these visitors. Two narrow queries rather than
  // one join: card_events is keyed by the owner slug, leads by card_owner, and
  // neither has a foreign key to card_views.
  const [{ data: events }, { data: leads }] = await Promise.all([
    admin
      .from("card_events")
      .select("visitor_id, event_type")
      .in("card_owner_username", usernames)
      .in("visitor_id", ids)
      .gte("created_at", since),
    admin
      .from("leads")
      .select("id, name, visitor_id")
      .in("card_owner", usernames)
      .in("visitor_id", ids),
  ]);

  const taps = new Map<string, number>();
  const saved = new Set<string>();
  for (const e of (events ?? []) as { visitor_id: string | null; event_type: string }[]) {
    if (!e.visitor_id) continue;
    if (e.event_type === "clicked_link") {
      taps.set(e.visitor_id, (taps.get(e.visitor_id) ?? 0) + 1);
    } else if (e.event_type === "downloaded_vcard" || e.event_type === "contact_saved") {
      saved.add(e.visitor_id);
    }
  }

  const named = new Map<string, { id: string; name: string | null }>();
  for (const l of (leads ?? []) as { id: string; name: string | null; visitor_id: string | null }[]) {
    if (l.visitor_id && !named.has(l.visitor_id)) named.set(l.visitor_id, { id: l.id, name: l.name });
  }

  type Acc = {
    buckets: Set<number>;
    views: number;
    first: string;
    last: string;
    cards: Set<string>;
    sawLinks: boolean;
    sources: Set<string>;
    location: string | null;
  };
  const acc = new Map<string, Acc>();

  // Rows arrive newest first, so the FIRST location seen for a visitor is their
  // most recent one — the place that matters for "should I call them today".
  for (const r of views) {
    const id = r.visitor_id as string;
    const cur = acc.get(id);
    const label = r.location
      ? locationLabel(r.location, (r.geo_accuracy as GeoAccuracy | null) ?? null)
      : null;
    if (!cur) {
      acc.set(id, {
        buckets: new Set([bucketOf(r.viewed_at)]),
        views: 1,
        first: r.viewed_at,
        last: r.viewed_at,
        cards: new Set([baseSlug(r.username)]),
        sawLinks: r.username.endsWith(LINKS_SUFFIX),
        sources: new Set(r.source ? [r.source] : []),
        location: label,
      });
      continue;
    }
    cur.buckets.add(bucketOf(r.viewed_at));
    cur.views += 1;
    if (r.viewed_at < cur.first) cur.first = r.viewed_at;
    if (r.viewed_at > cur.last) cur.last = r.viewed_at;
    cur.cards.add(baseSlug(r.username));
    if (r.username.endsWith(LINKS_SUFFIX)) cur.sawLinks = true;
    if (r.source) cur.sources.add(r.source);
    if (!cur.location && label) cur.location = label;
  }

  const out: WarmVisitor[] = [];
  for (const [visitorId, a] of acc) {
    const lead = named.get(visitorId) ?? null;
    out.push({
      visitorId,
      visits: a.buckets.size,
      views: a.views,
      linkTaps: taps.get(visitorId) ?? 0,
      savedContact: saved.has(visitorId),
      firstSeen: a.first,
      lastSeen: a.last,
      cards: [...a.cards],
      sawLinks: a.sawLinks,
      sources: [...a.sources],
      // Redaction happens HERE, before the value can reach a response body.
      location: a.location ? (opts.paid ? a.location : redactPlaceLabel(a.location)) : null,
      leadId: lead?.id ?? null,
      leadName: lead?.name ?? null,
    });
  }

  // Most recent first, then the visitor who came back most. A single-visit
  // stranger from an hour ago still outranks a three-visit one from June:
  // recency is what makes a follow-up land.
  out.sort((x, y) => (x.lastSeen < y.lastSeen ? 1 : x.lastSeen > y.lastSeen ? -1 : y.visits - x.visits));
  return out;
}

/**
 * The list the dashboard actually shows: people who came back, or engaged, and
 * never told us who they are. One visit and nothing tapped is not a lead, it is
 * traffic, and putting it in this list would make the list worthless.
 */
export function warmOnly(all: WarmVisitor[]): WarmVisitor[] {
  return all.filter((v) => !v.leadId && (v.visits > 1 || v.linkTaps > 0 || v.savedContact));
}

/** Last activity per visitor id — what "Recent Activity" should have sorted on. */
export function lastSeenByVisitor(all: WarmVisitor[]): Map<string, string> {
  return new Map(all.map((v) => [v.visitorId, v.lastSeen]));
}
