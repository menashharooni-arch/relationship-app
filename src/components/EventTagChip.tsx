"use client";

import { useState } from "react";

// "At an event?" on the dashboard's Share box — where the owner is when they
// are showing their QR code. Names the event once; every contact captured
// through the card until local midnight is saved as "met at" it, which is
// what a returning-contact alert says back to them later (lib/event-tag.ts).
export default function EventTagChip({ initial }: { initial: { label: string } | null }) {
  const [active, setActive] = useState<string | null>(initial?.label ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (label: string | null) => {
    setSaving(true);
    setError(null);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    try {
      const res = await fetch("/api/profile/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, until: midnight.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't save");
      setActive(data.event?.label ?? null);
      setEditing(false);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
    setSaving(false);
  };

  if (active) {
    return (
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="min-w-0 text-xs text-gray-400 leading-snug">
          Today&apos;s new contacts are saved as met at <span className="font-semibold text-white">{active}</span>
        </p>
        <button type="button" disabled={saving} onClick={() => save(null)} className="shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50">
          Stop
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="w-full text-center text-xs font-semibold text-gray-400 hover:text-white pt-1">
        At an event? Tag today&apos;s contacts
      </button>
    );
  }

  return (
    // A real form with method="post": everything is interactive before it
    // hydrates, and a GET would put the text in the URL (AGENTS.md).
    <form
      method="post"
      action="/api/profile/event"
      onSubmit={(e) => { e.preventDefault(); void save(draft); }}
      className="pt-1 space-y-2"
    >
      <label className="block text-xs text-gray-400" htmlFor="event-tag-input">Where are you meeting people today?</label>
      <div className="flex items-center gap-2">
        <input
          id="event-tag-input"
          name="label"
          autoFocus
          maxLength={40}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. RE/MAX Summit"
          className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-base sm:text-sm text-white placeholder-gray-500"
        />
        <button type="submit" disabled={saving || !draft.trim()} className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
