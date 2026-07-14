import Link from "next/link";
import CreateOfficeForm from "@/components/CreateOfficeForm";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeAnalytics } from "@/lib/office-analytics";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { PLAN_LIMITS } from "@/lib/plan";
import { StatTile, PageHead, Empty } from "@/components/office/OfficeUI";

export const metadata = { title: "Admin — SwiftCard" };

export default async function OfficeOverviewPage() {
  const { office, officeId, ownerId } = await requireOfficeAdmin();

  // On Office but no office row yet → the one thing to do is name the team.
  if (!office || !officeId || !ownerId) {
    return (
      <div className="max-w-md mx-auto pt-6">
        <CreateOfficeForm />
      </div>
    );
  }

  const seatCap = (office.seats as number | null) ?? PLAN_LIMITS.OFFICE_MIN_SEATS;
  const [analytics, seats] = await Promise.all([
    getOfficeAnalytics(officeId, ownerId).catch(() => null),
    getOfficeSeatUsage(officeId, seatCap).catch(() => null),
  ]);

  return (
    <div>
      <PageHead title="Overview" desc="How your team is doing at a glance." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Members" value={analytics?.totals.members ?? 0} />
        <StatTile label="Cards" value={analytics?.totals.cards ?? 0} />
        <StatTile label="Card views" value={analytics?.totals.views ?? 0} />
        <StatTile label="Leads captured" value={analytics?.totals.leads ?? 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Seats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Seats</p>
            <Link href="/office/admin/invite" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              Invite →
            </Link>
          </div>
          {seats ? (
            <>
              <p className="text-2xl font-bold text-white tabular-nums">
                {seats.used}<span className="text-gray-600 text-base font-medium"> / {seats.purchased}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {seats.available > 0
                  ? `${seats.available} seat${seats.available === 1 ? "" : "s"} available`
                  : "All seats are in use — add one to invite anybody else."}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((seats.used / Math.max(1, seats.purchased)) * 100))}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-gray-600 text-sm">Seat usage unavailable.</p>
          )}
        </div>

        {/* Top people */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Most active</p>
            <Link href="/office/admin/team" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              All team →
            </Link>
          </div>
          {analytics?.employees.length ? (
            <div className="space-y-2">
              {analytics.employees.slice(0, 4).map((e) => (
                <Link
                  key={e.userId}
                  href={`/office/admin/team/${e.userId}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-gray-800/60 transition-colors"
                >
                  <span className="text-sm text-gray-300 truncate">{e.name}</span>
                  <span className="text-xs text-gray-500 tabular-nums shrink-0">{e.views} views · {e.leads} leads</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No activity yet.</p>
          )}
        </div>
      </div>

      {!analytics?.totals.cards && (
        <div className="mt-4">
          <Empty>No cards yet. Invite your team from the Invite tab to get started.</Empty>
        </div>
      )}
    </div>
  );
}
