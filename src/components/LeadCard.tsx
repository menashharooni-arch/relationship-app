"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

type Status = "new" | "hot" | "warm" | "cold" | "closed";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  new:    { label: "New",    bg: "#f1f5f9", color: "#475569" },
  hot:    { label: "Hot",    bg: "#fee2e2", color: "#dc2626" },
  warm:   { label: "Warm",   bg: "#fef3c7", color: "#d97706" },
  cold:   { label: "Cold",   bg: "#dbeafe", color: "#2563eb" },
  closed: { label: "Won",    bg: "#dcfce7", color: "#16a34a" },
};

const STATUS_ORDER: Status[] = ["new", "hot", "warm", "cold", "closed"];

function nextStatus(current: string): Status {
  const idx = STATUS_ORDER.indexOf(current as Status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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

  const cfg = STATUS_CONFIG[status];
  const initial = lead.name.trim()[0]?.toUpperCase() ?? "?";

  const avatarColors = [
    ["#eff6ff", "#2563eb"],
    ["#f0fdf4", "#16a34a"],
    ["#fdf4ff", "#9333ea"],
    ["#fff7ed", "#ea580c"],
    ["#fef2f2", "#dc2626"],
  ];
  const [abg, afg] = avatarColors[lead.name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: abg, color: afg }}
        >
          {initial}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-slate-900 font-semibold">{lead.name}</p>
            <button
              onClick={cycleStatus}
              title="Click to change status"
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </button>
          </div>
          <a href={`mailto:${lead.email}`} className="text-blue-600 text-sm hover:underline truncate block">
            {lead.email}
          </a>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="text-slate-500 text-sm hover:text-slate-700 transition-colors">
              {lead.phone}
            </a>
          )}
          {lead.location && (
            <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {lead.location}
            </p>
          )}
        </div>

        {/* Date + time — right-aligned */}
        <div className="text-right shrink-0">
          <p className="text-slate-700 text-xs font-semibold">{formatDate(lead.created_at)}</p>
          <p className="text-slate-400 text-xs mt-0.5">{formatTime(lead.created_at)}</p>
        </div>
      </div>

      {/* Message from visitor */}
      {lead.message && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-1 font-medium">Their message</p>
          <p className="text-slate-600 text-sm italic">&ldquo;{lead.message}&rdquo;</p>
        </div>
      )}

      {/* Notes */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add a note… where you met, what you discussed, next steps"
          rows={2}
          className="w-full bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-blue-400 transition-colors"
        />
        {saving && <p className="text-slate-400 text-xs mt-1">Saving…</p>}
        {saved && <p className="text-blue-600 text-xs mt-1">Saved ✓</p>}
      </div>
    </div>
  );
}
