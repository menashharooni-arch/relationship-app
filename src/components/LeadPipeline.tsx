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
  tags: string[] | null;
  created_at: string;
};

const COLUMNS: { id: string; label: string; color: string; bg: string; border: string }[] = [
  { id: "new_contact", label: "New Contact", color: "#94a3b8", bg: "#0f172a", border: "#1e293b" },
  { id: "touch",       label: "Touch",       color: "#60a5fa", bg: "#0a1628", border: "#1a2d4a" },
  { id: "dissolved",   label: "Dissolved",   color: "#6b7280", bg: "#111827", border: "#1f2937" },
];

function getPresetTag(tags: string[] | null): string | null {
  for (const t of tags ?? []) {
    if (t.startsWith("preset-")) return t.replace("preset-", "");
  }
  return null;
}

export default function LeadPipeline({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function saveEdit(leadId: string) {
    if (!editForm.name.trim()) return;
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        company: editForm.company.trim() || null,
      }),
    });
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, ...editForm, email: editForm.email || "", phone: editForm.phone || null, company: editForm.company || null }
          : l
      )
    );
    setEditingId(null);
  }

  async function deleteLead(leadId: string) {
    await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setConfirmDeleteId(null);
  }

  const avatarColors = [
    ["#eff6ff", "#2563eb"],
    ["#f0fdf4", "#16a34a"],
    ["#fdf4ff", "#9333ea"],
    ["#fff7ed", "#ea580c"],
    ["#fef2f2", "#dc2626"],
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => (l.status || "new_contact") === col.id);
        const isOver = overCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDrop={(e) => onDrop(e, col.id)}
            onDragLeave={() => setOverCol(null)}
            className="flex-shrink-0 w-52 rounded-2xl transition-all"
            style={{
              background: isOver ? "#1e3a5f20" : col.bg,
              border: `1px solid ${isOver ? "#1D4ED8" : col.border}`,
            }}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
              <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
              <span className="ml-auto text-xs font-bold text-gray-600">{colLeads.length}</span>
            </div>

            {/* Cards */}
            <div className="px-2 pb-3 space-y-2 min-h-[80px]">
              {colLeads.map((lead) => {
                const [abg, afg] = avatarColors[lead.name.charCodeAt(0) % avatarColors.length];
                const isDragging = draggingId === lead.id;
                const flowPaused = (lead.tags ?? []).includes("flow-paused");
                const preset = getPresetTag(lead.tags);
                const hasFlow = preset && !flowPaused;

                return (
                  <div
                    key={lead.id}
                    draggable={editingId !== lead.id}
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    onDragEnd={onDragEnd}
                    className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all"
                    style={{
                      background: "#111827",
                      border: "1px solid #1f2937",
                      opacity: isDragging ? 0.4 : 1,
                    }}
                  >
                    {/* Avatar + name */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: abg, color: afg }}>
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <p className="text-white text-xs font-semibold truncate flex-1">{lead.name}</p>
                    </div>

                    <p className="text-blue-400 text-[10px] truncate mb-1">{lead.email}</p>
                    {lead.phone && <p className="text-gray-600 text-[10px] mb-1">{lead.phone}</p>}

                    {lead.notes && (
                      <p className="text-gray-600 text-[10px] italic mt-1 line-clamp-2 leading-snug">&ldquo;{lead.notes}&rdquo;</p>
                    )}

                    {/* Mobile status select */}
                    <select
                      value={lead.status || "new_contact"}
                      onChange={(e) => moveToColumn(lead.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 w-full rounded-lg text-[10px] font-semibold px-2 py-1 border border-gray-700 bg-gray-900 text-gray-300 focus:outline-none md:hidden"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>

                    {/* Follow-up badge (desktop) */}
                    <div className="hidden md:flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                      <p className="text-gray-700 text-[9px]">
                        {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      {hasFlow ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-800/50">
                          P{preset} ⚡
                        </span>
                      ) : flowPaused ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-600">
                          ⏸ paused
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-600">
                          no flow
                        </span>
                      )}
                    </div>

                    {/* Action row */}
                    {editingId === lead.id ? (
                      <div className="mt-2 pt-2 border-t border-gray-700 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Name"
                          className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone"
                          className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={editForm.company}
                          onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                          placeholder="Company"
                          className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveEdit(lead.id)}
                            className="flex-1 text-[9px] font-bold py-1 rounded-lg bg-blue-600 text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 text-[9px] text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirmDeleteId === lead.id ? (
                      <div className="mt-2 pt-2 border-t border-gray-700 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] text-gray-400 flex-1">Delete?</span>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] text-gray-500 hover:text-gray-300 border border-gray-700 px-2 py-0.5 rounded-lg">No</button>
                        <button onClick={() => deleteLead(lead.id)} className="text-[9px] font-bold text-red-400 border border-red-800 px-2 py-0.5 rounded-lg">Yes</button>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditForm({ name: lead.name, email: lead.email, phone: lead.phone || "", company: "" }); setEditingId(lead.id); }}
                          className="text-[9px] text-gray-600 hover:text-blue-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(lead.id); }}
                          className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {colLeads.length === 0 && (
                <div
                  className="border-2 border-dashed rounded-xl h-14 flex items-center justify-center transition-colors"
                  style={{ borderColor: isOver ? "#1D4ED8" : "#1f2937" }}
                >
                  <p className="text-gray-700 text-[10px]">Drop here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
