"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
};

export default function LeadCard({ lead }: { lead: Lead }) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [followUp, setFollowUp] = useState(lead.follow_up_date || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(patch: Record<string, string>) {
    setSaving(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4">
      {/* Lead info */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{lead.name}</p>
          <a href={`mailto:${lead.email}`} className="text-blue-400 text-sm hover:underline truncate block">
            {lead.email}
          </a>
          {lead.phone && <p className="text-gray-500 text-sm">{lead.phone}</p>}
        </div>
        <p className="text-gray-600 text-xs shrink-0 pt-0.5">
          {new Date(lead.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </p>
      </div>

      <div className="mt-3 border-t border-gray-800 pt-3 space-y-3">
        {/* Notes */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (lead.notes || "") && save({ notes })}
            placeholder="Add a note… where you met, what you discussed, next steps"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 text-gray-300 placeholder-gray-600 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Follow-up date */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 shrink-0">Follow up on</label>
          <input
            type="date"
            value={followUp}
            onChange={(e) => {
              setFollowUp(e.target.value);
              save({ follow_up_date: e.target.value });
            }}
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
          />
          {followUp && (
            <button
              onClick={() => { setFollowUp(""); save({ follow_up_date: "" }); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Clear
            </button>
          )}
          {saving && <span className="text-xs text-gray-600">Saving…</span>}
          {saved && <span className="text-xs text-blue-400">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
