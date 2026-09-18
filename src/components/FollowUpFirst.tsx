import Link from "next/link";

// "Follow up first" — the top of the dashboard's Quick Contacts column
// (warm-lead plan §2.6). The contacts most worth a message right now, each
// with the real reason (lib/intent-score.ts), one tap from their contact.
//
// HIDDEN WHEN THERE IS NOTHING TO SAY: an empty "nobody is warm" box is the
// negative analytics the notification rules forbid. Free sees how many, never
// who, and nothing about plans (the location-blur rule).
export type FollowUpItem = { id: string; name: string; tier: "hot" | "warm"; reason: string | null };

export default function FollowUpFirst({
  items,
  warmingCount,
  card,
}: {
  /** Pro: up to five, already ordered. Empty for Free. */
  items: FollowUpItem[];
  /** Free: how many contacts are warming up. 0 for Pro. */
  warmingCount: number;
  card: string;
}) {
  if (!items.length && warmingCount <= 0) return null;
  const q = card ? `card=${encodeURIComponent(card)}&` : "";

  return (
    <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-4 mb-4">
      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Follow up first</p>
      {items.length ? (
        <ul className="divide-y divide-gray-800">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={`/contacts?${q}lead=${it.id}`} className="flex items-center gap-3 py-2 group">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-100 truncate group-hover:text-blue-300">{it.name || "Contact"}</span>
                    <span className={`shrink-0 text-[0.625rem] font-bold px-2 py-0.5 rounded-full ${it.tier === "hot" ? "bg-red-950/60 text-red-300" : "bg-amber-950/60 text-amber-300"}`}>
                      {it.tier === "hot" ? "Hot" : "Warm"}
                    </span>
                  </span>
                  {it.reason && <span className="block text-xs text-gray-400 truncate first-letter:uppercase">{it.reason}</span>}
                </span>
                <span aria-hidden className="shrink-0 text-gray-500 group-hover:text-gray-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-300">
          {warmingCount === 1 ? "1 contact is" : `${warmingCount} contacts are`} warming up.
        </p>
      )}
    </div>
  );
}
