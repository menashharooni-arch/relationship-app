import type { OfficeAnalytics } from "@/lib/office-analytics";

// Organization + per-employee analytics (spec §10). Presentational — the office
// page computes the data server-side (permission-scoped) and passes it in.
export default function TeamAnalytics({ data }: { data: OfficeAnalytics }) {
  const { totals, employees } = data;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Team analytics</p>

      {/* Org totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Members", value: totals.members },
          { label: "Cards", value: totals.cards },
          { label: "Card views", value: totals.views },
          { label: "Leads", value: totals.leads },
        ].map((s) => (
          <div key={s.label} className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{s.value.toLocaleString()}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-employee breakdown */}
      {employees.length === 0 ? (
        <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl p-8 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No team members yet.</p>
        </div>
      ) : (
        <div className="bg-[#EDE5D8] border border-[#D4C8B8] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F0EBE1] border-b border-[#D4C8B8]">
                <tr>
                  {["Member", "Cards", "Views", "Leads"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4C8B8]">
                {employees.map((e) => (
                  <tr key={e.userId} className="hover:bg-[#E8DECE] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-slate-900 truncate max-w-[160px]">{e.name}</p>
                        {e.isOwner && <span className="shrink-0 text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">Owner</span>}
                      </div>
                      {e.username && <p className="text-slate-400 text-xs truncate max-w-[180px]">@{e.username}</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{e.cards}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{e.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{e.leads.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
