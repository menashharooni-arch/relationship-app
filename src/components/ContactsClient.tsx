"use client";

import { useEffect, useRef, useState } from "react";
import { getSourceLabel } from "@/lib/source-labels";
import AddContactModal from "@/components/AddContactModal";
import ShareMyInfoButton from "@/components/ShareMyInfoButton";
import { PlanGate } from "@/components/PlanGate";
import { AiDraftTag } from "@/components/AiConsentGate";
import { openFileViaSystemBrowser } from "@/lib/native-file";

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
  follow_up_sequence?: { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at?: string | null; anchor?: string }[] | null;
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
  viewed_card:           { label: "Viewed your card",       icon: "·" },
  clicked_save_contact:  { label: "Clicked Save Contact",   icon: "·" },
  downloaded_vcard:      { label: "Downloaded your contact", icon: "·" },
  shared_info:           { label: "Shared their info",       icon: "✓" },
};

// Natural-language phrases for the read-only conversation/activity log,
// prefixed with the contact's first name ("Aaron saved your contact").
const ACTIVITY_PHRASES: Record<string, string> = {
  viewed_card:           "viewed your card",
  clicked_save_contact:  "tapped Save Contact",
  downloaded_vcard:      "saved your contact",
  shared_info:           "shared their info with you",
};

const STATUS_STYLES: Record<string, string> = {
  new_contact: "bg-gray-800 text-gray-400",
  touch:       "bg-blue-950 text-blue-400",
  dissolved:   "bg-gray-900 text-gray-600",
  // Settable from the Office Leads tab — listed here so an Office-marked lead
  // renders correctly in personal contacts instead of falling back to "New".
  not_interested: "bg-gray-900 text-gray-500",
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

// Actual calendar date/time a step will send: contact-created + N days, at the
// step's time-of-day. Used in the post-submit "when they send" summary.
function sendWhen(createdAt: string, day: number, time: string): string {
  const d = new Date(new Date(createdAt).getTime() + day * 86400000);
  const [h, m] = (time || "13:00").split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const PRESET_FROM_COUNT = (n: number): string => (n >= 4 ? "Aggressive" : n === 2 ? "Light" : "Medium");

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
      Preset {preset}
    </span>
  );
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-600">no flow</span>;
}

