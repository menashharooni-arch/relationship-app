// ── "At an event?" ───────────────────────────────────────────────────────────
//
// The owner names the event they are at ("RE/MAX Summit") and every contact
// captured through their card until it ends is stamped with it as
// leads.where_met. That is what lets a returning-contact alert say "Priya
// (met at RE/MAX Summit) re-opened your card" instead of just a name, without
// asking the visitor a single extra question (warm-lead plan, decision on
// "met at": automatic context + owner edit).
//
// Stored in profiles.customization._event = { label, until }. Always
// temporary: it ends at the local midnight the app sent, and never lasts more
// than a day, so a forgotten tag cannot stamp next week's contacts.

export const EVENT_KEY = "_event";
export const EVENT_LABEL_MAX = 40;
export const EVENT_MAX_MS = 24 * 60 * 60 * 1000;

export type EventTag = { label: string; until: string };

// Control characters and the invisible marks the notification system uses
// (lib/location-privacy.ts, lib/contact-privacy.ts) never belong in a label.
const UNWANTED = new RegExp("[\\u0000-\\u001f\\u007f\\u2060-\\u206f]", "g");

/** A clean, bounded label, or null. */
export function cleanEventLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.replace(UNWANTED, "").replace(/\s+/g, " ").trim();
  return label ? label.slice(0, EVENT_LABEL_MAX).trim() : null;
}

/** The end time to store: the app's local midnight, held to (now, now + 24h]. */
export function eventUntil(requested: unknown, now = Date.now()): string {
  const asked = typeof requested === "string" ? Date.parse(requested) : NaN;
  const until = Number.isFinite(asked) && asked > now ? Math.min(asked, now + EVENT_MAX_MS) : now + 12 * 60 * 60 * 1000;
  return new Date(until).toISOString();
}

/** The tag in force right now, if any. */
export function activeEvent(customization: unknown, now = Date.now()): EventTag | null {
  const ev = (customization as Record<string, unknown> | null | undefined)?.[EVENT_KEY] as
    | { label?: unknown; until?: unknown }
    | undefined;
  const label = cleanEventLabel(ev?.label);
  const until = typeof ev?.until === "string" ? Date.parse(ev.until) : NaN;
  if (!label || !Number.isFinite(until) || until <= now) return null;
  return { label, until: new Date(until).toISOString() };
}
