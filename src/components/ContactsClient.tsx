"use client";

import { useEffect, useState } from "react";
import { getSourceLabel } from "@/lib/source-labels";

const ACTIVE_CARD_KEY = "swiftcard_active_card";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  company_description: string | null;
  location: string | null;
  notes: string | null;
  source: string | null;
  visitor_id: string | null;
  created_at: string;
  status: string | null;
  tags: string[] | null;
  follow_up_date: string | null;
  card_owner: string | null;
  where_met: string | null;
  convo_details: string | null;
  message: string | null;
};

type CardEvent = {
  id: string;
  event_type: string;
  source: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  viewed_card:           { label: "Viewed your card",       icon: "👁" },
  clicked_save_contact:  { label: "Clicked Save Contact",   icon: "👆" },
  downloaded_vcard:      { label: "Downloaded your contact", icon: "💾" },
  shared_info:           { label: "Shared their info",       icon: "✅" },
};

const STATUS_STYLES: Record<string, string> = {
  new_contact: "bg-gray-800 text-gray-400",
  touch:       "bg-blue-950 text-blue-400",
  dissolved:   "bg-gray-900 text-gray-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source || source === "direct_link") return null;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 shrink-0">
      {getSourceLabel(source)}
    </span>
  );
}

function getPreset(tags: string[] | null): string | null {
  for (const t of tags ?? []) {
    if (t === "preset-1") return "1";
    if (t === "preset-2") return "2";
    if (t === "preset-3") return "3";
  }
  return null;
}

function FlowBadge({ tags }: { tags: string[] | null }) {
  const paused = (tags ?? []).includes("flow-paused");
  const preset = getPreset(tags);
  if (paused) return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">⏸ paused</span>
  );
  if (preset) return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-800/40">
      Preset {preset} ⚡
    </span>
  );
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-600">no flow</span>;
}

