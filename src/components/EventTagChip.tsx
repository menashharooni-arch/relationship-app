"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_LABEL_MAX } from "@/lib/event-tag";

// ── "At an event?" — one thin line under the Share button ────────────────────
//
// Where the owner is when they are showing their QR code, so naming the event
// takes one tap. Every contact captured through the card until the tag ends is
// saved as met there (lib/event-tag.ts), which is what a returning-contact
// alert says back to them later.
//
// ONE LINE in every state (owner, 2026-09-19: "very thin … it cannot take up
// too much space"), and the same height in each, so the Share box never jumps:
//   idle    · "At an event? Tag today's contacts"
//   typing  · [input] [Save] [×]
//   on      · "Met at RE/MAX Summit" + "Stop"
//
// A WAY OUT of typing, because this sits under a button people reach for and
// some will open it by accident (owner, same day): the × cancels, Escape
// cancels, and clicking away from an empty box cancels. Nothing is saved until
// Save is pressed, so backing out leaves the account exactly as it was.
export default function EventTagChip({ initial }: { initial: { label: string; until: string } | null }) {
  const [active, setActive] = useState<{ label: string; until: string } | null>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The tag ends at midnight. On a dashboard left open past it, drop the line
  // by itself rather than keep claiming today's contacts are being stamped —
  // the server has already stopped stamping them (activeEvent is time-based).
  useEffect(() => {
    if (!active) return;
    const ms = Date.parse(active.until) - Date.now();
    if (!Number.isFinite(ms)) return;
    // Always through the timer, never a synchronous setState in the effect:
    // an already-past `until` clears on the next tick instead of cascading a
    // render (and setTimeout caps out at ~24.8 days).
    const t = setTimeout(() => setActive(null), Math.min(Math.max(ms, 0), 2_147_483_000));
    return () => clearTimeout(t);
  }, [active]);

  const cancel = () => { setEditing(false); setDraft(""); setError(null); };

  const save = async (label: string | null) => {
    setSaving(true);
    setError(null);
    // Local midnight: the server holds it to (now, now + 24h] whatever a
    // wrong device clock sends (lib/event-tag.ts eventUntil).
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    try {
      const res = await fetch("/api/profile/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, until: midnight.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't save");
      setActive(data.event ?? null);
      setEditing(false);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
    setSaving(false);
  };

  // ── On ─────────────────────────────────────────────────────────────────────
  if (active) {
    return (
      <div className="flex items-center gap-2 pt-2 min-w-0">
        <PinIcon />
        {/* truncate + min-w-0: a 40-character event name shortens instead of
            wrapping this line onto a second one. */}
        <p className="min-w-0 flex-1 truncate text-[0.6875rem] text-gray-400">
          Met at <span className="font-semibold text-gray-200">{active.label}</span>
        </p>
        <button
          type="button"
          onClick={() => save(null)}
          disabled={saving}
          className="shrink-0 text-[0.6875rem] font-semibold text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          {saving ? "…" : "Stop"}
        </button>
      </div>
    );
  }

  // ── Typing ─────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="pt-2">
        {/* A real form with method="post" and no GET fallback, and the route
            takes a plain form post too (api/profile/event) — so a tap landing
            before React hydrates saves and comes back here rather than
            dead-ending on a JSON error page. */}
        <form
          method="post"
          action="/api/profile/event"
          onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void save(draft); }}
          className="flex items-center gap-1.5"
        >
          <label htmlFor="event-tag-input" className="sr-only">Where are you meeting people today?</label>
          <input
            id="event-tag-input"
            ref={inputRef}
            name="label"
            autoFocus
            autoComplete="off"
            maxLength={EVENT_LABEL_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Escape is the way out on a keyboard; the × is the way out on a
            // phone. Blur closes an EMPTY box, so a mis-tap that types nothing
            // disappears on its own — but a half-typed name is never thrown
            // away by tapping slightly off the field.
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
            onBlur={() => { if (!draft.trim() && !saving) cancel(); }}
            placeholder="Where are you meeting people?"
            // text-base on phones: anything smaller makes iOS zoom the page in
            // on focus, and it never zooms back out.
            className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5 text-base sm:text-[0.75rem] text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="shrink-0 text-[0.6875rem] font-semibold px-2.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Cancel"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </form>
        {error && <p role="alert" className="mt-1 text-[0.6875rem] text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center justify-center gap-1.5 text-[0.6875rem] font-semibold text-gray-500 hover:text-gray-200 transition-colors"
      >
        <PinIcon />
        At an event? Tag today&apos;s contacts
      </button>
      {error && <p role="alert" className="mt-1 text-center text-[0.6875rem] text-red-400">{error}</p>}
    </div>
  );
}

/** The same map pin the contact's "Where you met" uses — one glance says place. */
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 shrink-0 text-gray-500" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
