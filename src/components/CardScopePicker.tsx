"use client";

import { useState } from "react";

// "Which of my cards feed this destination?"
//
// Integrations are per-ACCOUNT, so without this every card sends to the same
// CRM — connect an employer's GoHighLevel and your personal card's contacts
// land in it too. This is the control that stops that.
//
// Deliberately quiet: it renders as one line of text until you touch it, and it
// does not render AT ALL for a single-card account (see the caller), because
// then there is nothing to choose and it would just be another thing to read on
// a settings page most people scroll past.

export type ScopeCard = { id: string; username: string; name?: string | null; label?: string | null };

/** null = all cards. */
export type Scope = string[] | null;

/**
 * The all-cards / only-these choice as a controlled block.
 *
 * `mode: "unset"` is the load-bearing state: the pre-connect step must not
 * default to "all cards" (owner order 2026-08-27 — connecting is not allowed
 * until the user has actively chosen), so both radios start unchecked and the
 * caller keeps its Connect/Save button disabled until `scopeChoiceReady`.
 */
export type ScopeChoice = { mode: "unset" | "all" | "some"; ids: string[] };

export function scopeChoiceReady(v: ScopeChoice): boolean {
  return v.mode === "all" || (v.mode === "some" && v.ids.length > 0);
}

/** The wire value for a ready choice: null = all cards, list = only these. */
export function scopeChoiceValue(v: ScopeChoice): string[] | null {
  return v.mode === "all" ? null : v.ids;
}

export function ScopeChooser({
  group,
  targetName,
  cards,
  value,
  onChange,
}: {
  /** Unique radio-group name (two open choosers must not steal each other's dots). */
  group: string;
  targetName: string;
  cards: ScopeCard[];
  value: ScopeChoice;
  onChange: (next: ScopeChoice) => void;
}) {
  const toggle = (id: string) =>
    onChange({
      mode: "some",
      ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id],
    });

  return (
    <div className="space-y-2">
      <p className="text-slate-500 text-xs">Which cards send contacts to {targetName}?</p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={group}
          checked={value.mode === "all"}
          onChange={() => onChange({ mode: "all", ids: value.ids })}
          className="accent-[#1D4ED8]"
        />
        <span className="text-slate-900 text-sm">All cards</span>
        <span className="text-slate-400 text-[11px]">including any you add later</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={group}
          checked={value.mode === "some"}
          onChange={() => onChange({ mode: "some", ids: value.ids })}
          className="accent-[#1D4ED8]"
        />
        <span className="text-slate-900 text-sm">Only these cards</span>
      </label>

      {value.mode === "some" && (
        <div className="pl-6 space-y-1.5">
          {cards.map((c) => (
            // items-start + wrapping text, NOT truncate — see the git history of
            // this file: truncate clipped indistinguishable names at 390px.
            <label key={c.id} className="flex items-start gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={value.ids.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-[#1D4ED8] mt-1 shrink-0"
              />
              <span className="text-slate-900 text-sm min-w-0 break-words">
                {cardTitle(c)}{" "}
                <span className="text-slate-400 text-[11px]">/{c.username}</span>
              </span>
            </label>
          ))}
          <p className="text-slate-400 text-[11px] leading-snug pt-1">
            A card you create later won&apos;t send here until you add it.
          </p>
        </div>
      )}
    </div>
  );
}

function cardTitle(c: ScopeCard): string {
  return (c.label || c.name || c.username || "").trim() || c.username;
}

export default function CardScopePicker({
  target,
  targetName,
  cards,
  initialScope,
}: {
  /** "google" | "hubspot" | "pipedrive" | "highlevel" | "zapier" */
  target: string;
  /** Human name, used in the confirmation copy. */
  targetName: string;
  cards: ScopeCard[];
  initialScope: Scope;
}) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [open, setOpen] = useState(false);
  // Draft state so Cancel really cancels — editing writes here, not to `scope`,
  // and only a successful save promotes it.
  const [draftAll, setDraftAll] = useState(initialScope === null);
  const [draftIds, setDraftIds] = useState<string[]>(initialScope ?? []);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  // A scope can name a card that was since deleted. Count only what still
  // exists, so the summary never claims "3 cards" while showing two.
  const liveIds = new Set(cards.map((c) => c.id));
  const selectedLive = (scope ?? []).filter((id) => liveIds.has(id));

  const summary =
    scope === null
      ? "All cards"
      : selectedLive.length === 0
        ? "No cards" // only reachable if every scoped card was deleted
        : selectedLive.length === cards.length
          ? "All cards"
          : cards.length > 0 && selectedLive.length <= 2
            ? cards.filter((c) => selectedLive.includes(c.id)).map(cardTitle).join(", ")
            : `${selectedLive.length} of ${cards.length} cards`;

  function beginEdit() {
    setDraftAll(scope === null);
    setDraftIds(scope ?? []);
    setError(null);
    setOpen(true);
  }

  async function save() {
    setError(null);
    const next: Scope = draftAll ? null : draftIds;
    // Mirrors the server rule. Catching it here means the user gets told what to
    // do instead of a 400 they didn't cause.
    if (next !== null && next.length === 0) {
      setError("Pick at least one card, or choose All cards.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/settings/crm-scope", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, card_ids: next }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setError(json.message || "Couldn't save that. Try again.");
        setStatus("idle");
        return;
      }
      setScope(next);
      setOpen(false);
    } catch {
      setError("Couldn't save that. Try again.");
    }
    setStatus("idle");
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#D4C8B8]/60">
      {!open ? (
        <div className="flex items-center gap-2">
          <p className="text-slate-500 text-xs flex-1 min-w-0">
            Sending from <span className="text-slate-900 font-medium">{summary}</span>
          </p>
          <button
            onClick={beginEdit}
            className="text-xs text-[#1D4ED8] hover:text-[#1740C4] font-semibold transition-colors shrink-0"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <ScopeChooser
            group={`scope-${target}`}
            targetName={targetName}
            cards={cards}
            value={{ mode: draftAll ? "all" : "some", ids: draftIds }}
            onChange={(v) => { setDraftAll(v.mode === "all"); setDraftIds(v.ids); }}
          />

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex items-center gap-3 pt-0.5">
            <button
              onClick={save}
              disabled={status === "saving"}
              className="bg-[#1D4ED8] hover:bg-[#1740C4] disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-full text-xs transition-colors"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              className="text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
