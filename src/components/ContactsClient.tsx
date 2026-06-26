"use client";

import { useEffect, useState } from "react";
import { getSourceLabel } from "@/lib/source-labels";
import AddContactModal from "@/components/AddContactModal";

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
  follow_up_sequence?: { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at?: string | null }[] | null;
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

// Follow-up sequence presets — auto-send cadences (days + times).
const SEQ_PRESETS = {
  light:      { label: "Light",      desc: "2 touches · tomorrow 10:06 AM, then day 30 at 1:22 PM" },
  medium:     { label: "Medium",     desc: "3 touches · tomorrow 10:06 AM, 2 weeks 1:22 PM, 4 weeks 11:45 AM" },
  aggressive: { label: "Aggressive", desc: "4 touches · tomorrow 10:06 AM, 2 weeks 1:22 PM, 4 weeks 11:45 AM, 8 weeks 11:22 AM" },
} as const;

function to12h(time: string): string {
  const [h, m] = (time || "13:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

function stepLabel(day: number, time: string): string {
  const when = day === 1 ? "Tomorrow" : day % 7 === 0 ? `${day / 7} week${day / 7 > 1 ? "s" : ""}` : `Day ${day}`;
  return `${when} · ${to12h(time)}`;
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
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [editingWhereMet, setEditingWhereMet] = useState(false);
  const [whereMetText, setWhereMetText] = useState("");
  const [fieldSaving, setFieldSaving] = useState<string | null>(null);
  const [aiUpgrade, setAiUpgrade] = useState<string | null>(null);
  // Follow-up sequence builder — Light/Medium/Aggressive presets that auto-send.
  const [seqPreset, setSeqPreset] = useState<"light" | "medium" | "aggressive" | null>(null);
  const [seqItems, setSeqItems] = useState<{ day: number; time: string; message: string; subject?: string; sent_at?: string | null }[] | null>(null);
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqSaving, setSeqSaving] = useState<"idle" | "saving" | "saved">("idle");
  // Independent channel toggles for the automated follow-up flow (email and/or text).
  const [emailOn, setEmailOn] = useState(false);
  const [textOn, setTextOn] = useState(false);
  const [seqSubmitted, setSeqSubmitted] = useState(false);
  const [sortBy, setSortBy] = useState<"alpha" | "recent" | "activity">("alpha");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [detailTab, setDetailTab] = useState<"conversation" | "info">("conversation");
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", company: "", email: "", phone: "" });
  const [convoMessages, setConvoMessages] = useState<{ id: string; direction: string; channel: string | null; body: string; status: string | null; created_at: string }[]>([]);
  const [msgText, setMsgText] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [msgAiLoading, setMsgAiLoading] = useState(false);
  // Chosen send channel for the one-off composer (email or text).
  const [channel, setChannel] = useState<"email" | "text">("email");

  async function sendMessage() {
    if (!selected || !msgText.trim() || msgSending) return;
    if (channel === "email" && !msgSubject.trim()) { setMsgError("Add a subject for your email."); return; }
    setMsgSending(true);
    setMsgError(null);
    try {
      const res = await fetch(`/api/leads/${selected.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: msgText.trim(),
          channel: channel === "text" ? "sms" : "email",
          subject: channel === "email" ? msgSubject.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setConvoMessages((prev) => [...prev, data.message]);
        setMsgText("");
        setMsgSubject("");
      } else {
        setMsgError(data.message || data.error || "Couldn't send. Try again.");
      }
    } catch {
      setMsgError("Couldn't send. Try again.");
    } finally {
      setMsgSending(false);
    }
  }

  // AI-draft the one-off message (and a subject for email). Click again to regenerate.
  async function draftMessage() {
    if (!selected || msgAiLoading) return;
    setMsgAiLoading(true);
    setMsgError(null);
    try {
      const res = await fetch("/api/ai/suggest-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selected.id, meetContext: selected.where_met ?? "", channel: channel === "text" ? "sms" : "email" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.error === "upgrade") {
        setMsgError(data.message || "Upgrade to Pro for unlimited AI drafts.");
        return;
      }
      const first = Array.isArray(data.messages) && data.messages.length ? data.messages[0] : "";
      if (first) setMsgText(first);
      if (channel === "email" && data.subject) setMsgSubject(data.subject);
      if (!first) setMsgError("Couldn't draft a message. Add notes or where you met above.");
    } catch {
      setMsgError("Couldn't draft a message. Try again.");
    } finally {
      setMsgAiLoading(false);
    }
  }

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

  // Pick a preset → AI-generate one message per scheduled day. The result is a
  // DRAFT — nothing schedules until the user hits Submit.
  async function selectPreset(preset: "light" | "medium" | "aggressive") {
    if (!selected || (!emailOn && !textOn)) return;
    setSeqPreset(preset);
    setSeqLoading(true);
    setSeqItems(null);
    setAiUpgrade(null);
    setSeqSubmitted(false);
    try {
      const res = await fetch(`/api/leads/${selected.id}/generate-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetKey: preset,
          whereMet: selected.where_met ?? "",
          notes: selected.notes ?? "",
          // Generate SMS-safe copy if text is enabled (works for both channels).
          channel: textOn ? "sms" : "email",
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data.error === "upgrade") {
        setAiUpgrade(data.message || "Automated follow-up sequences are a Pro feature.");
        setSeqItems(null);
        setSeqPreset(null);
        return;
      }
      setSeqItems(Array.isArray(data.sequence) ? data.sequence : []);
    } catch {
      setSeqItems(null);
    } finally {
      setSeqLoading(false);
    }
  }

  // Editing or changing channels makes the flow a draft again until re-submitted.
  function updateSeqItem(i: number, message: string) {
    setSeqItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, message } : it)) : prev));
    setSeqSubmitted(false);
  }
  function toggleSeqChannel(which: "email" | "text", on: boolean) {
    if (which === "email") setEmailOn(on); else setTextOn(on);
    setSeqSubmitted(false);
  }

  // Submit = activate. Expand each step into one scheduled send per enabled
  // channel (preserving already-sent steps), and save so the cron sends it.
  async function submitSequence() {
    if (!selected || !seqItems?.length) return;
    const channels = [emailOn ? "email" : null, textOn ? "sms" : null].filter(Boolean) as string[];
    if (!channels.length) return;
    setSeqSaving("saving");
    const old = (selected.follow_up_sequence ?? []) as { day: number; channel?: string; sent_at?: string | null }[];
    const payload = seqItems.flatMap((it) =>
      channels.map((ch) => {
        const prior = old.find((o) => o.day === it.day && (o.channel ?? "email") === ch);
        return { day: it.day, time: it.time, message: it.message, subject: it.subject, channel: ch, sent_at: prior?.sent_at ?? null };
      }),
    );
    await fetch(`/api/leads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ follow_up_sequence: payload }),
    });
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, follow_up_sequence: payload } : l)));
    setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, follow_up_sequence: payload } : prev));
    setSeqSubmitted(true);
    setSeqSaving("saved");
    setTimeout(() => setSeqSaving("idle"), 2000);
  }

  // Stop & clear the active flow entirely (both channels off).
  async function clearSequence() {
    if (!selected) return;
    setSeqSaving("saving");
    await fetch(`/api/leads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ follow_up_sequence: [] }),
    });
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, follow_up_sequence: [] } : l)));
    setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, follow_up_sequence: [] } : prev));
    setSeqItems(null);
    setSeqPreset(null);
    setSeqSubmitted(false);
    setSeqSaving("idle");
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
    setWhereMetText(lead.where_met ?? "");
    setChannel(lead.email ? "email" : "text");
    setAiUpgrade(null);
    // Load any existing scheduled sequence — collapse per-channel rows back to
    // one editable step per day, and infer which channels are enabled.
    {
      const existing = (lead.follow_up_sequence ?? null) as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at?: string | null }[] | null;
      if (existing?.length) {
        const byDay = new Map<number, { day: number; time: string; message: string; subject?: string; sent_at?: string | null }>();
        for (const s of existing) {
          if (!byDay.has(s.day)) byDay.set(s.day, { day: s.day, time: s.time ?? "13:00", message: s.message, subject: s.subject, sent_at: s.sent_at ?? null });
        }
        const steps = [...byDay.values()].sort((a, b) => a.day - b.day);
        setSeqItems(steps);
        setSeqPreset(steps.length === 2 ? "light" : steps.length >= 4 ? "aggressive" : "medium");
        setEmailOn(existing.some((s) => (s.channel ?? "email") === "email"));
        setTextOn(existing.some((s) => s.channel === "sms"));
        setSeqSubmitted(true);
      } else {
        setSeqItems(null);
        setSeqPreset(null);
        setEmailOn(false);
        setTextOn(false);
        setSeqSubmitted(false);
      }
      setSeqLoading(false);
      setSeqSaving("idle");
    }
    setMsgText("");
    setMsgSubject("");
    setMsgError(null);
    setConvoMessages([]);
    // Load the message thread (degrades to empty if not yet migrated).
    fetch(`/api/leads/${lead.id}/message`)
      .then((r) => r.json())
      .then((d) => setConvoMessages(Array.isArray(d.messages) ? d.messages : []))
      .catch(() => setConvoMessages([]));
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
    <div className="flex gap-0 lg:h-[calc(100vh-56px)]">
      {/* Left: contact list — full width on mobile, hidden once a contact is opened */}
      <div className={`${selected ? "hidden lg:flex" : "flex"} w-full lg:w-80 xl:w-96 shrink-0 border-r border-gray-800 flex-col lg:overflow-hidden`}>
        {/* Search */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          {/* Add contact — attaches to the currently-selected card */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-gray-500 text-xs">
              {cardFilter !== "all" && userCards.length > 1
                ? `Showing /${cardFilter}`
                : "All contacts"}
            </p>
            <AddContactModal
              cardOwner={cardFilter !== "all" ? cardFilter : (primaryUsername || userCards[0]?.username)}
              onAdded={(lead) => {
                const l = lead as Lead;
                setLeads((prev) => [l, ...prev]);
                // Make sure it's visible under the active filter.
                if (cardFilter !== "all" && l.card_owner && l.card_owner !== cardFilter) {
                  setCardFilter(l.card_owner);
                }
              }}
            />
          </div>
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
        <div className="flex-1 lg:overflow-y-auto pb-20 lg:pb-0">
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

      {/* Right: detail panel — full-screen overlay on mobile, side pane on desktop */}
      <div className={`${selected ? "fixed inset-0 z-40 bg-gray-950 overflow-y-auto" : "hidden"} lg:static lg:z-auto lg:block lg:flex-1 lg:overflow-y-auto`}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 gap-3">
            <svg className="w-10 h-10 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-sm">Select a contact to view details</p>
          </div>
        ) : (
          <>
            {/* Mobile back bar */}
            <div className="lg:hidden sticky top-0 z-10 flex items-center gap-2 px-4 h-12 bg-gray-950/95 backdrop-blur border-b border-gray-800">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Contacts
              </button>
            </div>
          <div className="max-w-xl mx-auto p-6 sm:p-8 pb-24 lg:pb-8">
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

            </div>

            {/* Follow-up Sequence — turn on a channel, then submit to activate */}
            {(() => {
              const anyOn = emailOn || textOn;
              const seqWord = emailOn && textOn ? "emails & texts" : textOn ? "texts" : "emails";
              return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Follow-up Sequence</p>
                  <p className="text-gray-600 text-xs mt-0.5">Turn on a channel to schedule an auto-sending flow.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {([
                    { id: "email", label: "Email", icon: "✉", on: emailOn, can: !!selected.email },
                    { id: "text",  label: "Text",  icon: "💬", on: textOn,  can: !!selected.phone },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => t.can && toggleSeqChannel(t.id, !t.on)}
                      disabled={!t.can}
                      title={t.can ? `Toggle ${t.label.toLowerCase()} flow` : `No ${t.id === "email" ? "email" : "phone"} on file`}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                        t.on ? "bg-blue-600 border-blue-600 text-white" : t.can ? "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200" : "bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.on ? "bg-white" : "bg-gray-600"}`} />
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {!anyOn ? (
                (selected.follow_up_sequence && selected.follow_up_sequence.length > 0) ? (
                  <div className="border border-amber-800/40 bg-amber-950/20 rounded-xl py-4 px-4 text-center">
                    <p className="text-amber-200 text-sm">Both channels are off, but a follow-up flow is still scheduled.</p>
                    <button
                      onClick={clearSequence}
                      disabled={seqSaving === "saving"}
                      className="inline-block mt-2 text-xs font-semibold text-white px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
                    >
                      {seqSaving === "saving" ? "Turning off…" : "Turn off this flow"}
                    </button>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-700 rounded-xl py-5 px-4 text-center">
                    <p className="text-gray-400 text-sm">Turn on <strong>Email</strong> or <strong>Text</strong> to set up an automated follow-up flow.</p>
                    <p className="text-gray-600 text-xs mt-1">You can run one or both.</p>
                  </div>
                )
              ) : (
                <>
                  {/* Preset chooser — each shows what it does before generating */}
                  <div className="space-y-2 mb-4">
                    {(["light", "medium", "aggressive"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => selectPreset(p)}
                        disabled={seqLoading}
                        className={`w-full text-left rounded-xl px-3.5 py-2.5 border transition-colors disabled:opacity-60 ${seqPreset === p ? "border-blue-500 bg-blue-950/30" : "border-gray-700 bg-gray-800/40 hover:border-gray-600"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-100">{SEQ_PRESETS[p].label}</span>
                          {seqPreset === p && <span className="text-[10px] text-blue-400 font-semibold">Selected</span>}
                        </div>
                        <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">{SEQ_PRESETS[p].desc}</p>
                      </button>
                    ))}
                  </div>

                  {seqLoading && (
                    <div className="flex items-center justify-center gap-2 py-3 text-gray-500 text-sm">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Writing your {seqWord}…
                    </div>
                  )}

                  {/* Editable per-day messages — write your own instead of the AI suggestion */}
                  {!seqLoading && seqItems && seqItems.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px]">
                        {seqSubmitted
                          ? <span className="text-emerald-400">● Active — auto-sending via {seqWord}.</span>
                          : <span className="text-amber-400">● Draft — edit any message, then Submit to activate.</span>}
                      </p>
                      {seqItems.map((it, i) => (
                        <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-blue-300">{stepLabel(it.day, it.time)}</span>
                            {it.sent_at && <span className="text-[10px] text-emerald-400">Sent ✓</span>}
                          </div>
                          <textarea
                            value={it.message}
                            onChange={(e) => updateSeqItem(i, e.target.value)}
                            rows={2}
                            disabled={!!it.sent_at}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-between">
                        <button onClick={() => seqPreset && selectPreset(seqPreset)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Regenerate ↺</button>
                        <button
                          onClick={submitSequence}
                          disabled={seqSaving === "saving" || seqSubmitted}
                          className="text-xs font-semibold text-white px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors"
                        >
                          {seqSaving === "saving" ? "Submitting…" : seqSubmitted ? "Active ✓" : "Submit & activate"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {aiUpgrade && (
                <div className="border border-blue-800/40 bg-blue-950/40 rounded-xl py-4 px-4 text-center mt-3">
                  <p className="text-blue-200 text-sm">{aiUpgrade}</p>
                  <a href="/pricing" className="inline-block mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro →</a>
                </div>
              )}
            </div>
              );
            })()}

            {/* Master pause — stops ALL automated follow-ups for this contact */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mt-6 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-gray-200 text-sm font-medium">Automated follow-ups</p>
                <p className="text-gray-500 text-xs mt-0.5">{automationOn ? "On — sends this contact's sequence above (or the default Day 1/15/30 emails if no sequence is set)." : "Off — all automated emails & texts to this contact are paused."}</p>
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Conversation</p>
                {/* Send-channel toggle — also drives the AI follow-up preset style */}
                <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
                  {([
                    { id: "email", label: "Email", on: !!selected.email },
                    { id: "text", label: "Text", on: !!selected.phone },
                  ] as const).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => c.on && setChannel(c.id)}
                      disabled={!c.on}
                      title={c.on ? `Send as ${c.label.toLowerCase()}` : `No ${c.id === "email" ? "email" : "phone"} on file`}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                        channel === c.id ? "bg-blue-600 text-white" : c.on ? "text-gray-400 hover:text-gray-200" : "text-gray-700 cursor-not-allowed"
                      }`}
                    >
                      {c.id === "email" ? "✉" : "💬"} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread */}
              <div className="space-y-2.5 mb-4">
                {selected.message && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-gray-800 text-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                      {selected.message}
                    </div>
                  </div>
                )}
                {convoMessages.map((m) => (
                  <div key={m.id} className="flex flex-col items-end">
                    <div className={`max-w-[85%] text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${m.channel === "sms" ? "bg-emerald-600" : "bg-blue-600"}`}>
                      {m.body}
                    </div>
                    <span className="text-gray-600 text-[10px] mt-1 pr-1 flex items-center gap-1.5">
                      <span className={`px-1.5 py-px rounded font-semibold ${m.channel === "sms" ? "bg-emerald-900/50 text-emerald-300" : "bg-blue-900/50 text-blue-300"}`}>
                        {m.channel === "sms" ? "💬 Text" : "✉ Email"}
                      </span>
                      <span>
                        {m.status === "sent" ? "Sent" : m.status === "not_configured" ? "Not sent" : m.status === "failed" ? "Failed" : "Sent"}
                        {m.created_at ? ` · ${formatShort(m.created_at)}` : ""}
                      </span>
                    </span>
                  </div>
                ))}
                {!selected.message && convoMessages.length === 0 && (
                  <p className="text-gray-500 text-sm leading-relaxed">
                    No messages yet. Send {selected.name.split(" ")[0]} a message below — it arrives as a branded SwiftCard {selected.email ? "email" : "text"}.
                  </p>
                )}
              </div>

              {/* Composer */}
              {selected.email || selected.phone ? (
                <div className="space-y-2">
                  {channel === "email" && (
                    <input
                      type="text"
                      value={msgSubject}
                      onChange={(e) => { setMsgSubject(e.target.value); setMsgError(null); }}
                      placeholder="Subject"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  )}
                  <textarea
                    value={msgText}
                    onChange={(e) => { setMsgText(e.target.value); setMsgError(null); }}
                    placeholder={channel === "email" ? `Write your email to ${selected.name.split(" ")[0]}…` : `Text ${selected.name.split(" ")[0]}…`}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={draftMessage}
                      disabled={msgAiLoading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                      {msgAiLoading ? "Drafting…" : msgText.trim() ? "Regenerate" : "AI draft"}
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={!msgText.trim() || msgSending}
                      className={`text-xs font-semibold text-white px-4 py-2 rounded-full disabled:opacity-40 transition-colors ${channel === "text" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"}`}
                    >
                      {msgSending ? "Sending…" : `Send ${channel}`}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {msgError ? <span className="text-red-400">{msgError}</span> : "Your name, company & SwiftCard link are added as a signature."}
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 text-xs">Add an email or phone number for this contact to message them.</p>
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
          </>
        )}
      </div>
    </div>
  );
}
