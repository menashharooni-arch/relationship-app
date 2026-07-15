"use client";

import ShareMyCardButton from "@/components/ShareMyCardButton";
import { useState } from "react";
import { useRouter } from "next/navigation";

type FlowPreset = { name: string; days: number[] };

export type FlowPresets = {
  "1": FlowPreset;
  "2": FlowPreset;
  "3": FlowPreset;
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  company_description?: string | null;
  message: string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  tags: string[] | null;
  follow_up_date: string | null;
  created_at: string;
  where_met?: string | null;
  convo_details?: string | null;
  follow_up_sequence?: { day: number; message: string; sent_at: string | null }[] | null;
};

type Status = "new_contact" | "touch" | "dissolved" | "not_interested";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  new_contact: { label: "New Contact", bg: "#1e293b", color: "#94a3b8" },
  touch:       { label: "Touch",       bg: "#172554", color: "#60a5fa" },
  dissolved:   { label: "Dissolved",   bg: "#111827", color: "#6b7280" },
  // Set from the Office Leads tab. Renderable here so an Office-marked lead
  // doesn't show up blank in the owner's personal contacts; deliberately NOT in
  // STATUS_ORDER, so the tap-to-cycle here keeps its original three states.
  not_interested: { label: "Not interested", bg: "#1f1418", color: "#a1a1aa" },
};

const STATUS_ORDER: Status[] = ["new_contact", "touch", "dissolved"];

