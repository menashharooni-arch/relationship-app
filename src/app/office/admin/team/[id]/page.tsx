import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getMemberDetail } from "@/lib/office-analytics";
import { getOfficeUserIds } from "@/lib/office-cards";
import { StatTile, PageHead, Empty, Badge } from "@/components/office/OfficeUI";

export const metadata = { title: "Member — Admin — SwiftCard" };

export default async function OfficeMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { office, officeId } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  // Authorization: only someone this office actually controls. Without this, any
  // office admin could read any user's activity by pasting a user id in the URL.
  const teamIds = await getOfficeUserIds(officeId);
  if (!teamIds.includes(id)) notFound();

  const m = await getMemberDetail(id);
  if (!m) notFound();

  return (
    <div>
      <Link href="/office/admin/team" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        ← Team
      </Link>

      <div className="mt-3">
        <PageHead title={m.name} desc={m.email ?? (m.username ? `@${m.username}` : undefined)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatTile label="Cards" value={m.totals.cards} />
        <StatTile label="Card views" value={m.totals.views} />
        <StatTile label="Views (30d)" value={m.totals.views30} />
        <StatTile label="Leads captured" value={m.totals.leads} />
      </div>

      {/* Their cards */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Their cards</p>
      {m.cards.length === 0 ? (
        <Empty>They haven&apos;t created a card yet.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden mb-8">
          {m.cards.map((c) => (
            <Link
              key={c.id}
              href={`/office/admin/cards/${c.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium truncate">{c.label || c.name || "Untitled card"}</p>
                  {c.isOffline && <Badge tone="gray">Offline</Badge>}
                </div>
                <p className="text-xs text-gray-500 truncate">/card/{c.username}</p>
              </div>
              <p className="text-xs text-gray-500 tabular-nums shrink-0">{c.views} views · {c.leads} leads</p>
            </Link>
          ))}
        </div>
      )}

      {/* Recent activity */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent leads</p>
      {m.recentLeads.length === 0 ? (
        <Empty>No leads captured yet.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden">
          {m.recentLeads.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{l.name}</p>
                <p className="text-xs text-gray-500 truncate">{l.email ?? "—"}</p>
              </div>
              <p className="text-xs text-gray-600 shrink-0 whitespace-nowrap">
                {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
