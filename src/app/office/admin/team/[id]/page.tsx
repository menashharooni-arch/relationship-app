import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { getMemberDetail } from "@/lib/office-analytics";
import { getOfficeUserIds } from "@/lib/office-cards";
import { relativeTime } from "@/lib/relative-time";
import { StatTile, PageHead, Empty, Badge } from "@/components/office/OfficeUI";
import { RemoveMemberButton } from "@/components/office/TeamActions";

export const metadata = { title: "Team member — Admin — SwiftCard" };

export default async function OfficeMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { office, officeId, ownerId, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");

  // Authorization: only someone this office actually controls. Without this, any
  // office admin could read any user's activity by pasting a user id in the URL.
  const teamIds = await getOfficeUserIds(officeId);
  if (!teamIds.includes(id)) notFound();

  const m = await getMemberDetail(id);
  if (!m) notFound();

  const isOwner = id === ownerId;
  // Removal needs the office_members ROW id, not the user id. The owner has no
  // member row (and can't be removed from their own team).
  const memberRow = ((office.office_members ?? []) as Array<{ id: string; user_id: string | null; status: string }>)
    .find((r) => r.user_id === id && r.status === "active");

  return (
    <div>
      <Link href="/office/admin" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        ← Back to team
      </Link>

      <div className="mt-3">
        <PageHead
          title={m.name}
          desc={m.email ?? undefined}
          action={
            !isOwner && memberRow && caps.canRemove ? (
              <RemoveMemberButton memberId={memberRow.id} personName={m.name} canManageSeats={caps.canManageSeats} />
            ) : undefined
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile label="Card views" value={m.totals.views} hint="Times someone opened their card" />
        <StatTile label="Views · last 30 days" value={m.totals.views30} />
        <StatTile label="Leads captured" value={m.totals.leads} hint="People who shared their info" />
      </div>

      {/* Their cards, with the actions an owner actually needs. */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Their cards</p>
      {m.cards.length === 0 ? (
        <Empty>
          They haven&apos;t created their card yet.
          {" "}If their invite email got lost, resend it from the Team page.
        </Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden mb-8">
          {m.cards.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium truncate">{c.label || c.name || "Their card"}</p>
                  {c.isOffline ? <Badge tone="gray">Turned off</Badge> : <Badge tone="green">Live</Badge>}
                </div>
                <p className="text-xs text-gray-500 tabular-nums mt-0.5">{c.views} views · {c.leads} leads</p>
              </div>
              {caps.canManageCards && (
                <Link
                  href={`/office/admin/cards/${c.id}`}
                  className="text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3.5 py-2 rounded-full transition-colors shrink-0"
                >
                  View & edit card →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* The people this person has brought in. */}
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Leads they captured</p>
      {m.recentLeads.length === 0 ? (
        <Empty>No leads yet — leads appear here when someone shares their info on this person&apos;s card.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden">
          {m.recentLeads.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-200 truncate">{l.name}</p>
                <p className="text-xs text-gray-500 truncate">{l.email ?? "No email left"}</p>
              </div>
              <p className="text-xs text-gray-600 shrink-0 whitespace-nowrap">{relativeTime(l.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
