import { INTEGRATIONS } from "./integration-brands";

// Homepage integrations band. The list itself lives in integration-brands.tsx so
// this strip, the /products/integrations grid and the feature copy can never
// again advertise three different sets of tools.

export default function IntegrationLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {INTEGRATIONS.map((it) => (
        <div key={it.name} className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 border border-slate-200 shadow-[0_10px_26px_-18px_rgba(11,16,34,0.35)]">
          <span className="w-7 h-7 flex items-center justify-center shrink-0">{it.logo}</span>
          <span className="text-slate-800 text-[0.875rem] font-semibold whitespace-nowrap">{it.name}</span>
        </div>
      ))}
    </div>
  );
}
