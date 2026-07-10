// Product-style analytics surface (Linear-restrained). Presentational only —
// mirrors the real dashboard's Traffic + Locations + Contacts, with fictional data.

const BARS = [30, 42, 38, 55, 47, 68, 60, 74, 66, 88, 79, 96, 84, 100];
const LOCATIONS = [
  { city: "San Francisco, US", card: 142, link: 88 },
  { city: "New York, US", card: 96, link: 54 },
  { city: "Austin, US", card: 61, link: 40 },
  { city: "London, UK", card: 38, link: 29 },
];
const CONTACTS = [
  { name: "Sarah Chen", meta: "Saved your contact · 2m ago", i: "SC" },
  { name: "Marcus Webb", meta: "Shared their info · 18m ago", i: "MW" },
  { name: "Elena Diaz", meta: "Viewed your card · 1h ago", i: "ED" },
];

export default function AnalyticsPanel() {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[#0E1017] p-5 sm:p-6 shadow-2xl overflow-hidden">
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
        {/* Traffic */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-[15px]">Traffic</p>
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.05] p-0.5">
              {["Today", "Week", "Month"].map((t, i) => (
                <span key={t} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${i === 1 ? "bg-white/10 text-white" : "text-white/40"}`}>{t}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[["SwiftCard views", "1,284", "#5D6BFF"], ["Swift Link views", "742", "#22D3EE"]].map(([label, val, c]) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                <p className="text-white/45 text-[11px]">{label}</p>
                <p className="text-white text-[26px] font-bold tabular-nums mt-0.5">{val}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: c as string }}>▲ 23% this week</p>
              </div>
            ))}
          </div>
          {/* bar chart */}
          <div className="flex items-end gap-[5px] h-[92px]">
            {BARS.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: i === BARS.length - 1 ? "var(--rd-aurora)" : "rgba(93,107,255,0.35)" }} />
            ))}
          </div>
        </div>

        {/* Right column: locations + contacts */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wide mb-3">Top locations</p>
            <div className="space-y-2.5">
              {LOCATIONS.map((l) => (
                <div key={l.city}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-white/80">📍 {l.city}</span>
                    <span className="text-white/40 tabular-nums">{l.card + l.link}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex">
                    <div style={{ width: `${(l.card / 230) * 100}%`, background: "#5D6BFF" }} />
                    <div style={{ width: `${(l.link / 230) * 100}%`, background: "#22D3EE" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wide mb-3">Recent contacts</p>
            <div className="space-y-2">
              {CONTACTS.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "var(--rd-aurora)" }}>{c.i}</span>
                  <span className="min-w-0">
                    <span className="block text-white text-[13px] font-semibold truncate">{c.name}</span>
                    <span className="block text-white/40 text-[11px] truncate">{c.meta}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
