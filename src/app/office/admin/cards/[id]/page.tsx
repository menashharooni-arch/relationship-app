import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOfficeAdmin } from "@/lib/office-admin-guard";
import { listOfficeCards } from "@/lib/office-cards";
import { getCardStats } from "@/lib/office-analytics";
import { StatTile, PageHead, Badge } from "@/components/office/OfficeUI";
import OfficeCardActions from "@/components/office/OfficeCardActions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export const metadata = { title: "Card — Admin — SwiftCard" };

export default async function OfficeCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { office, officeId, caps } = await requireOfficeAdmin();
  if (!office || !officeId) redirect("/office/admin");
  if (!caps.canManageCards) redirect("/office/admin");

  // Authorization: resolve the card from THIS office's own list, so a card id
  // from another office can't be opened by pasting it into the URL.
  const cards = await listOfficeCards(officeId).catch(() => []);
  const card = cards.find((c) => c.id === id);
  if (!card) notFound();

  const stats = await getCardStats(card.username).catch(() => ({ views: 0, views30: 0, leads: 0 }));

  return (
    <div>
      <Link href="/office/admin/cards" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        ← Cards
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight truncate">
              {card.label || card.name || "Untitled card"}
            </h1>
            {card.isPrimary && <Badge tone="purple">Primary</Badge>}
            {card.is_offline ? <Badge tone="gray">Offline</Badge> : <Badge tone="green">Live</Badge>}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">/card/{card.username}</p>
        </div>
      </div>

      {card.isPrimary && (
        <p className="text-[11px] text-purple-300/80 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 mb-5">
          This is your team&apos;s primary card. Its logo, company, website and design are what every other card on the team inherits — editing it re-brands everyone.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatTile label="Card views" value={stats.views} />
        <StatTile label="Views (30d)" value={stats.views30} />
        <StatTile label="Leads captured" value={stats.leads} />
      </div>

      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Details</p>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800 mb-6">
        {([
          ["Owner", card.ownerName || card.ownerEmail || "—"],
          ["Name on card", card.name || "—"],
          ["Title", card.title || "—"],
          ["Email", card.email || "—"],
          ["Phone", card.phone || "—"],
          ["Template", card.template || "—"],
          ["Created", card.created_at ? new Date(card.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"],
        ] as const).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-2.5">
            <span className="text-xs text-gray-500 shrink-0">{k}</span>
            <span className="text-sm text-gray-200 truncate">{v}</span>
          </div>
        ))}
      </div>

      <PageHead title="Manage" desc="Edit this person's details, or pull the card offline." />
      <OfficeCardActions
        card={{
          id: card.id,
          username: card.username,
          name: card.name,
          title: card.title,
          email: card.email,
          phone: card.phone,
          is_offline: card.is_offline,
          isPrimary: card.isPrimary,
        }}
        appUrl={APP_URL}
      />
    </div>
  );
}
