import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourceLabel } from "@/lib/source-labels";

// The full, Pro-only analytics: traffic sources, top locations, conversion
// (views → contacts), and a views-over-time series. Computed from the source /
// location data we already capture on card_views and leads.
export type ProAnalytics = {
  rangeDays: number;
  totalViews: number;
  totalSaves: number;         // contacts captured in the window
  conversionRate: number;     // saves / views, 0..1 (0 when there are no views)
  bestDay: { date: string; views: number } | null;
  series: { date: string; views: number }[];
  sources: { source: string; label: string; count: number }[];
  locations: { location: string; count: number }[];
};

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getProAnalytics(
  admin: SupabaseClient,
  usernames: string[],
  rangeDays: number,
): Promise<ProAnalytics> {
  const now = Date.now();
  const sinceIso = new Date(now - rangeDays * 86400000).toISOString();
  // Card views are tracked per card slug AND its "<slug>__links" variant.
  const viewKeys = usernames.flatMap((u) => [u, `${u}__links`]);

  const [viewsRes, leadsRes] = await Promise.all([
    viewKeys.length
      ? admin.from("card_views").select("location, viewed_at").in("username", viewKeys).gte("viewed_at", sinceIso)
      : Promise.resolve({ data: [] as { location: string | null; viewed_at: string }[] }),
    usernames.length
      ? admin.from("leads").select("source, location, created_at").in("card_owner", usernames).gte("created_at", sinceIso)
      : Promise.resolve({ data: [] as { source: string | null; location: string | null; created_at: string }[] }),
  ]);

  const views = (viewsRes.data ?? []) as { location: string | null; viewed_at: string }[];
  const leads = (leadsRes.data ?? []) as { source: string | null; location: string | null; created_at: string }[];

  // ── Views-over-time series (one bucket per day, zero-filled) ──────────────
  const series: { date: string; views: number }[] = [];
  const dayIndex: Record<string, number> = {};
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    dayIndex[d] = series.length;
    series.push({ date: d, views: 0 });
  }
  for (const v of views) {
    const k = dayKey(v.viewed_at);
    if (k in dayIndex) series[dayIndex[k]].views++;
  }
  const bestDay = series.reduce<{ date: string; views: number } | null>(
    (best, d) => (d.views > (best?.views ?? 0) ? { date: d.date, views: d.views } : best),
    null,
  );

  // ── Traffic sources (channel that drove each captured contact) ────────────
  const sourceCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.source || "direct_link";
    sourceCounts[s] = (sourceCounts[s] ?? 0) + 1;
  }
  const sources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, label: getSourceLabel(source), count }))
    .sort((a, b) => b.count - a.count);

  // ── Top locations (viewers + captured contacts combined) ──────────────────
  const locCounts: Record<string, number> = {};
  for (const v of views) if (v.location) locCounts[v.location] = (locCounts[v.location] ?? 0) + 1;
  for (const l of leads) if (l.location) locCounts[l.location] = (locCounts[l.location] ?? 0) + 1;
  const locations = Object.entries(locCounts)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const totalViews = views.length;
  const totalSaves = leads.length;
  const conversionRate = totalViews > 0 ? totalSaves / totalViews : 0;

  return { rangeDays, totalViews, totalSaves, conversionRate, bestDay, series, sources, locations };
}