export default function ContactsClient({
  leads: initialLeads,
  primaryUsername,
  userCards = [],
  initialCardFilter = null,
  initialSelectedId = null,
}: {
  leads: Lead[];
  primaryUsername?: string;
  userCards?: { username: string; name: string }[];
  initialCardFilter?: string | null;
  /** Deep link (?lead=) — open this contact's detail panel on load. */
  initialSelectedId?: string | null;
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read from localStorage
        setCardFilter(saved);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selected, setSelected] = useState<Lead | null>(
    initialSelectedId ? initialLeads.find((l) => l.id === initialSelectedId) ?? null : null,
  );
  // Guards against out-of-order responses: if the user clicks a second contact
  // before the first contact's message/events fetch resolves, the stale fetch
  // must not overwrite the panel with the wrong contact's data.
  const selectSeq = useRef(0);
  const [events, setEvents] = useState<CardEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [editingWhereMet, setEditingWhereMet] = useState(false);
  const [whereMetText, setWhereMetText] = useState("");
  const [fieldSaving, setFieldSaving] = useState<string | null>(null);
  const [aiUpgrade, setAiUpgrade] = useState<string | null>(null);
  // Per-channel follow-up automations. Email and text are INDEPENDENT — each has
  // its own toggle, preset, format and on/off, and both can be active at once —
  // but you set them up one at a time. The active flow for each channel lives in
  // the lead's follow_up_sequence; `draft*` is the channel currently being set up.
  const [draftCh, setDraftCh] = useState<"email" | "sms" | null>(null);
  const [draftPreset, setDraftPreset] = useState<"light" | "medium" | "aggressive" | null>(null);
  const [draftItems, setDraftItems] = useState<{ day: number; time: string; channel: "email" | "sms"; message: string; subject?: string }[] | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [seqSaving, setSeqSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [sortBy, setSortBy] = useState<"alpha" | "recent" | "activity">("alpha");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [detailTab, setDetailTab] = useState<"conversation" | "info">("conversation");
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ name: "", company: "", email: "", phone: "" });
  // Dedicated state machine for the "Contact Info / Presets" Save button so it
  // can show clear Default/Saving/Success/Error feedback and never fire twice.
  const [contactSaveStatus, setContactSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [convoMessages, setConvoMessages] = useState<{ id: string; direction: string; channel: string | null; body: string; status: string | null; created_at: string }[]>([]);

  // Guided tour: when the tour reaches the Contacts page, auto-open the sample
  // (demo) contact on its info tab so the tour can walk through the contact's
  // details and the follow-up automations. No-op outside the tour.
  useEffect(() => {
    let touring = false;
    try { touring = sessionStorage.getItem("sc_tour_running") === "1"; } catch { /* ignore */ }
    if (!touring) return;
    const demo = leads.find((l) => (l.tags ?? []).includes("demo")) ?? leads[0];
    if (demo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time tour bootstrap read from sessionStorage
      setSelected(demo);
      setDetailTab("info");
      setWhereMetText(demo.where_met ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveContact() {
    // In-flight guard: a second tap while saving must not fire a duplicate PATCH.
    if (!selected || contactSaveStatus === "saving") return;
    if (!contactDraft.name.trim()) return;
    setContactSaveStatus("saving");
    setFieldSaving("contact");
    let ok = false;
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactDraft),
      });
      ok = res.ok;
    } catch { /* network error — leave the editor open with the draft intact */ }
    setFieldSaving(null);
    if (ok) {
      const patch = { ...contactDraft };
      setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
      // Flash a success confirmation, then close the editor.
      setContactSaveStatus("saved");
      setTimeout(() => { setEditingContact(false); setContactSaveStatus("idle"); }, 900);
    } else {
      // Keep the editor open with the draft intact so nothing is lost.
      setContactSaveStatus("error");
      setTimeout(() => setContactSaveStatus("idle"), 2500);
    }
  }

  // Download this contact as a vCard so the user can save it to their phone.
  async function saveContactToPhone() {
    if (!selected) return;
    // Native shell: a Blob/anchor download no-ops in WKWebView. Route to the
    // server vCard over the system browser sheet, where iOS shows the real
    // "Add to Contacts" preview. Web keeps the client Blob path below.
    if (await openFileViaSystemBrowser(`/api/leads/vcard?id=${encodeURIComponent(selected.id)}`)) return;
    const esc = (v: string) => v.replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");
    const name = (selected.name || "Contact").trim();
    const parts = name.split(" ");
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${esc(name)}`,
      `N:${esc(parts.slice(1).join(" "))};${esc(parts[0] || "")};;;`,
    ];
    if (selected.company) lines.push(`ORG:${esc(selected.company)}`);
    if (selected.email) lines.push(`EMAIL;TYPE=INTERNET:${selected.email.trim()}`);
    if (selected.phone) lines.push(`TEL;TYPE=CELL:${selected.phone.trim()}`);
    const note = [selected.where_met ? `Met at: ${selected.where_met}` : "", selected.notes ?? ""].filter(Boolean).join(" — ");
    if (note) lines.push(`NOTE:${esc(note)}`);
    lines.push("END:VCARD");

    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]+/gi, "_")}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Per-channel pause (email-paused / sms-paused tags — the cron skips a paused
  // channel's steps and they resume, unsent, when switched back on). The two
  // channel switches are THE automation controls: text off stops texts, email
  // off stops emails. (The old master flow-paused toggle is gone — any channel
  // interaction also clears a legacy flow-paused tag so old contacts unblock.)
  function channelPausedFor(ch: "email" | "sms") {
    return (selected?.tags ?? []).includes(ch === "email" ? "email-paused" : "sms-paused");
  }
  async function toggleChannelPause(ch: "email" | "sms") {
    if (!selected) return;
    const tag = ch === "email" ? "email-paused" : "sms-paused";
    const tags = (selected.tags ?? []).filter((t) => t !== "flow-paused");
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await updateTags(selected.id, next);
  }

  // Reset a channel: wipe its automation entirely (the other channel keeps
  // running) and open setup so a fresh one can be submitted. The new flow is
  // anchored at submit time, so it restarts with its next message from then.
  async function resetChannel(ch: "email" | "sms") {
    if (!selected) return;
    const remaining = ((selected.follow_up_sequence ?? []) as { channel?: string }[]).filter(
      (o) => (o.channel ?? "email") !== ch
    );
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_sequence: remaining }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, follow_up_sequence: remaining as Lead["follow_up_sequence"] } : l)));
    setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, follow_up_sequence: remaining as Lead["follow_up_sequence"] } : prev));
    // Un-pause the channel + clear any legacy master pause so the NEW automation
    // runs as soon as it's submitted (toggle on = it works).
    const tags = (selected.tags ?? []).filter((t) => t !== "flow-paused" && t !== (ch === "email" ? "email-paused" : "sms-paused"));
    await updateTags(selected.id, tags);
    startDraft(ch);
  }

  async function saveField(field: string, value: string) {
    if (!selected) return;
    setFieldSaving(field);
    const ok = await updateField(selected.id, field, value);
    if (ok) setSelected((prev) => prev ? { ...prev, [field]: value } : prev);
    setFieldSaving(null);
  }

  // Turn a channel ON to configure it — one channel at a time.
  function startDraft(ch: "email" | "sms") {
    setDraftCh(ch);
    setDraftPreset(null);
    setDraftItems(null);
    setAiUpgrade(null);
    setDraftError(null);
  }
  function cancelDraft() {
    setDraftCh(null);
    setDraftPreset(null);
    setDraftItems(null);
    setAiUpgrade(null);
    setDraftError(null);
  }

  // Pick a preset → AI-generate the draft for the ONE channel being set up.
  // Nothing schedules until Submit.
  async function selectPreset(preset: "light" | "medium" | "aggressive") {
    if (!selected || !draftCh) return;
    setDraftPreset(preset);
    setDraftLoading(true);
    setDraftItems(null);
    setAiUpgrade(null);
    setDraftError(null);
    try {
      const res = await fetch(`/api/leads/${selected.id}/generate-sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetKey: preset, whereMet: selected.where_met ?? "", notes: selected.notes ?? "", channel: draftCh }),
      });
      const data = await res.json();
      if (res.status === 402 || data.error === "upgrade") {
        setAiUpgrade(data.message || "Automated follow-up sequences are a Pro feature.");
        setDraftItems(null);
        setDraftPreset(null);
        return;
      }
      const items = (Array.isArray(data.sequence) ? data.sequence : []).map((s: { day: number; time: string; message: string; subject?: string }) => ({
        day: s.day, time: s.time, channel: draftCh, message: s.message, subject: s.subject,
      }));
      // A failure must never look like a dead button — surface it so the user
      // can tap the preset again instead of assuming the feature is broken.
      if (!res.ok || items.length === 0) {
        setDraftError("Couldn't write the messages just now — tap a cadence to try again.");
        setDraftItems(null);
        setDraftPreset(null);
        return;
      }
      setDraftError(null);
      setDraftItems(items);
    } catch {
      setDraftError("Couldn't write the messages just now — check your connection and tap a cadence to try again.");
      setDraftItems(null);
      setDraftPreset(null);
    } finally {
      setDraftLoading(false);
    }
  }

  function updateDraftItem(i: number, message: string) {
    setDraftItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, message } : it)) : prev));
  }
  function updateDraftSubject(i: number, subject: string) {
    setDraftItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, subject } : it)) : prev));
  }

  // Submit the draft → activate THIS channel. Merge into follow_up_sequence,
  // keeping the OTHER channel's items (so both can run). Steps are anchored to
  // NOW (not the contact's created date) so flows set up later still send.
  async function submitDraft() {
    if (!selected || !draftCh || !draftItems?.length) return;
    setSeqSaving("saving");
    const nowIso = new Date().toISOString();
    const old = (selected.follow_up_sequence ?? []) as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at?: string | null; anchor?: string }[];
    const otherChannel = old.filter((o) => (o.channel ?? "email") !== draftCh);
    const oldMine = old.filter((o) => (o.channel ?? "email") === draftCh);
    // A finished flow being set up again starts FRESH — carrying old sent_at
    // stamps would silently mark the new steps as already sent. Mid-flight
    // re-drafts keep sent steps (and their schedule) so nothing double-sends.
    const freshStart = oldMine.length === 0 || oldMine.every((o) => o.sent_at);
    const mine = draftItems.map((it) => {
      const prior = freshStart ? undefined : oldMine.find((o) => o.day === it.day);
      return {
        day: it.day, time: it.time, message: it.message, subject: it.subject, channel: draftCh,
        sent_at: prior?.sent_at ?? null,
        anchor: prior ? prior.anchor : nowIso,
      };
    });
    const payload = [...otherChannel, ...mine];
    let ok = false;
    try {
      const res = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_sequence: payload }),
      });
      ok = res.ok;
    } catch { /* network error */ }
    if (!ok) {
      // Keep the draft on screen so nothing is lost — the user can retry.
      setSeqSaving("idle");
      alert("Couldn't save the automation — please try again.");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, follow_up_sequence: payload } : l)));
    setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, follow_up_sequence: payload } : prev));
    // Submitting turns this channel ON: clear any stale pause (and the legacy
    // master pause) so the new automation runs immediately.
    const pauseTag = draftCh === "email" ? "email-paused" : "sms-paused";
    const curTags = selected.tags ?? [];
    if (curTags.includes(pauseTag) || curTags.includes("flow-paused")) {
      await updateTags(selected.id, curTags.filter((t) => t !== pauseTag && t !== "flow-paused"));
    }
    cancelDraft();
    setSeqSaving("saved");
    setTimeout(() => setSeqSaving("idle"), 2000);
  }

  async function changeStatus(newStatus: string) {
    if (!selected) return;
    const ok = await updateField(selected.id, "status", newStatus);
    if (!ok) return;
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
    const seq = ++selectSeq.current;
    setSelected(lead);
    setEvents([]);
    setDetailTab("conversation");
    setEditingContact(false);
    setEditingNotes(false);
    setEditingWhereMet(false);
    setWhereMetText(lead.where_met ?? "");
    setAiUpgrade(null);
    // The active automations render directly from the lead's follow_up_sequence;
    // just clear any in-progress draft when switching contacts.
    setDraftCh(null);
    setDraftPreset(null);
    setDraftItems(null);
    setDraftLoading(false);
    setSeqSaving("idle");
    setConvoMessages([]);
    // Load the message thread (degrades to empty if not yet migrated). Guarded
    // by `seq` so a slow response for a contact the user already navigated
    // away from can't overwrite the currently-selected contact's messages.
    fetch(`/api/leads/${lead.id}/message`)
      .then((r) => r.json())
      .then((d) => { if (selectSeq.current === seq) setConvoMessages(Array.isArray(d.messages) ? d.messages : []); })
      .catch(() => { if (selectSeq.current === seq) setConvoMessages([]); });
    if (!lead.visitor_id) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/card-events?visitor_id=${lead.visitor_id}`);
      const data = await res.json();
      if (selectSeq.current === seq) setEvents(Array.isArray(data) ? data : []);
    } catch {
      if (selectSeq.current === seq) setEvents([]);
    } finally {
      if (selectSeq.current === seq) setLoadingEvents(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  // Every mutator below only applies its local state change when the server
  // ACCEPTED the write — a failed PATCH (expired session, deleted lead, 500)
  // must never leave the UI pretending the save happened.
  async function updateField(leadId: string, field: string, value: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // tags is a Postgres text[] — send the real array, not a stringified one.
  async function updateTags(leadId: string, tags: string[]): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, tags } : l)));
    setSelected((prev) => (prev && prev.id === leadId ? { ...prev, tags } : prev));
    return true;
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
    let ok = false;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      ok = res.ok;
    } catch { /* network error — keep the contact in the list */ }
    setConfirmDeleteId(null);
    if (!ok) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  async function saveNotes() {
    if (!selected) return;
    setNotesSaving(true);
    const ok = await updateField(selected.id, "notes", notesText);
    if (ok) setSelected((prev) => prev ? { ...prev, notes: notesText } : prev);
    setNotesSaving(false);
    if (ok) setEditingNotes(false);
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
                <span className="text-[10px] font-semibold text-amber-400">follow-up due</span>
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
            <div data-tour="contact-detail" className="flex items-start gap-5 mb-8">
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
                      { value: "not_interested", label: "Not interested" },
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

            {/* Quick actions — call the contact, share YOUR info with them, and
                save them to your phone */}
            <div className="flex items-center gap-2 mb-6">
              {selected.phone ? (
                <a
                  href={`tel:${selected.phone}`}
                  className="flex items-center justify-center gap-1.5 flex-1 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  Call
                </a>
              ) : (
                <span className="flex-1 text-center text-xs text-gray-600 py-2.5 rounded-xl border border-dashed border-gray-800">No phone to call</span>
              )}
              <ShareMyInfoButton
                leadId={selected.id}
                firstName={(selected.name || "them").split(" ")[0]}
                hasPhone={!!selected.phone}
                hasEmail={!!selected.email}
              />
              <button
                onClick={saveContactToPhone}
                className="flex items-center justify-center gap-1.5 flex-1 text-sm font-semibold py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                Save to phone
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
                    onClick={() => { setContactDraft({ name: selected.name ?? "", company: selected.company ?? "", email: selected.email ?? "", phone: selected.phone ?? "" }); setContactSaveStatus("idle"); setEditingContact(true); }}
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
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setEditingContact(false); setContactSaveStatus("idle"); }}
                      disabled={contactSaveStatus === "saving"}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveContact}
                      disabled={contactSaveStatus === "saving" || contactSaveStatus === "saved" || !contactDraft.name.trim()}
                      aria-busy={contactSaveStatus === "saving"}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed"
                      style={{
                        background:
                          contactSaveStatus === "saved" ? "#16a34a"
                          : contactSaveStatus === "error" ? "#dc2626"
                          : "#2563eb",
                        opacity: contactSaveStatus === "idle" && !contactDraft.name.trim() ? 0.5 : 1,
                      }}
                    >
                      {contactSaveStatus === "saving" ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Saving…
                        </>
                      ) : contactSaveStatus === "saved" ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Saved!
                        </>
                      ) : contactSaveStatus === "error" ? (
                        "Error — try again"
                      ) : (
                        "Save changes"
                      )}
                    </button>
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

            {/* Follow-up automations — Email and Text are independent, and the two
                channel switches are the ONLY controls: text off stops texts, email
                off stops emails (email-paused / sms-paused — the cron skips a
                paused channel and it resumes when switched back on). Reset clears
                a channel's automation so a fresh one can be submitted, restarting
                from submit time. */}
            <div data-tour="contact-automations" className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Follow-up Automations</p>
              <p className="text-gray-600 text-xs mt-0.5 mb-3">Set up Email and Text separately — run one or both.</p>

              <p className="text-[11px] text-gray-500 bg-gray-800/40 border border-gray-700/60 rounded-lg px-3 py-2 mb-4 leading-relaxed">
                The AI writes each message from this contact&apos;s <strong className="text-gray-300">where you met</strong> and <strong className="text-gray-300">notes</strong> — for a great, human response make those descriptive.
              </p>

              <div className="space-y-3">
                {([
                  { ch: "email" as const, label: "Email", can: !!selected.email, word: "email", noun: "emails" },
                  { ch: "sms" as const,   label: "Text",  can: !!selected.phone, word: "text",  noun: "texts" },
                ]).map(({ ch, label, can, word, noun }) => {
                  const activeItems = ((selected.follow_up_sequence ?? []) as { day: number; time?: string; message: string; subject?: string; channel?: string; sent_at?: string | null; anchor?: string }[])
                    .filter((i) => (i.channel ?? "email") === ch)
                    .sort((a, b) => a.day - b.day);
                  const isDrafting = draftCh === ch;
                  const hasActive = activeItems.length > 0;
                  const allSent = hasActive && activeItems.every((i) => i.sent_at);
                  const running = hasActive && !allSent;
                  const chPaused = channelPausedFor(ch);
                  const presetName = PRESET_FROM_COUNT(activeItems.length);
                  const switchOn = isDrafting || (running && !chPaused);

                  return (
                    <div key={ch} className={`border rounded-xl p-4 ${switchOn ? (ch === "sms" ? "border-emerald-800/50 bg-emerald-950/10" : "border-blue-800/50 bg-blue-950/10") : "border-gray-800 bg-gray-800/20"}`}>
                      {/* Header + on/off toggle */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-100">{label} automation</p>
                          <p className="text-gray-600 text-[11px] mt-0.5">
                            {!can ? `No ${ch === "email" ? "email" : "phone"} on file for this contact`
                              : running && chPaused ? `Off — remaining ${noun} won't send. Switch on to resume.`
                              : running ? `On · ${presetName} · auto-sending ${noun}`
                              : allSent ? `Completed · all ${activeItems.length} ${noun} sent`
                              : isDrafting ? "Choose a cadence, then submit to activate"
                              : `Off — set up a ${word} follow-up`}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={switchOn}
                          disabled={!can}
                          title={!can ? "No contact info"
                            : running ? (chPaused ? `Resume ${word} automation` : `Turn ${word} automation off`)
                            : `Set up a ${word} follow-up`}
                          onClick={() => {
                            if (!can) return;
                            // A live flow toggles ITS OWN channel off/on; otherwise the
                            // switch opens (or closes) the setup flow.
                            if (running) { toggleChannelPause(ch); return; }
                            if (isDrafting) cancelDraft(); else startDraft(ch);
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${!can ? "opacity-60 cursor-not-allowed" : ""}`}
                          style={{ background: switchOn ? (ch === "sms" ? "#059669" : "#2563eb") : "#374151" }}
                        >
                          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: switchOn ? "22px" : "2px" }} />
                        </button>
                      </div>

                      {/* DRAFTING — pick a preset, edit, submit */}
                      {isDrafting && (
                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <div className="space-y-2 mb-3">
                            {(["light", "medium", "aggressive"] as const).map((p) => (
                              <button
                                key={p}
                                onClick={() => selectPreset(p)}
                                disabled={draftLoading}
                                className={`w-full text-left rounded-xl px-3.5 py-2.5 border transition-colors disabled:opacity-60 ${draftPreset === p ? (ch === "sms" ? "border-emerald-500 bg-emerald-950/30" : "border-blue-500 bg-blue-950/30") : "border-gray-700 bg-gray-800/40 hover:border-gray-600"}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-100">{SEQ_PRESETS[p].label}</span>
                                  {draftPreset === p && <span className="text-[10px] text-gray-400 font-semibold">Selected</span>}
                                </div>
                                <p className="text-gray-500 text-[11px] mt-0.5 leading-relaxed">{SEQ_PRESETS[p].desc}</p>
                              </button>
                            ))}
                          </div>

                          {draftError && !draftLoading && (
                            <p className="text-[12px] text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 mb-3">⚠ {draftError}</p>
                          )}

                          {draftLoading && (
                            <div className="flex items-center justify-center gap-2 py-3 text-gray-500 text-sm">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              Writing your {noun}…
                            </div>
                          )}

                          {!draftLoading && draftItems && draftItems.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-[11px] text-amber-400">● Draft — edit any message, then Submit to activate.</p>
                              {draftItems.map((it, i) => (
                                <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                                  {/* Native-only "AI draft" tag; renders null (no DOM) on web. */}
                                  <AiDraftTag />
                                  <p className="text-[11px] font-semibold text-gray-400 mb-1.5">{stepLabel(it.day, it.time)}</p>
                                  {ch === "email" && (
                                    <input
                                      type="text"
                                      value={it.subject ?? ""}
                                      onChange={(e) => updateDraftSubject(i, e.target.value)}
                                      placeholder="Email subject"
                                      className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-1.5 text-xs mb-1.5 focus:outline-none focus:border-blue-500"
                                    />
                                  )}
                                  <textarea
                                    value={it.message}
                                    onChange={(e) => updateDraftItem(i, e.target.value)}
                                    rows={2}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              ))}
                              <div className="flex items-center justify-between">
                                <button onClick={() => draftPreset && selectPreset(draftPreset)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Regenerate ↺</button>
                                <div className="flex items-center gap-2">
                                  <button onClick={cancelDraft} className="text-xs font-semibold text-gray-400 hover:text-gray-200 px-3 py-2 transition-colors">Cancel</button>
                                  <button
                                    onClick={submitDraft}
                                    disabled={seqSaving === "saving"}
                                    className={`text-xs font-semibold text-white px-5 py-2 rounded-full disabled:opacity-40 transition-colors ${ch === "sms" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"}`}
                                  >
                                    {seqSaving === "saving" ? "Submitting…" : "Submit & activate"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ACTIVE / PAUSED — submitted summary: preset + messages + when they send */}
                      {!isDrafting && running && (
                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <p className={`text-[11px] font-semibold mb-2 ${!chPaused ? (ch === "sms" ? "text-emerald-400" : "text-blue-400") : "text-amber-400"}`}>
                            {!chPaused ? `● On — ${presetName}` : `⏸ Off — ${presetName}`} · {activeItems.length} {noun}
                          </p>
                          <div className="space-y-2">
                            {activeItems.map((it, i) => (
                              <div key={i} className="bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[10px] font-semibold text-gray-500">
                                    {it.sent_at ? `Sent ${formatShort(it.sent_at)}` : `Sends ${sendWhen(it.anchor ?? selected.created_at, it.day, it.time ?? "13:00")}`}
                                  </span>
                                  {it.sent_at
                                    ? <span className="text-[10px] text-emerald-400 shrink-0">✓</span>
                                    : chPaused
                                    ? <span className="text-[10px] text-amber-500/90 shrink-0">paused</span>
                                    : <span className="text-[10px] text-gray-600 shrink-0">scheduled</span>}
                                </div>
                                {ch === "email" && it.subject && <p className="text-[11px] text-gray-400 font-medium truncate">Subject: {it.subject}</p>}
                                <p className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">{it.message}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <p className="text-gray-600 text-[10px]">
                              {chPaused
                                ? "Off — nothing sends. Switch on to resume, or reset to start over."
                                : `Switch off above to pause ${ch === "sms" ? "texts" : "emails"} anytime.`}
                            </p>
                            {/* Reset appears ONLY while the channel is switched off/paused —
                                a running automation must be paused before it can be wiped. */}
                            {chPaused && (
                              <button
                                onClick={() => resetChannel(ch)}
                                className="text-[11px] font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded-full transition-colors shrink-0"
                                title={`Clear this ${word} automation and set up a new one`}
                              >
                                Reset ↺
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* COMPLETED — all sent; reset to run a fresh one */}
                      {!isDrafting && allSent && (
                        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                          <p className="text-emerald-400 text-xs">✓ All {activeItems.length} {noun} sent.</p>
                          <button onClick={() => resetChannel(ch)} disabled={!can} className="text-xs font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40">Reset ↺</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {aiUpgrade && (
                <PlanGate
                  feature="ai-sequences"
                  nativeCopy="Pro feature — Automated follow-up sequences are only available on the Pro plan."
                >
                  <div className="border border-blue-800/40 bg-blue-950/40 rounded-xl py-4 px-4 text-center mt-3">
                    <p className="text-blue-200 text-sm">{aiUpgrade}</p>
                    <a href="/upgrade" className="inline-block mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300">Upgrade to Pro →</a>
                  </div>
                </PlanGate>
              )}
            </div>

            </div>{/* end Contact info / Presets tab */}

            {/* ── CONVERSATION TAB ── */}
            <div className={detailTab === "conversation" ? "" : "hidden"}>

            {/* Activity & messages — read-only log of what this contact did and what was auto-sent */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Activity &amp; Messages</p>
                <span className="text-[10px] text-gray-600">Auto-tracked · read-only</span>
              </div>

              {loadingEvents ? (
                <p className="text-gray-600 text-sm">Loading activity…</p>
              ) : (() => {
                const fname = selected.name.split(" ")[0] || "They";
                const items: { at: string; key: string; kind: "event" | "in" | "out"; icon?: string; text?: string; source?: string | null; body?: string; channel?: string | null; status?: string | null }[] = [];
                for (const ev of events) {
                  // "clicked_save_contact" always fired alongside "downloaded_vcard"
                  // (same tap) — we stopped emitting it, and we hide the historical
                  // ones so old conversations show one "saved your contact" line too.
                  if (ev.event_type === "clicked_save_contact") continue;
                  items.push({ at: ev.created_at, key: `ev-${ev.id}`, kind: "event", icon: EVENT_LABELS[ev.event_type]?.icon ?? "·", text: `${fname} ${ACTIVITY_PHRASES[ev.event_type] ?? ev.event_type.replace(/_/g, " ")}`, source: ev.source });
                }
                items.push({ at: selected.created_at, key: "shared", kind: "event", icon: "✓", text: `${fname} shared their info with you`, source: selected.source });
                if (selected.message) items.push({ at: selected.created_at, key: "note", kind: "in", body: selected.message });
                for (const m of convoMessages) {
                  items.push(m.direction === "in"
                    ? { at: m.created_at, key: `m-${m.id}`, kind: "in", body: m.body }
                    : { at: m.created_at, key: `m-${m.id}`, kind: "out", body: m.body, channel: m.channel, status: m.status });
                }
                items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
                return (
                  <div className="space-y-3">
                    {items.map((it) => {
                      if (it.kind === "out") {
                        const isSms = it.channel === "sms";
                        return (
                          <div key={it.key} className="flex flex-col items-end">
                            <div className={`max-w-[85%] text-white rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${isSms ? "bg-emerald-600" : "bg-blue-600"}`}>
                              {it.body}
                            </div>
                            <span className="text-gray-600 text-[10px] mt-1 pr-1 flex items-center gap-1.5">
                              <span className={`px-1.5 py-px rounded font-semibold ${isSms ? "bg-emerald-900/50 text-emerald-300" : "bg-blue-900/50 text-blue-300"}`}>
                                {isSms ? "Text" : "Email"}
                              </span>
                              <span>{it.status === "not_configured" ? "Not sent" : it.status === "failed" ? "Failed" : "Sent"} · {formatShort(it.at)}</span>
                            </span>
                          </div>
                        );
                      }
                      if (it.kind === "in") {
                        return (
                          <div key={it.key} className="flex flex-col items-start">
                            <div className="max-w-[85%] bg-gray-800 text-gray-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                              {it.body}
                            </div>
                            <span className="text-gray-600 text-[10px] mt-1 pl-1">{formatShort(it.at)}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={it.key} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs shrink-0">{it.icon}</div>
                          <p className="text-gray-300 text-[13px]">{it.text}</p>
                          {it.source && it.source !== "direct_link" && (
                            <span className="text-[10px] text-blue-400">via {getSourceLabel(it.source)}</span>
                          )}
                          <span className="text-gray-600 text-[11px] ml-auto shrink-0">{formatShort(it.at)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
