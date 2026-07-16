"use client";

import { useState } from "react";
import { normalizeSlug } from "@/lib/username";

// Editable card URL (slug). Collapsed it just shows the current URL with a
// "Change" link; expanded it lets the owner set a new slug, with an explicit
// warning that already-shared links/QR codes/Wallet passes stop working (the
// server-side rename migrates all views/leads/analytics to the new slug, so
// data isn't lost — only the old public URL stops resolving).
export default function CardUrlEditor({ cardId, currentSlug }: { cardId: string; currentSlug: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentSlug);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  const normalized = normalizeSlug(value);
  const changed = normalized && normalized !== currentSlug;

  async function save() {
    if (!changed || status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/cards/${cardId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't change the URL. Please try again.");
        setStatus("idle");
        return;
      }
      // Re-fetch the page so every server-rendered reference to the slug
      // (this field, the card URL, share links) reflects the new value.
      window.location.reload();
    } catch {
      setError("Network error — please try again.");
      setStatus("idle");
    }
  }

  if (!open) {
    return (
      <p className="text-gray-600 text-xs mt-1">
        Card URL: /card/{currentSlug}{" "}
        <button type="button" onClick={() => { setOpen(true); setValue(currentSlug); setError(""); }} className="text-blue-400 hover:text-blue-300 font-semibold ml-1">
          Change
        </button>
      </p>
    );
  }

  return (
    <div className="mt-2 bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-2">
      <label className="block text-[11px] font-medium text-gray-400">Card URL</label>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500 text-xs shrink-0">/card/</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="your-name"
          className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>
      {normalized && normalized !== value && (
        <p className="text-gray-500 text-[11px]">Will be saved as <span className="text-gray-300">/card/{normalized}</span></p>
      )}
      <p className="text-amber-400/90 text-[11px] leading-relaxed">
        Heads up: any QR codes, printed links, or Wallet passes with your old URL will stop working. Your views, leads,
        and analytics move to the new URL automatically.
      </p>
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={!changed || status === "saving"}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 bg-blue-600 hover:bg-blue-500 text-white"
        >
          {status === "saving" ? "Changing…" : "Change URL"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setValue(currentSlug); setError(""); }}
          disabled={status === "saving"}
          className="text-xs font-semibold px-3 py-1.5 rounded-full text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
