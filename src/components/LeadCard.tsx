"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export default function LeadCard({ lead }: { lead: Lead }) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{lead.name}</p>
          <a href={`mailto:${lead.email}`} className="text-blue-400 text-sm hover:underline truncate block">{lead.email}</a>
          {lead.phone && <p className="text-gray-500 text-sm">{lead.phone}</p>}
        </div>
        <p className="text-gray-600 text-xs shrink-0 pt-0.5">
          {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Notes */}
      <div className="mt-3 border-t border-gray-800 pt-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note… where you met, what you discussed, next steps"
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 text-gray-300 placeholder-gray-600 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-500 transition-colors"
        />
        {notes !== (lead.notes || "") && (
          <button
            onClick={saveNotes}
            disabled={saving}
            className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save note"}
          </button>
        )}
      </div>
    </div>
  );
}
