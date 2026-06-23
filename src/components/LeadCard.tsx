"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

type Status = "new" | "hot" | "warm" | "cold" | "closed";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  new:    { label: "New",    bg: "#1f2937", color: "#9ca3af" },
  hot:    { label: "Hot",    bg: "#7c1d1d", color: "#fca5a5" },
  warm:   { label: "Warm",   bg: "#78350f", color: "#fcd34d" },
  cold:   { label: "Cold",   bg: "#1e3a5f", color: "#93c5fd" },
  closed: { label: "Won",    bg: "#14532d", color: "#86efac" },
};

const STATUS_ORDER: Status[] = ["new", "hot", "warm", "cold", "closed"];

function nextStatus(current: string): Status {
  const idx = STATUS_ORDER.indexOf(current as Status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

export default function LeadCard({ lead }: { lead: Lead }) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [status, setStatus] = useState<Status>((lead.status as Status) || "new");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function patch(fields: Record<string, string>) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  }

  async function saveNotes() {
    if (notes === (lead.notes || "")) return;
    setSaving(true);
    await patch({ notes });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function cycleStatus() {
    const next = nextStatus(status);
    setStatus(next);
    await patch({ status: next });
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / 86400000
  );
  const nextReminder = [1, 15, 30].find((d) => d > daysSince);
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-white font-semibold truncate">{lead.name}</p>
            {/* Status badge — click to cycle */}
            <button
              onClick={cycleStatus}
              title="Click to change status"
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </button>
          </div>
          <a
            href={`mailto:${lead.email}`}
            className="text-blue-400 text-sm hover:underline truncate block"
          >
            {lead.email}
          </a>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
              {lead.phone}
            </a>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-gray-600 text-xs">
            {new Date(lead.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {nextReminder && (
            <p className="text-gray-700 text-xs mt-1">Reminder day {nextReminder}</p>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-gray-800 pt-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add a note… where you met, what you discussed, next steps"
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 text-gray-300 placeholder-gray-600 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-500 transition-colors"
        />
        {saving && <p className="text-gray-600 text-xs mt-1">Saving…</p>}
        {saved && <p className="text-blue-400 text-xs mt-1">Saved ✓</p>}
      </div>
    </div>
  );
}