export default function ContactsClient({
  leads: initialLeads,
  primaryUsername,
  userCards = [],
  initialCardFilter = null,
}: {
  leads: Lead[];
  primaryUsername?: string;
  userCards?: { username: string; name: string }[];
  initialCardFilter?: string | null;
}) {
  const [search, setSearch] = useState("");
  // Default to the card currently selected on the dashboard so only its contacts show.
  // Priority: ?card= from the dashboard link → primary card (overridden by saved selection below).
  const [cardFilter, setCardFilter] = useState<string>(initialCardFilter || primaryUsername || "all");

  useEffect(() => {
    if (initialCardFilter) return; // the URL param already set the card
    try {
      const saved = localStorage.getItem(ACTIVE_CARD_KEY);
      if (saved && userCards.some((c) => c.username === saved)) {
        setCardFilter(saved);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [events, setEvents] = useState<CardEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState<"idle" | "sent" | "error" | "no_twilio">("idle");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [editingWhereMet, setEditingWhereMet] = useState(false);
  const [whereMetText, setWhereMetText] = useState("");
  const [editingConvo, setEditingConvo] = useState(false);
  const [convoText, setConvoText] = useState("");
  const [fieldSaving, setFieldSaving] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCopied, setAiCopied] = useState<number | null>(null);
  const [aiTone, setAiTone] = useState<"friendly" | "professional" | "direct">("friendly");
  const [sortBy, setSortBy] = useState<"alpha" | "recent" | "activity">("alpha");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [detailTab, setDetailTab] = useState<"conversation" | "info">("conversation");
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", company: "", email: "", phone: "" });

  async function saveContact() {
    if (!selected) return;
    setFieldSaving("contact");
    await fetch(`/api/leads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactDraft),
    });
    const patch = { ...contactDraft };
    setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
    setFieldSaving(null);
    setEditingContact(false);
  }

  const automationOn = !((selected?.tags ?? []).includes("flow-paused"));
  async function toggleAutomation() {
    if (!selected) return;
    const tags = selected.tags ?? [];
    const newTags = automationOn ? [...tags, "flow-paused"] : tags.filter((t) => t !== "flow-paused");
    await updateTags(selected.id, newTags);
  }

  async function saveField(field: string, value: string) {
    if (!selected) return;
    setFieldSaving(field);
    await updateField(selected.id, field, value);
    setSelected((prev) => prev ? { ...prev, [field]: value } : prev);
    setFieldSaving(null);
  }

  async function generateAiMessages() {
    if (!selected) return;
    setAiLoading(true);
    setAiMessages(null);
    try {
      const res = await fetch("/api/ai/suggest-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selected.id,
          meetContext: selected.where_met ?? "",
          tone: aiTone,
        }),
      });
      const data = await res.json();
      setAiMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setAiMessages([]);
    } finally {
      setAiLoading(false);
    }
  }

  async function copyAiMessage(i: number, msg: string) {
    try {
      await navigator.clipboard.writeText(msg);
      setAiCopied(i);
      setTimeout(() => setAiCopied(null), 2000);
    } catch {/* ignore */}
  }

  async function changeStatus(newStatus: string) {
    if (!selected) return;
    await updateField(selected.id, "status", newStatus);
    setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);
    if (newStatus === "dissolved") {
      const newTags = (selected.tags ?? []).filter((t) => !t.startsWith("preset-") && t !== "flow-paused");
      await updateTags(selected.id, newTags);
    }
  }

  const filtered = leads
    .filter((l) => {
      if (cardFilter !== "all" && l.card_owner !== cardFilter) return false;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.company ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "activity") {
        const aDate = a.follow_up_date ?? a.created_at;
        const bDate = b.follow_up_date ?? b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      return a.name.localeCompare(b.name);
    });

  // Group alphabetically
  const grouped: Record<string, Lead[]> = {};
  for (const lead of filtered) {
    const letter = lead.name[0]?.toUpperCase() ?? "#";
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(lead);
  }
  const letters = Object.keys(grouped).sort();

  async function selectLead(lead: Lead) {
    setSelected(lead);
    setEvents([]);
    setDetailTab("conversation");
    setEditingContact(false);
    setEditingNotes(false);
    setEditingWhereMet(false);
    setEditingConvo(false);
    setWhereMetText(lead.where_met ?? "");
    setConvoText(lead.convo_details ?? "");
    setAiMessages(null);
    setAiCopied(null);
    if (!lead.visitor_id) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/card-events?visitor_id=${lead.visitor_id}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  async function updateField(leadId: string, field: string, value: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  // tags is a Postgres text[] — send the real array, not a stringified one.
  async function updateTags(leadId: string, tags: string[]) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, tags } : l)));
    setSelected((prev) => (prev && prev.id === leadId ? { ...prev, tags } : prev));
  }

  function isUnread(lead: Lead) {
    return (lead.tags ?? []).includes("unread");
  }

  async function toggleRead(lead: Lead) {
    const tags = lead.tags ?? [];
    const newTags = tags.includes("unread")
      ? tags.filter((t) => t !== "unread")
      : [...tags, "unread"];
    await updateTags(lead.id, newTags);
  }

  async function deleteLead(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selected?.id === id) setSelected(null);
    setConfirmDeleteId(null);
  }

  async function saveNotes() {
    if (!selected) return;
    setNotesSaving(true);
    await updateField(selected.id, "notes", notesText);
    setSelected((prev) => prev ? { ...prev, notes: notesText } : prev);
    setNotesSaving(false);
    setEditingNotes(false);
  }

  async function sendSms() {
    if (!selected || !smsText.trim()) return;
    setSmsSending(true);
    setSmsSent("idle");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selected.id, message: smsText.trim() }),
      });
      const data = await res.json();
      if (res.status === 503 || data.error === "twilio_not_configured") {
        setSmsSent("no_twilio");
      } else if (res.ok) {
        setSmsSent("sent");
        setSmsText("");
        setTimeout(() => { setSmsOpen(false); setSmsSent("idle"); }, 2000);
      } else {
        setSmsSent("error");
      }
    } catch {
      setSmsSent("error");
    } finally {
      setSmsSending(false);
    }
  }

  const renderLeadItem = (lead: Lead) => {
    const isOverdue = lead.follow_up_date && lead.follow_up_date.slice(0, 10) <= today;
    const unread = isUnread(lead);
    return (
      <div
        key={lead.id}
        role="button"
        tabIndex={0}
        onClick={() => selectLead(lead)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLead(lead); } }}
        className={`group w-full text-left px-4 py-3.5 border-b border-gray-800/50 transition-colors hover:bg-gray-900 cursor-pointer ${selected?.id === lead.id ? "bg-gray-900 border-l-2 border-l-blue-500" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0 mt-0.5">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              {lead.name[0]?.toUpperCase() ?? "?"}
            </div>
            {unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-gray-950" title="Unread" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm truncate ${unread ? "text-white font-bold" : "text-gray-100 font-semibold"}`}>{lead.name}</p>
              <SourceBadge source={lead.source} />
            </div>
            {lead.company && <p className="text-gray-400 text-xs truncate">{lead.company}</p>}
            <p className="text-gray-500 text-xs truncate">{lead.email || lead.phone}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-gray-700 text-[10px]">{formatShort(lead.created_at)}</p>
              {lead.card_owner && userCards.length > 1 && (
                <span className="text-[10px] text-gray-600">/{lead.card_owner}</span>
              )}
              {isOverdue && (
                <span className="text-[10px] font-semibold text-amber-400">📅 follow-up due</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleRead(lead); }}
            title={unread ? "Mark as read" : "Mark as unread"}
            aria-label={unread ? "Mark as read" : "Mark as unread"}
            className={`shrink-0 self-center p-1.5 rounded-lg transition-colors ${unread ? "text-blue-400 hover:bg-blue-500/10" : "text-gray-600 hover:text-gray-300 hover:bg-gray-800"}`}
          >
            {unread ? (
              // filled envelope = unread
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
            ) : (
              // open envelope = read
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" /></svg>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)]">
      {/* Left: contact list */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-900 border border-gray-700 text-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none w-full"
          >
            <option value="alpha">Alphabetical</option>
            <option value="recent">Recently Added</option>
            <option value="activity">Recent Activity</option>
          </select>
          <p className="text-gray-600 text-xs pl-1">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-600 text-sm">
              {search ? "No contacts match your search." : "No contacts yet."}
            </div>
          ) : (
            sortBy === "alpha" ? (
              letters.map((letter) => (
                <div key={letter}>
                  <div className="px-4 py-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-widest bg-gray-950 sticky top-0">
                    {letter}
                  </div>
                  {grouped[letter].map((lead) => renderLeadItem(lead))}
                </div>
              ))
            ) : (
              filtered.map((lead) => renderLeadItem(lead))
            )
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-y-auto hidden lg:block">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 gap-3">
            <svg className="w-10 h-10 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-sm">Select a contact to view details</p>
          </div>
        ) : (
          <div className="max-w-xl mx-auto p-8">
            {/* Header */}
            <div className="flex items-start gap-5 mb-8">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white shrink-0">
                {selected.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-100">{selected.name}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selected.source && selected.source !== "direct_link" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300">
                      {getSourceLabel(selected.source)}
                    </span>
                  )}
                  <select
                    value={selected.status ?? "new_contact"}
                    onChange={(e) => changeStatus(e.target.value)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${STATUS_STYLES[selected.status ?? "new_contact"] ?? STATUS_STYLES.new_contact}`}
                    style={{ background: "transparent" }}
                  >
                    {[
                      { value: "new_contact", label: "New Contact" },
                      { value: "touch",       label: "Touch" },
                      { value: "dissolved",   label: "Dissolved" },
                    ].map((s) => (
                      <option key={s.value} value={s.value} className="bg-gray-900 text-gray-200">{s.label}</option>
                    ))}
                  </select>
                  <FlowBadge tags={selected.tags} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleRead(selected)}
                className={`ml-auto shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${isUnread(selected) ? "border-blue-700 bg-blue-600/15 text-blue-300 hover:bg-blue-600/25" : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"}`}
              >
                {isUnread(selected) ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
                    Mark as read
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" /></svg>
                    Mark as unread
                  </>
                )}
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-gray-900 rounded-xl p-1 gap-1 mb-6">
              {([
                { id: "conversation", label: "Conversation" },
                { id: "info", label: "Contact info / Presets" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: detailTab === t.id ? "#1D4ED8" : "transparent", color: detailTab === t.id ? "#fff" : "#6b7280" }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── CONTACT INFO / PRESETS TAB ── */}
            <div className={detailTab === "info" ? "" : "hidden"}>

            {/* Contact info */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Contact Info</p>
                {!editingContact && (
                  <button
                    onClick={() => { setContactDraft({ name: selected.name ?? "", company: selected.company ?? "", email: selected.email ?? "", phone: selected.phone ?? "" }); setEditingContact(true); }}
                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingContact && (
                <div className="space-y-2 mb-2">
                  <input type="text" value={contactDraft.name} onChange={(e) => setContactDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="text" value={contactDraft.company} onChange={(e) => setContactDraft((d) => ({ ...d, company: e.target.value }))} placeholder="Company" className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="email" value={contactDraft.email} onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))} placeholder="Email" className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="tel" value={contactDraft.phone} onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="Phone" className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingContact(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    <button onClick={saveContact} disabled={fieldSaving === "contact"} className="text-xs text-blue-400 hover:text-blue-300 font-medium disabled:opacity-40">{fieldSaving === "contact" ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              )}
              {selected.company && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                    <span className="text-gray-300 text-sm font-medium">{selected.company}</span>
                  </div>
                  {selected.company_description ? (
                    <p className="text-gray-500 text-xs pl-7">{selected.company_description}</p>
                  ) : null}
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
                  </svg>
                  <a href={`mailto:${selected.email}`} className="text-blue-400 text-sm hover:underline">{selected.email}</a>
                </div>
              )}
              {selected.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <a href={`tel:${selected.phone}`} className="text-gray-300 text-sm hover:text-white flex-1">{selected.phone}</a>
                  <button
                    onClick={() => { setSmsOpen(true); setSmsText(""); setSmsSent("idle"); }}
                    className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-2 py-0.5 rounded-full transition-colors shrink-0"
                  >
                    Send SMS
                  </button>
                </div>
              )}
              {smsOpen && selected.phone && (
                <div className="mt-2 border border-gray-700 rounded-xl p-3 bg-gray-950 space-y-2">
                  <textarea
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    placeholder="Type your SMS message…"
                    rows={3}
                    maxLength={160}
                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-600">{smsText.length}/160</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSmsOpen(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                      <button
                        onClick={sendSms}
                        disabled={smsSending || !smsText.trim()}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {smsSending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                  {smsSent === "sent" && <p className="text-xs text-green-400">SMS sent!</p>}
                  {smsSent === "error" && <p className="text-xs text-red-400">Failed to send. Try again.</p>}
                  {smsSent === "no_twilio" && <p className="text-xs text-amber-400">Add Twilio env vars to enable SMS sending.</p>}
                </div>
              )}
              {selected.location && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-gray-400 text-sm">{selected.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
                <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                </svg>
                <span className="text-gray-500 text-sm">Added {formatDate(selected.created_at)}</span>
              </div>
              {selected.follow_up_date && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-sm font-medium ${selected.follow_up_date.slice(0,10) <= today ? "text-amber-400" : "text-gray-400"}`}>
                    Follow up: {formatDateOnly(selected.follow_up_date)}
                    {selected.follow_up_date.slice(0,10) <= today && " · overdue"}
                  </span>
                </div>
              )}
            </div>

            {/* Notes & Context */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Notes &amp; Context</p>

              {/* Notes */}
              <div className="flex gap-3">
                <svg className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Notes</p>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingNotes(false)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                        <button onClick={saveNotes} disabled={notesSaving}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-40">
                          {notesSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-gray-400 text-sm whitespace-pre-wrap flex-1">
                        {selected.notes || <span className="text-gray-600 italic">No notes</span>}
                      </p>
                      <button
                        onClick={() => { setNotesText(selected.notes ?? ""); setEditingNotes(true); }}
                        className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Where met */}
              <div className="flex gap-3 pt-3 border-t border-gray-800">
                <svg className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Where did you meet?</p>
                  {editingWhereMet ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={whereMetText}
                        onChange={(e) => setWhereMetText(e.target.value)}
                        placeholder="e.g. Networking event, LinkedIn, Conference…"
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingWhereMet(false)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                        <button
                          onClick={async () => { await saveField("where_met", whereMetText); setEditingWhereMet(false); }}
                          disabled={fieldSaving === "where_met"}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-40"
                        >
                          {fieldSaving === "where_met" ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-gray-400 text-sm flex-1">
                        {selected.where_met || <span className="text-gray-600 italic">Not set</span>}
                      </p>
                      <button
                        onClick={() => { setWhereMetText(selected.where_met ?? ""); setEditingWhereMet(true); }}
                        className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversation details */}
              <div className="flex gap-3 pt-3 border-t border-gray-800">
                <svg className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Conversation details</p>
                  {editingConvo ? (
                    <div className="space-y-2">
                      <textarea
                        value={convoText}
                        onChange={(e) => setConvoText(e.target.value)}
                        rows={3}
                        placeholder="What did you discuss? What are their needs?"
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditingConvo(false)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                        <button
                          onClick={async () => { await saveField("convo_details", convoText); setEditingConvo(false); }}
                          disabled={fieldSaving === "convo_details"}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors disabled:opacity-40"
                        >
                          {fieldSaving === "convo_details" ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-gray-400 text-sm whitespace-pre-wrap flex-1">
                        {selected.convo_details || <span className="text-gray-600 italic">No details yet</span>}
                      </p>
                      <button
                        onClick={() => { setConvoText(selected.convo_details ?? ""); setEditingConvo(true); }}
                        className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* AI follow-up preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">AI Follow-up Preview</p>
                  <p className="text-gray-600 text-xs mt-0.5">Generate message ideas for this contact</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
                  {(["friendly", "professional", "direct"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setAiTone(t); setAiMessages(null); }}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors capitalize ${aiTone === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {aiMessages === null && !aiLoading && (
                (selected.notes || selected.where_met || selected.convo_details) ? (
                  <button
                    onClick={generateAiMessages}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "#1D4ED8", color: "#fff" }}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    Generate message ideas
                  </button>
                ) : (
                  <div className="border border-dashed border-gray-700 rounded-xl py-4 px-4 text-center">
                    <p className="text-gray-500 text-sm">Add notes or context above first.</p>
                    <p className="text-gray-600 text-xs mt-1">The AI needs something to work from before it can suggest follow-ups.</p>
                  </div>
                )
              )}

              {aiLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-gray-500 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Writing messages…
                </div>
              )}

              {aiMessages !== null && aiMessages.length > 0 && (
                <div className="space-y-3">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-3.5">
                      <p className="text-gray-200 text-sm leading-relaxed mb-2">{msg}</p>
                      <button
                        onClick={() => copyAiMessage(i, msg)}
                        className="text-[10px] font-semibold text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        {aiCopied === i ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={generateAiMessages}
                    className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors py-1.5"
                  >
                    Regenerate ↺
                  </button>
                </div>
              )}

              {aiMessages !== null && aiMessages.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-2">Could not generate messages. Try adding context above.</p>
              )}
            </div>

            {/* Follow-up automation toggle */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-6 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-gray-200 text-sm font-medium">Follow-up automation</p>
                <p className="text-gray-500 text-xs mt-0.5">{automationOn ? "This contact receives your automated follow-ups." : "Automated follow-ups are paused for this contact."}</p>
              </div>
              <button
                type="button"
                onClick={toggleAutomation}
                role="switch"
                aria-checked={automationOn}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: automationOn ? "#2563eb" : "#374151" }}
              >
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: automationOn ? "22px" : "2px" }} />
              </button>
            </div>

            </div>{/* end Contact info / Presets tab */}

            {/* ── CONVERSATION TAB ── */}
            <div className={detailTab === "conversation" ? "" : "hidden"}>

            {/* Conversation — messages with this contact */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3">Conversation</p>
              {selected.message ? (
                <div className="space-y-2">
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-gray-800 text-gray-200 rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                      {selected.message}
                    </div>
                  </div>
                  <p className="text-gray-600 text-[11px] pl-1">{selected.name.split(" ")[0]} sent this when they reached out. Your automated follow-ups will appear here too.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-gray-500">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm leading-relaxed">
                    No messages yet. Automated texts and emails sent to {selected.name.split(" ")[0]} will appear here once you set up follow-up automation.
                  </p>
                </div>
              )}
            </div>

            {/* Activity timeline */}
            <div>
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-4">Activity</p>

              {loadingEvents ? (
                <p className="text-gray-600 text-sm">Loading activity…</p>
              ) : events.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-800" />
                  <div className="space-y-4">
                    {events.map((ev) => {
                      const meta = EVENT_LABELS[ev.event_type] ?? { label: ev.event_type.replace(/_/g, " "), icon: "·" };
                      return (
                        <div key={ev.id} className="flex items-start gap-4 relative">
                          <div className="w-9 h-9 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-base shrink-0 relative z-10">
                            {meta.icon}
                          </div>
                          <div className="pt-1.5">
                            <p className="text-gray-200 text-sm font-medium">{meta.label}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {ev.source && ev.source !== "direct_link" && (
                                <span className="text-[10px] text-blue-400">via {getSourceLabel(ev.source)}</span>
                              )}
                              <span className="text-gray-600 text-[11px]">{formatShort(ev.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Final event: shared info */}
                    <div className="flex items-start gap-4 relative">
                      <div className="w-9 h-9 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-base shrink-0 relative z-10">
                        ✅
                      </div>
                      <div className="pt-1.5">
                        <p className="text-gray-200 text-sm font-medium">Shared their info with you</p>
                        <p className="text-gray-600 text-[11px] mt-0.5">{formatShort(selected.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-800" />
                  <div className="flex items-start gap-4 relative">
                    <div className="w-9 h-9 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-base shrink-0 relative z-10">✅</div>
                    <div className="pt-1.5">
                      <p className="text-gray-200 text-sm font-medium">Shared their info with you</p>
                      {selected.source && selected.source !== "direct_link" && (
                        <span className="text-[10px] text-blue-400">via {getSourceLabel(selected.source)}</span>
                      )}
                      <p className="text-gray-600 text-[11px] mt-0.5">{formatShort(selected.created_at)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            </div>{/* end Conversation tab */}

            {/* Delete contact */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              {confirmDeleteId === selected.id ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-400 flex-1">Delete this contact permanently?</p>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                  <button
                    onClick={() => deleteLead(selected.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-900/60 text-red-300 hover:bg-red-900 border border-red-800/60 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(selected.id)}
                  className="text-xs text-red-500/70 hover:text-red-400 transition-colors"
                >
                  Delete contact
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
