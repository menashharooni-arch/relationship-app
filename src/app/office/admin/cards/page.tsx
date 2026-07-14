import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { listOfficeCards } from "@/lib/office-cards";
import { PageHead, Empty, Badge, StatTile } from "@/components/office/OfficeUI";

export const metadata = { title: "Cards — Admin — SwiftCard" };

export default async function OfficeCardsPage() {
  const { office, officeId, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");
  if (!caps.canManageCards) redirect("/office/admin");

  const cards = await listOfficeCards(officeId).catch(() => []);
  const live = cards.filter((c) => !c.is_offline).length;
  const offline = cards.length - live;

  return (
    <div>
      <PageHead title="Cards" desc="Every card on your team. Click one to see its analytics, edit it, or take it offline." />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile label="Total cards" value={cards.length} />
        <StatTile label="Live" value={live} />
        <StatTile label="Offline" value={offline} />
      </div>

      {cards.length === 0 ? (
        <Empty>No cards yet. Invite your team to get started.</Empty>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800 bg-gray-900/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            <p className="col-span-5">Card</p>
            <p className="col-span-4">Owner</p>
            <p className="col-span-3">Status</p>
          </div>
          <div className="divide-y divide-gray-800">
            {cards.map((c) => (
              <Link
                key={c.id}
                href={`/office/admin/cards/${c.id}`}
                className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-gray-800/50 transition-colors"
              >
                <div className="col-span-12 md:col-span-5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-white font-medium truncate">{c.label || c.name || "Untitled card"}</p>
                    {c.isPrimary && <Badge tone="purple">Primary</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">/card/{c.username}</p>
                </div>
                <p className="col-span-8 md:col-span-4 text-xs text-gray-400 truncate">{c.ownerName || c.ownerEmail || "—"}</p>
                <div className="col-span-4 md:col-span-3">
                  {c.is_offline ? <Badge tone="gray">Offline</Badge> : <Badge tone="green">Live</Badge>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
