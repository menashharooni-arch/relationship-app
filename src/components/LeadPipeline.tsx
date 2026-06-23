"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  location: string | null;
  status: string | null;
  created_at: string;
};

const COLUMNS: { id: string; label: string; dot: string }[] = [
  { id: "new",    label: "New",        dot: "bg-slate-400" },
  { id: "warm",   label: "Contacted",  dot: "bg-amber-400" },
  { id: "hot",    label: "Hot Lead",   dot: "bg-red-500" },
  { id: "cold",   label: "Follow Up",  dot: "bg-blue-500" },
  { id: "closed", label: "Archived",   dot: "bg-green-500" },
];

export default function LeadPipeline({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function moveToColumn(leadId: string, newStatus: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverCol(colId);
  }

  function onDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    if (draggingId) moveToColumn(draggingId, colId);
    setDraggingId(null);
    setOverCol(null);
  }

  function onDragEnd() {
    setDraggingId(null);
    setOverCol(null);
  }

  const avatarColors = [
    ["#eff6ff", "#2563eb"],
    ["#f0fdf4", "#16a34a"],
    ["#fdf4ff", "#9333ea"],
    ["#fff7ed", "#ea580c"],
    ["#fef2f2", "#dc2626"],
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => (l.status || "new") === col.id);
        const isOver = overCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDrop={(e) => onDrop(e, col.id)}
            onDragLeave={() => setOverCol(null)}
            className={`flex-shrink-0 w-56 rounded-2xl border transition-colors ${
              isOver
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className="text-xs font-bold text-slate-700">{col.label}</span>
              <span className="ml-auto text-xs text-slate-400 font-semibold">{colLeads.length}</span>
            </div>

            {/* Cards */}
            <div className="px-2 pb-3 space-y-2 min-h-[80px]">
              {colLeads.map((lead) => {
                const [abg, afg] = avatarColors[lead.name.charCodeAt(0) % avatarColors.length];
                const isDragging = draggingId === lead.id;
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    onDragEnd={onDragEnd}
                    className={`bg-white border border-slate-200 rounded-xl p-3 cursor-grab active:cursor-grabbing shadow-sm transition-opacity select-none ${
                      isDragging ? "opacity-40" : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: abg, color: afg }}
                      >
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <p className="text-slate-900 text-xs font-semibold truncate">{lead.name}</p>
                    </div>
                    <p className="text-blue-600 text-[11px] truncate mb-1">{lead.email}</p>
                    {lead.location && (
                      <p className="text-slate-400 text-[11px] flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {lead.location}
                      </p>
                    )}
                    {lead.message && (
                      <p className="text-slate-400 text-[11px] italic mt-1 line-clamp-2">&ldquo;{lead.message}&rdquo;</p>
                    )}
                    <p className="text-slate-300 text-[10px] mt-2">
                      {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                );
              })}
              {colLeads.length === 0 && (
                <div className={`border-2 border-dashed rounded-xl h-16 flex items-center justify-center transition-colors ${
                  isOver ? "border-blue-300" : "border-slate-200"
                }`}>
                  <p className="text-slate-300 text-[11px]">Drop here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
