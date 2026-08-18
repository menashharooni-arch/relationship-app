"use client";

// Per-link tile size for the Swift Links page (see lib/swiftlink-tiles):
// Auto (odd-one-out promotion), Featured (full-width image tile), Grid
// (half-width pair), Compact (slim row). Rendered inside each link row of the
// wizard's Socials step and the editor's Socials tab — PRO ONLY: Free pages
// render every link compact, so showing Free a size picker would be a control
// that lies. The callers gate on plan and simply omit it for Free.

import type { TileSize } from "@/lib/swiftlink-tiles";

const OPTIONS: { value: TileSize | undefined; label: string }[] = [
  { value: undefined, label: "Auto" },
  { value: "featured", label: "Featured" },
  { value: "grid", label: "Grid" },
  { value: "compact", label: "Compact" },
];

export default function LinkSizeControl({
  value,
  onChange,
}: {
  value?: TileSize;
  onChange: (size: TileSize | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Tile size on your Swift Links page">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
              active ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
