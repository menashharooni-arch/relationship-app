import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getAdminSupabase } from "@/lib/supabase-admin";
import {
  getOfficeTeam,
  memberSlugs,
  flattenOfficeKeys,
  getOfficeEmployeeMetricsForTeam,
  getOfficeDailyViews,
  getOfficeTrafficSources,
} from "@/lib/office-analytics";
import { resolveDateRange, previousPeriod, type DateRangePreset } from "@/lib/office-analytics-dates";
import { computeConversionRate, pctChange, fillDateRange } from "@/lib/office-analytics-metrics";
import { getSourceLabel } from "@/lib/source-labels";
import { StatTile, PageHead, Empty } from "@/components/office/OfficeUI";
import ViewsChart from "@/components/ViewsChart";
import EmployeeAnalyticsTable from "./EmployeeAnalyticsTable";
import AnalyticsDateRangePicker from "./AnalyticsDateRangePicker";

export const metadata = { title: "Analytics — Admin — SwiftCard" };

const PRESETS: DateRangePreset[] = ["7d", "30d", "90d"];

function deltaLabel(current: number, previous: number): string | undefined {
  const pct = pctChange(current, previous);
  if (pct === null) return current > 0 ? "New this period" : undefined;
  if (pct === 0 && previous === 0) return undefined;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${(pct * 100).toFixed(0)}% vs prior period`;
}

export default async function OfficeAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { office, officeId, ownerId } = await requireOfficeAdmin();
  if (!office || !officeId || !ownerId) redirect("/office/admin");

  const { range: rawRange } = await searchParams;
  const preset: DateRangePreset = (PRESETS as string[]).includes(rawRange ?? "") ? (rawRange as DateRangePreset) : "30d";
  const range = resolveDateRange(preset, new Date());
  const prevRange = previousPeriod(range);

  let employees: Awaited<ReturnType<typeof getOfficeEmployeeMetricsForTeam>> = [];
  let prevEmployees: Awaited<ReturnType<typeof getOfficeEmployeeMetricsForTeam>> = [];
  let dailyViews: { date: string; views: number }[] = [];
  let trafficSources: { source: string; views: number }[] = [];
  let loadError = false;

  try {
    // Resolved ONCE and reused for both periods' metrics + the keys below —
    // each of getOfficeEmployeeMetrics/getOfficeKeys used to re-resolve the
    // team internally, tripling this same query chain per page load (code
    // review).
    const team = await getOfficeTeam(getAdminSupabase(), officeId, ownerId);
    const keys = flattenOfficeKeys(team.flatMap((m) => memberSlugs(m)));
    [employees, prevEmployees, dailyViews, trafficSources] = await Promise.all([
      getOfficeEmployeeMetricsForTeam(team, range.since, range.until),
      getOfficeEmployeeMetricsForTeam(team, prevRange.since, prevRange.until),
      getOfficeDailyViews(keys, range.since, range.until),
      getOfficeTrafficSources(keys, range.since, range.until),
    ]);
  } catch (e) {
    console.error("Office analytics dashboard failed to load:", e);
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <PageHead title="Analytics" desc="Which employees and cards are generating real engagement and leads." />
        <Empty>Couldn&apos;t load analytics right now — try refreshing in a moment.</Empty>
      </div>
    );
  }

  const totalViews = employees.reduce((s, e) => s + e.views + e.swiftlinkViews, 0);
  const totalUnique = employees.reduce((s, e) => s + e.uniqueVisitors, 0);
  const totalScans = employees.reduce((s, e) => s + e.scans, 0);
  const totalLeads = employees.reduce((s, e) => s + e.leads, 0);
  const totalContacts = employees.reduce((s, e) => s + e.contactsSaved, 0);
  const totalSwiftlinkViews = employees.reduce((s, e) => s + e.swiftlinkViews, 0);
  const conversionRate = computeConversionRate(totalLeads, totalViews);

  const prevTotalViews = prevEmployees.reduce((s, e) => s + e.views + e.swiftlinkViews, 0);
  const prevTotalScans = prevEmployees.reduce((s, e) => s + e.scans, 0);
  const prevTotalLeads = prevEmployees.reduce((s, e) => s + e.leads, 0);
  const prevTotalContacts = prevEmployees.reduce((s, e) => s + e.contactsSaved, 0);

  const chartData = fillDateRange(dailyViews, range.since, range.until);
  const isEmpty = totalViews === 0 && totalLeads === 0 && totalContacts === 0;

  return (
    <div>
      <PageHead
        title="Analytics"
        desc="Which employees and cards are generating real engagement and leads."
        action={<AnalyticsDateRangePicker current={preset} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Card views" value={totalViews} hint={deltaLabel(totalViews, prevTotalViews)} />
        <StatTile label="Unique visitors" value={totalUnique} hint="Deduped per visitor per 24h" />
        <StatTile label="Card/QR scans" value={totalScans} hint={deltaLabel(totalScans, prevTotalScans)} />
        <StatTile label="Leads captured" value={totalLeads} hint={deltaLabel(totalLeads, prevTotalLeads)} />
        <StatTile label="Contacts saved" value={totalContacts} hint={deltaLabel(totalContacts, prevTotalContacts)} />
        <StatTile label="SwiftLink views" value={totalSwiftlinkViews} hint="Visits to a Swift Links page" />
        <StatTile
          label="Conversion rate"
          value={conversionRate == null ? "—" : `${(conversionRate * 100).toFixed(1)}%`}
          hint="Leads captured ÷ card views"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Views over time</p>
        {isEmpty ? (
          <Empty>No activity yet for this range — this fills in once your team&apos;s cards start getting views.</Empty>
        ) : (
          <ViewsChart data={chartData} />
        )}
      </div>

      {trafficSources.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Traffic sources</p>
          <div className="space-y-1.5">
            {trafficSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{getSourceLabel(s.source)}</span>
                <span className="text-gray-500 tabular-nums">{s.views}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Team performance</p>
      <EmployeeAnalyticsTable employees={employees} range={preset} />
    </div>
  );
}
