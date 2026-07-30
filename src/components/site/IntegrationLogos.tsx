import { INTEGRATIONS } from "./integration-brands";

// Homepage integrations band. The list itself lives in integration-brands.tsx so
// this strip, the /products/integrations grid and the feature copy can never
// again advertise three different sets of tools.

export default function IntegrationLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {INTEGRATIONS.map((it) => (
        <div key={it.name} className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_14px_36px_-18px_rgba(0,0,0,0.6)]">
          <span className="w-7 h-7 flex items-center justify-center shrink-0">{it.logo}</span>
          <span className="text-slate-800 text-[14px] font-semibold whitespace-nowrap">{it.name}</span>
        </div>
      ))}
    </div>
  );
}
