import { Badge } from "@/components/office/OfficeUI";
import type { OfficeFollowUp } from "@/lib/office-leads";

// The team's Hot and Warm contacts, above the Leads table (warm-lead plan C5).
// Hidden when there are none: an empty "nobody is warm" box is negative
// analytics. No link into the contact: it belongs to the member's own
// Contacts, which an admin doesn't open — the member's name says who to nudge.
export default function TeamFollowUp({ items }: { items: OfficeFollowUp[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
      <p className="text-white font-semibold text-sm">Follow up first</p>
      <p className="text-gray-500 text-xs mt-0.5 mb-3">Your team&apos;s contacts who have come back to a card recently, hottest first.</p>
      <ul className="divide-y divide-gray-800">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-100 truncate">{it.name}</span>
                <Badge tone={it.tier === "hot" ? "red" : "amber"}>{it.tier === "hot" ? "Hot" : "Warm"}</Badge>
              </span>
              {it.reason && <span className="block text-xs text-gray-400 truncate first-letter:uppercase">{it.reason}</span>}
            </span>
            <span className="shrink-0 max-w-[40%] truncate text-xs text-gray-500">{it.capturedBy}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
