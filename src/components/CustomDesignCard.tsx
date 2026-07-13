import Link from "next/link";

// The entry point to the freeform custom designer — the "edit every element"
// path (drag/resize/recolor text, logo, photo, QR, icons; full control of
// layout & spacing). Presented as a descriptive card so its value is clear,
// not a bare toggle. Pro-gated. Used by the new-card wizard and the edit form.
export default function CustomDesignCard({
  isPro,
  selected,
  onSelect,
}: {
  isPro: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => { if (isPro) onSelect(); }}
        disabled={!isPro}
        aria-pressed={selected}
        className="w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors disabled:cursor-default"
        style={{
          background: selected ? "rgba(37,99,235,0.12)" : "#111827",
          borderColor: selected ? "#2563eb" : "#374151",
        }}
      >
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: selected ? "rgba(37,99,235,0.25)" : "rgba(59,130,246,0.12)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth={1.7} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: selected ? "#fff" : "#e5e7eb" }}>
            Custom design
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white align-middle">PRO</span>
          </p>
          <p className="text-[11px] leading-snug mt-0.5" style={{ color: selected ? "#bfdbfe" : "#9ca3af" }}>
            Start from a blank canvas — drag, resize &amp; recolor every element: text, logo, photo, QR and icons. Full control of layout and spacing.
          </p>
        </div>
        <span className="text-xs font-semibold shrink-0 self-center" style={{ color: selected ? "#93c5fd" : "#9ca3af" }}>
          {selected ? "Selected" : isPro ? "Design →" : "🔒"}
        </span>
      </button>
      {!isPro && (
        <Link href="/pricing" className="block text-center text-[11px] text-blue-400 hover:text-blue-300 mt-2">
          Make it unmistakably yours — unlock the custom designer with Pro →
        </Link>
      )}
    </>
  );
}
