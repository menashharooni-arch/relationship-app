import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getOfficeAnalytics } from "@/lib/office-analytics";
import { PageHead, Empty, Badge } from "@/components/office/OfficeUI";

export const metadata = { title: "Team — Admin — SwiftCard" };

export default async function OfficeTeamPage() {
  const { office, officeId, ownerId } = await requireOfficeAdmin();
  if (!office || !officeId || !ownerId) redirect("/office/admin");

  const analytics = await getOfficeAnalytics(officeId, ownerId).catch(() => null);
  const people = analytics?.employees ?? [];

  return (
    <div>
      <PageHead
        title="Team"
        desc="Every person on your team, and what their cards are doing. Click anyone to see their activity."
      />

      {people.length === 0 ? (
        <Empty>No team members yet.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Static col-span classes — Tailwind can't see interpolated ones. */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-5">Person</p>
            <p className="col-span-2">Cards</p>
            <p className="col-span-2">Views</p>
            <p className="col-span-2">Leads</p>
          </div>
          <div className="divide-y divide-gray-800">
            {people.map((p) => (
              <Link
                key={p.userId}
                href={`/office/admin/team/${p.userId}`}
                className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-gray-800/50 transition-colors"
              >
                <div className="col-span-12 md:col-span-5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{p.name}</p>
                    {p.isOwner && <Badge tone="purple">Owner</Badge>}
                  </div>
                  {p.username && <p className="text-xs text-gray-500 truncate">@{p.username}</p>}
                </div>
                <p className="col-span-4 md:col-span-2 text-sm text-gray-300 tabular-nums">
                  <span className="md:hidden text-gray-600 text-xs">Cards </span>{p.cards}
                </p>
                <p className="col-span-4 md:col-span-2 text-sm text-gray-300 tabular-nums">
                  <span className="md:hidden text-gray-600 text-xs">Views </span>{p.views}
                </p>
                <p className="col-span-4 md:col-span-2 text-sm text-gray-300 tabular-nums">
                  <span className="md:hidden text-gray-600 text-xs">Leads </span>{p.leads}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
