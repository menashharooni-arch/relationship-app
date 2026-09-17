"use client";

// Mobile-only pill row shown above the plan grid (Free/Pro/Office stack in a
// single column below `md`, forcing a lot of scrolling to compare them). This
// lets a phone visitor jump straight to one tier — defaulting to Pro, since
// that's the plan we want most visitors on mobile to land on — instead of
// scrolling past Free first. Desktop already shows all three side by side and
// never renders this.
export type PlanTier = "free" | "pro" | "office";

const TABS: { key: PlanTier; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "pro", label: "Pro" },
  { key: "office", label: "Office" },
];

export default function MobilePlanTabs({
  active,
  onChangeAction,
  tiers,
  dark = false,
}: {
  active: PlanTier;
  onChangeAction: (tier: PlanTier) => void;
  tiers?: PlanTier[];
  /** Use on a dark/aurora background (e.g. PlanCards on the card wizard) so
   *  the pill row is visible against dark surfaces instead of slate-on-white. */
  dark?: boolean;
}) {
  const tabs = tiers ? TABS.filter((t) => tiers.includes(t.key)) : TABS;

  return (
    <div className="md:hidden flex justify-center mb-5">
      {/* dark: theme classes, so the light theme (most /welcome visitors) keeps
          the unselected tabs readable — the white/70 inline colour vanished on
          cream (2026-09-16 web run). */}
      <div className={`inline-flex items-center gap-1 rounded-full p-1 border ${dark ? "bg-gray-900 border-gray-800" : "bg-slate-100 border-slate-200"}`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChangeAction(t.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${active !== t.key && dark ? "text-gray-300" : ""}`}
            style={{
              background: active === t.key ? "#2563EB" : "transparent",
              ...(active === t.key ? { color: "#fff" } : dark ? {} : { color: "#334155" }),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