function nextStatus(current: string): Status {
  const idx = STATUS_ORDER.indexOf(current as Status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function sendDate(createdAt: string, dayOffset: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(createdAt: string, dayOffset: number): boolean {
  return new Date(createdAt).getTime() + dayOffset * 86400000 < Date.now();
}

const DEFAULT_PRESETS: FlowPresets = {
  "1": { name: "Warm Touch", days: [1, 2, 4, 7] },
  "2": { name: "Standard", days: [1, 4, 10, 21, 45] },
  "3": { name: "Long-term", days: [1, 30, 90, 180, 365] },
};

const TAG_COLORS = [
  "bg-blue-900 text-blue-300",
  "bg-purple-900 text-purple-300",
  "bg-amber-900 text-amber-300",
  "bg-green-900 text-green-300",
  "bg-rose-900 text-rose-300",
  "bg-cyan-900 text-cyan-300",
];

function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

const RESERVED_TAGS = new Set(["flow-paused", "email-paused", "sms-paused", "preset-1", "preset-2", "preset-3", "sc-locked"]);

function getPresetFromTags(tags: string[]): "1" | "2" | "3" | null {
  for (const t of tags) {
    if (t === "preset-1") return "1";
    if (t === "preset-2") return "2";
    if (t === "preset-3") return "3";
  }
  return null;
}

export default function LeadCard({
  lead,
  flowPresets,
}: {
  lead: Lead;
  flowPresets?: FlowPresets;
}) {
  const router = useRouter();
  const presets = flowPresets ?? DEFAULT_PRESETS;

  const initialTags = lead.tags ?? [];
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");

  const [status, setStatus] = useState<Status>((lead.status as Status) || "new_contact");
  const [notes, setNotes] = useState(lead.notes || "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const [followUpDate, setFollowUpDate] = useState<string>(lead.follow_up_date ? lead.follow_up_date.slice(0, 10) : "");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpSaved, setFollowUpSaved] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inline editing
  const [editingContact, setEditingContact] = useState(false);
  const [editForm, setEditForm] = useState({ name: lead.name, email: lead.email || "", phone: lead.phone || "", company: lead.company || "", company_description: (lead as { company_description?: string }).company_description || "" });
  const [editSaving, setEditSaving] = useState(false);

  // Flow automation. The master toggle (flow-paused) gates everything; email
  // and text each have their own switch (email-paused / sms-paused tags) that
  // shuts just that channel down — the cron skips paused channels.
  const flowPaused = tags.includes("flow-paused");
  const emailPaused = tags.includes("email-paused");
  const smsPaused = tags.includes("sms-paused");
  const activePreset = getPresetFromTags(tags);
  const [togglingFlow, setTogglingFlow] = useState(false);

  async function toggleChannel(which: "email" | "sms") {
    const tag = which === "email" ? "email-paused" : "sms-paused";
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await updateTags(next);
  }

  // Reminders history
  const [reminders, setReminders] = useState<{ day_trigger: number; created_at: string }[] | null>(null);

  // AI messages
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [sendingSMS, setSendingSMS] = useState<number | null>(null);
  const [smsSent, setSmsSent] = useState<number | null>(null);
  const [smsError, setSmsError] = useState<number | null>(null);
  const [meetContext, setMeetContext] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "direct">("friendly");

  const [showSeqGenerator, setShowSeqGenerator] = useState(false);
  const [seqWhereMet, setSeqWhereMet] = useState(lead.where_met || "");
  const [generatingSeq, setGeneratingSeq] = useState(false);
  type SeqItem = { day: number; message: string; subject?: string; time?: string; channel?: string; sent_at?: string | null; anchor?: string };
  const [pendingSequence, setPendingSequence] = useState<SeqItem[] | null>(null);
  const [seqError, setSeqError] = useState<string | null>(null);
  const [savedSequence, setSavedSequence] = useState<SeqItem[]>(
    Array.isArray((lead as { follow_up_sequence?: unknown }).follow_up_sequence)
      ? ((lead as { follow_up_sequence?: SeqItem[] }).follow_up_sequence ?? [])
      : []
  );

  async function patchLead(fields: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function saveNotes() {
    if (!notesDirty) return;
    setNotesSaving(true);
    const ok = await patchLead({ notes });
    setNotesSaving(false);
    if (ok) {
      setNotesSaved(true);
      setNotesDirty(false);
      setTimeout(() => setNotesSaved(false), 2000);
    }
  }

  async function cycleStatus() {
    const prev = status;
    const next = nextStatus(status);
    setStatus(next);
    const ok = await patchLead({ status: next });
    if (!ok) setStatus(prev); // roll back — the DB never changed
  }

  async function updateTags(next: string[]) {
    const prev = tags;
    setTags(next);
    const ok = await patchLead({ tags: next });
    if (!ok) setTags(prev); // roll back — the DB never changed
  }

  async function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag) || RESERVED_TAGS.has(tag)) return;
    await updateTags([...tags, tag]);
    setTagInput("");
  }

  async function removeTag(tag: string) {
    await updateTags(tags.filter((t) => t !== tag));
  }

  async function saveFollowUpDate(date: string) {
    setFollowUpSaving(true);
    const ok = await patchLead({ follow_up_date: date || null });
    setFollowUpSaving(false);
    if (ok) {
      setFollowUpSaved(true);
      setTimeout(() => setFollowUpSaved(false), 2000);
    }
  }

  async function toggleFlow() {
    setTogglingFlow(true);
    const clean = tags.filter((t) => t !== "flow-paused");
    if (flowPaused) {
      await updateTags(clean);
    } else {
      await updateTags([...clean, "flow-paused"]);
    }
    setTogglingFlow(false);
  }

  async function selectPreset(p: "1" | "2" | "3") {
    const clean = tags.filter((t) => !t.startsWith("preset-") && t !== "flow-paused");
    await updateTags([...clean, `preset-${p}`]);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function saveContactEdit() {
    if (!editForm.name.trim()) return;
    setEditSaving(true);
    const ok = await patchLead({
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      company: editForm.company.trim() || null,
      company_description: editForm.company_description.trim() || null,
    });
    setEditSaving(false);
    if (ok) {
      setEditingContact(false);
      router.refresh();
    }
  }

  async function loadReminders() {
    if (reminders !== null) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/reminders`);
      const data = await res.json();
      setReminders(data.reminders ?? []);
    } catch {
      setReminders([]);
    }
  }

  function loadAISuggestions() {
    const next = !showAI;
    setShowAI(next);
  }

  async function fetchAI() {
    setAiLoading(true);
    setAiMessages(null);
    try {
      const res = await fetch("/api/ai/suggest-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, meetContext: meetContext.trim() || undefined, tone }),
      });
      const data = await res.json();
      setAiMessages(data.messages ?? []);
    } catch {
      setAiMessages([]);
    }
    setAiLoading(false);
  }

  async function copyMessage(i: number, msg: string) {
    await navigator.clipboard.writeText(msg);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  async function sendSMS(i: number, msg: string) {
    if (!lead.phone) return;
    setSendingSMS(i);
    setSmsError(null);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, message: msg }),
      });
      if (res.ok) {
        setSmsSent(i);
        setTimeout(() => setSmsSent(null), 3000);
      } else {
        setSmsError(i);
        setTimeout(() => setSmsError(null), 3000);
      }
    } catch {
      setSmsError(i);
      setTimeout(() => setSmsError(null), 3000);
    }
    setSendingSMS(null);
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["new_contact"];
  const initial = lead.name.trim()[0]?.toUpperCase() ?? "?";
  const followUpOverdue = followUpDate && new Date(followUpDate) < new Date(new Date().toDateString());
  const visibleTags = tags.filter((t) => !RESERVED_TAGS.has(t));

  const avatarColors = [
    ["#eff6ff", "#2563eb"],
    ["#f0fdf4", "#16a34a"],
    ["#fdf4ff", "#9333ea"],
    ["#fff7ed", "#ea580c"],
    ["#fef2f2", "#dc2626"],
  ];
  const [abg, afg] = avatarColors[lead.name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors">

      {/* ─── Collapsed header row ─── */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ background: abg, color: afg }}>
          {initial}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white font-semibold text-sm">{lead.name}</span>
            <button
              onClick={cycleStatus}
              title="Click to cycle status"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 transition-colors"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </button>
            {/* Flow indicator */}
            {activePreset && !flowPaused ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 shrink-0">
                P{activePreset} active
              </span>
            ) : flowPaused ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 shrink-0">
                ⏸ paused
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.email && <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="text-blue-400 text-xs hover:underline truncate">{lead.email}</a>}
            {lead.phone && <span className="text-gray-600 text-xs shrink-0">{lead.email ? "· " : ""}{lead.phone}</span>}
            {lead.company && <span className="text-gray-500 text-[10px] shrink-0 bg-gray-800 px-1.5 py-0.5 rounded-full">{lead.company}</span>}
            {followUpOverdue && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-400 border border-amber-800/50 shrink-0">
                Follow up overdue
              </span>
            )}
            {followUpDate && !followUpOverdue && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 shrink-0">
                {new Date(followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          {lead.notes && !expanded && (
            <p className="text-gray-600 text-[10px] mt-0.5 truncate max-w-xs">{lead.notes.slice(0, 80)}</p>
          )}
        </div>

        {/* Right: date + expand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-gray-400 text-xs font-medium">{formatDate(lead.created_at)}</p>
            <p className="text-gray-600 text-[10px]">{formatTime(lead.created_at)}</p>
          </div>
          {/* Quick actions */}
          {lead.phone && (
            <ShareMyCardButton leadId={lead.id} firstName={lead.name.split(" ")[0]} />
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              title={`Call ${lead.name.split(" ")[0]}`}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-green-900 transition-colors shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-400 hover:text-green-400">
                <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd"/>
              </svg>
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              title={`Email ${lead.name.split(" ")[0]}`}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-blue-900 transition-colors shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-400">
                <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z"/>
                <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z"/>
              </svg>
            </a>
          )}
          <button
            onClick={() => { setExpanded(!expanded); if (!expanded) loadReminders(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: expanded ? "#1D4ED820" : "#1f2937" }}
            title={expanded ? "Collapse" : "Edit / automate"}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke={expanded ? "#60a5fa" : "#9ca3af"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}>
              <path d="M2 4l4 4 4-4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Expanded panel ─── */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-5">

          {/* Contact info edit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Contact info</p>
              {!editingContact ? (
                <button onClick={() => setEditingContact(true)} className="text-[10px] text-gray-600 hover:text-blue-400 transition-colors font-medium">
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingContact(false); setEditForm({ name: lead.name, email: lead.email || "", phone: lead.phone || "", company: lead.company || "", company_description: (lead as { company_description?: string }).company_description || "" }); }} className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={saveContactEdit}
                    disabled={editSaving || !editForm.name.trim()}
                    className={`font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 shadow-lg shadow-blue-900/40 transition-all active:scale-95 ${editSaving ? "text-sm px-5 py-2.5 scale-110 ring-2 ring-blue-400 shadow-blue-500/50" : "text-xs px-4 py-2"}`}
                  >
                    {editSaving ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : "Save"}
                  </button>
                </div>
              )}
            </div>
            {editingContact ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                />
                <div className="col-span-2">
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Company"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Company description</label>
                  <input
                    type="text"
                    value={editForm.company_description}
                    onChange={(e) => setEditForm((f) => ({ ...f, company_description: e.target.value }))}
                    placeholder="Brief description of what your company does"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 space-y-0.5">
                {lead.email && <p>{lead.email}</p>}
                {lead.phone && <p>{lead.phone}</p>}
                {lead.company && <p>{lead.company}</p>}
                {!lead.email && !lead.phone && !lead.company && <p className="italic">No details — click Edit to add</p>}
              </div>
            )}
          </div>

          {/* Their message */}
          {lead.message && (
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Their message</p>
              <p className="text-gray-400 text-sm italic">&ldquo;{lead.message}&rdquo;</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              placeholder="Where you met, what you discussed, next steps…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-gray-600">
                {notesSaved ? <span className="text-emerald-400">Saved ✓</span> : notesSaving ? "Saving…" : notesDirty ? "Unsaved changes" : ""}
              </span>
              <button
                onClick={saveNotes}
                disabled={!notesDirty || notesSaving}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-30"
                style={{ background: notesDirty ? "#1D4ED8" : "#1f2937", color: notesDirty ? "#fff" : "#6b7280" }}
              >
                {notesSaving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>

          {/* Follow-up date */}
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Follow-up date</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                onBlur={(e) => saveFollowUpDate(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
              />
              {followUpDate && (
                <button
                  onClick={() => { setFollowUpDate(""); saveFollowUpDate(""); }}
                  className="text-gray-600 hover:text-gray-400 text-sm"
                  title="Clear"
                >×</button>
              )}
              {followUpSaving && <span className="text-[10px] text-gray-500">Saving…</span>}
              {followUpSaved && <span className="text-[10px] text-emerald-400">Saved ✓</span>}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <span key={tag} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tagColor(tag)}`}>
                  {tag}
                  <button onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder="+ add tag"
                className="text-[11px] text-gray-500 placeholder-gray-700 bg-transparent focus:outline-none w-20"
              />
            </div>
          </div>

          {/* ─── Follow-up Automation ─── */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-semibold">Follow-up Automation</p>
                <p className="text-gray-500 text-xs mt-0.5">Automated messages based on your preset schedule</p>
              </div>
              {/* Toggle */}
              <button
                onClick={toggleFlow}
                disabled={togglingFlow}
                className="relative rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50"
                style={{ width: "42px", height: "22px", background: flowPaused ? "#374151" : "#1D4ED8" }}
                title={flowPaused ? "Resume flows" : "Pause flows"}
              >
                <div
                  className="absolute top-0.5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ width: "18px", height: "18px", transform: flowPaused ? "translateX(2px)" : "translateX(21px)" }}
                />
              </button>
            </div>

            {!flowPaused && (
              <>
                {/* Per-channel switches — each one shuts its own automation down */}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { which: "email" as const, label: "Email automation", paused: emailPaused, missing: !lead.email && "no email on contact" },
                    { which: "sms" as const, label: "Text automation", paused: smsPaused, missing: !lead.phone && "no phone on contact" },
                  ]).map(({ which, label, paused, missing }) => (
                    <div key={which} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "#1f2937", border: "1px solid #374151", opacity: missing ? 0.55 : 1 }}>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-200">{label}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: missing ? "#9ca3af" : paused ? "#f59e0b" : "#34d399" }}>
                          {missing || (paused ? "Off — nothing sends" : "On")}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleChannel(which)}
                        className="relative rounded-full transition-colors duration-200 shrink-0"
                        style={{ width: "36px", height: "20px", background: paused ? "#374151" : "#1D4ED8" }}
                        title={paused ? `Turn ${which === "email" ? "email" : "text"} automation on` : `Turn ${which === "email" ? "email" : "text"} automation off`}
                      >
                        <div className="absolute top-0.5 bg-white rounded-full shadow transition-transform duration-200"
                          style={{ width: "16px", height: "16px", transform: paused ? "translateX(2px)" : "translateX(18px)" }} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Preset picker */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">Choose preset</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["1", "2", "3"] as const).map((p) => {
                      const preset = presets[p];
                      const isActive = activePreset === p;
                      return (
                        <button
                          key={p}
                          onClick={() => selectPreset(p)}
                          className="text-left rounded-xl px-3 py-2.5 transition-all"
                          style={{
                            background: isActive ? "#1e3a5f" : "#1f2937",
                            border: `1px solid ${isActive ? "#1D4ED8" : "#374151"}`,
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                              style={{ background: isActive ? "#1D4ED8" : "#374151", color: "#fff" }}>
                              {p}
                            </div>
                            <span className="text-[10px] font-semibold" style={{ color: isActive ? "#60a5fa" : "#9ca3af" }}>
                              {preset.name}
                            </span>
                          </div>
                          <p className="text-[9px] text-gray-600 leading-snug">
                            {preset.days.map((d) => `Day ${d}`).join(" · ")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Schedule preview */}
                {activePreset && (
                  <div className="rounded-xl px-3 py-3" style={{ background: "#1f2937", border: "1px solid #374151" }}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">
                      Scheduled sends — {presets[activePreset].name}
                    </p>
                    <div className="space-y-1.5">
                      {presets[activePreset].days.map((day, i) => (
                        <div key={day} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-[11px] text-gray-400">
                            Day {day}
                            <span className="text-gray-300 font-medium ml-1.5">
                              {sendDate(lead.created_at, day)}
                            </span>
                          </span>
                          {i === 0 && isOverdue(lead.created_at, day) && (
                            <span className="text-[9px] bg-amber-900/60 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-800/50 ml-auto">
                              overdue
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-600 mt-2">Configure presets in Settings → Follow-up Presets</p>
                  </div>
                )}

                {!activePreset && (
                  <p className="text-[11px] text-amber-500/80">
                    Select a preset above to activate the automation schedule.
                  </p>
                )}

                {activePreset && !flowPaused && (
                  <div className="mt-3">
                    {savedSequence.length > 0 ? (
                      /* Show existing sequence summary */
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-gray-400 font-medium">Saved sequence ({savedSequence.length} messages)</p>
                        {savedSequence.map((item, idx) => {
                          const isSms = item.channel === "sms";
                          const paused = isSms ? smsPaused : emailPaused;
                          return (
                            <div key={`${item.day}-${item.channel ?? "email"}-${idx}`} className="flex items-start gap-2 text-[11px]">
                              <span className="text-gray-500 shrink-0 mt-0.5">Day {item.day}</span>
                              <span className={item.sent_at ? "text-green-400" : paused ? "text-amber-500/80" : "text-gray-400"}>
                                {item.sent_at ? "✓ Sent" : paused ? `Paused (${isSms ? "text" : "email"} off)` : "Scheduled"}
                              </span>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => { setShowSeqGenerator(true); setPendingSequence(null); }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 underline mt-1"
                        >
                          Regenerate sequence
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowSeqGenerator(true)}
                        className="w-full py-2 text-[12px] bg-gray-800 hover:bg-gray-700 border border-gray-700 border-dashed rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        + Generate AI follow-up sequence
                      </button>
                    )}

                    {showSeqGenerator && (
                      <div className="mt-3 space-y-3 bg-gray-800 rounded-xl p-3">
                        <p className="text-[11px] text-gray-300 font-medium">Generate sequence messages</p>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Where did you meet?</label>
                          <input
                            type="text"
                            value={seqWhereMet}
                            onChange={(e) => setSeqWhereMet(e.target.value)}
                            placeholder="e.g. Real estate conference, LinkedIn, referral"
                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        {!pendingSequence && (
                          <button
                            onClick={async () => {
                              if (generatingSeq) return;
                              // Generate a sequence for EACH enabled channel, so email and
                              // text each get copy written for that medium — and a paused
                              // channel is never generated (nothing to send later).
                              const chans: ("email" | "sms")[] = [
                                ...(!emailPaused && lead.email ? (["email"] as const) : []),
                                ...(!smsPaused && lead.phone ? (["sms"] as const) : []),
                              ];
                              if (!chans.length) return;
                              setGeneratingSeq(true);
                              setSeqError(null);
                              try {
                                const results = await Promise.all(chans.map((c) =>
                                  fetch(`/api/leads/${lead.id}/generate-sequence`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ presetKey: activePreset, whereMet: seqWhereMet, notes: lead.notes ?? "", channel: c }),
                                  }).then((r) => r.json())
                                ));
                                const merged = results.flatMap((d) => (d.sequence ?? []) as SeqItem[])
                                  .sort((a, b) => a.day - b.day || (a.channel ?? "").localeCompare(b.channel ?? ""));
                                // Never fail silently — a dead-looking button reads as broken.
                                if (merged.length) {
                                  setPendingSequence(merged);
                                } else if (results.some((d) => d?.error === "upgrade")) {
                                  setSeqError(results.find((d) => d?.error === "upgrade")?.message || "Automated follow-up sequences are a Pro feature.");
                                } else {
                                  setSeqError("Couldn't write the messages just now — tap Generate to try again.");
                                }
                              } catch {
                                setSeqError("Couldn't write the messages just now — check your connection and try again.");
                              }
                              setGeneratingSeq(false);
                            }}
                            disabled={generatingSeq || (emailPaused && smsPaused) || (!lead.email && !lead.phone)}
                            className="w-full py-2 text-[11px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                          >
                            {generatingSeq
                              ? "Generating…"
                              : emailPaused && smsPaused
                              ? "Turn on email or text above first"
                              : `Generate AI messages${!emailPaused && lead.email && !smsPaused && lead.phone ? " (email + text)" : !smsPaused && lead.phone && (emailPaused || !lead.email) ? " (text)" : " (email)"}`}
                          </button>
                        )}
                        {seqError && !generatingSeq && (
                          <p className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
                            ⚠ {seqError}{seqError.includes("Pro feature") && <> <a href="/pricing" className="underline font-semibold">Upgrade →</a></>}
                          </p>
                        )}
                        {pendingSequence && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-gray-300 font-medium">Preview & edit before saving:</p>
                            {pendingSequence.map((item, idx) => (
                              <div key={`${item.day}-${item.channel ?? "email"}-${idx}`} className="space-y-1">
                                <p className="text-[10px] text-gray-500 font-medium">
                                  Day {item.day} · {item.channel === "sms" ? "Text" : "Email"}
                                </p>
                                <textarea
                                  value={item.message}
                                  onChange={(e) => {
                                    const updated = [...pendingSequence];
                                    updated[idx] = { ...updated[idx], message: e.target.value };
                                    setPendingSequence(updated);
                                  }}
                                  rows={3}
                                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-[10px] focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={async () => {
                                  if (!pendingSequence) return;
                                  // Anchor new steps to NOW (so flows added later still send)
                                  // and keep any channel we DIDN'T regenerate this time —
                                  // regenerating email must never wipe a running text flow.
                                  const nowIso = new Date().toISOString();
                                  const generated = new Set(pendingSequence.map((s) => s.channel ?? "email"));
                                  const kept = savedSequence.filter((s) => !generated.has(s.channel ?? "email"));
                                  const seq = [...kept, ...pendingSequence.map((s) => ({ ...s, sent_at: null, anchor: nowIso }))];
                                  try {
                                    const res = await fetch(`/api/leads/${lead.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ follow_up_sequence: seq }),
                                    });
                                    if (!res.ok) throw new Error("save failed");
                                    setSavedSequence(seq);
                                    setPendingSequence(null);
                                    setShowSeqGenerator(false);
                                  } catch {
                                    setSeqError("Couldn't save the sequence just now — try again.");
                                  }
                                }}
                                className="flex-1 py-2 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
                              >
                                Save & activate
                              </button>
                              <button
                                onClick={() => { setPendingSequence(null); setShowSeqGenerator(false); }}
                                className="px-3 py-2 text-[11px] text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {flowPaused && (
              <p className="text-[11px] text-gray-500">
                Automation is paused for this contact. Toggle on to set up a follow-up schedule.
              </p>
            )}
          </div>

          {/* ─── Emails sent ─── */}
          {reminders !== null && reminders.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-2">Automated emails sent</p>
              <div className="space-y-1.5">
                {reminders.map((r) => (
                  <div key={r.day_trigger} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 12 12" fill="#4ade80" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L4.586 7.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      Day {r.day_trigger} email sent{" "}
                      <span className="text-gray-500">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── AI Follow-up Messages ─── */}
          <div>
            <button
              onClick={loadAISuggestions}
              className="flex items-center gap-2 text-[11px] font-semibold transition-colors"
              style={{ color: showAI ? "#818cf8" : "#6b7280" }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
              </svg>
              AI Follow-up Messages
              <svg viewBox="0 0 12 12" fill="currentColor" className={`w-2.5 h-2.5 transition-transform ${showAI ? "rotate-180" : ""}`} stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4l4 4 4-4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {showAI && (
              <div className="mt-3 space-y-3">
                {/* Context form — shown when no messages yet */}
                {!aiMessages && !aiLoading && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Help AI write a better message</p>

                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Where did you meet {lead.name.split(" ")[0]}?</label>
                      <input
                        type="text"
                        value={meetContext}
                        onChange={(e) => setMeetContext(e.target.value)}
                        placeholder="e.g. open house on Elm St, coffee shop, Instagram, conference…"
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 mb-1.5">Tone</p>
                      <div className="flex gap-2">
                        {(["friendly", "professional", "direct"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTone(t)}
                            className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all capitalize"
                            style={{
                              background: tone === t ? "#312e81" : "#1f2937",
                              color: tone === t ? "#a5b4fc" : "#6b7280",
                              border: `1px solid ${tone === t ? "#4338ca" : "#374151"}`,
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={fetchAI}
                      className="w-full py-2 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: "#4338ca", color: "#fff" }}
                    >
                      Generate messages
                    </button>
                  </div>
                )}

                {aiLoading && (
                  <div className="flex items-center gap-2 py-3">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="text-gray-500 text-xs">Writing personalized messages…</span>
                  </div>
                )}

                {aiMessages && aiMessages.length > 0 && (
                  <>
                    {aiMessages.map((msg, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: "#111827", border: "1px solid #1f2937" }}>
                        <p className="text-gray-300 text-xs leading-relaxed mb-2">{msg}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyMessage(i, msg)}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
                            style={{ background: "#1f2937", color: copied === i ? "#4ade80" : "#9ca3af" }}
                          >
                            {copied === i ? "✓ Copied!" : "Copy"}
                          </button>
                          {lead.phone && (
                            <button
                              onClick={() => sendSMS(i, msg)}
                              disabled={sendingSMS === i}
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{
                                background: smsSent === i ? "#052e16" : smsError === i ? "#450a0a" : "#1e3a5f",
                                color: smsSent === i ? "#4ade80" : smsError === i ? "#f87171" : "#60a5fa",
                              }}
                            >
                              {sendingSMS === i ? "Sending…" : smsSent === i ? "✓ Sent!" : smsError === i ? "✗ Failed" : "Send SMS"}
                            </button>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}?body=${encodeURIComponent(msg)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
                              style={{ background: "#1f2937", color: "#9ca3af" }}
                            >
                              Email
                            </a>
                          )}
                          {!lead.phone && !lead.email && <span className="text-[10px] text-gray-600 italic">Copy to send manually</span>}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => { setAiMessages(null); }}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      ↩ Change context
                    </button>
                  </>
                )}

                {aiMessages !== null && aiMessages.length === 0 && (
                  <p className="text-gray-600 text-xs py-2">Could not generate messages. Make sure an AI key (OpenAI or Gemini) is set.</p>
                )}
              </div>
            )}
          </div>

          {/* ─── Delete ─── */}
          <div className="pt-1 border-t border-gray-800 flex items-center justify-end">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/>
                </svg>
                Delete contact
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Are you sure?</span>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs font-bold px-3 py-1 rounded-lg bg-red-900 text-red-300 hover:bg-red-800 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
