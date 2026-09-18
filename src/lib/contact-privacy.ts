import { markPlace } from "@/lib/location-privacy";

// ── A known contact's name is a Pro feature ─────────────────────────────────
//
// "Priya re-opened your card" is what Pro sells (docs/plans/warm-lead-alerts.md,
// decision: Pro names, Free teaser). Exactly the rule that already holds for a
// place name (lib/location-privacy.ts): the name is wrapped in an invisible
// mark when the row is WRITTEN, and the plan decides what each surface gets
// when it is READ — so a Free account that upgrades sees every name it was
// already told about, and a Free account never receives one in the first
// place.
//
//   bell (app)   the name is replaced with blocks on the server, and marked as
//                a place so NotificationBody blurs it like a hidden location.
//   lock screen  a push cannot blur, so the name becomes "a contact": the
//                sentence still reads ("A contact re-opened your card").
//   paid         the marks come out and the name stays.

/** U+2064 INVISIBLE PLUS — wraps a known contact's name. */
export const NAME_MARK = "⁤";

const MARKED = new RegExp(`${NAME_MARK}([^${NAME_MARK}]*)${NAME_MARK}`, "g");
const REDACT_CHAR = "█";

export function markName(name: string): string {
  return `${NAME_MARK}${name}${NAME_MARK}`;
}

export function hasMarkedName(text: string): boolean {
  return text.includes(NAME_MARK);
}

/** Paid surfaces, CRMs and plain text: the name, unmarked. */
export function stripNameMarks(text: string): string {
  return text.split(NAME_MARK).join("");
}

/** Free, in the app: blocks the app will blur. The name never leaves the server. */
export function redactNames(text: string): string {
  return text.replace(MARKED, (_, name: string) =>
    markPlace(REDACT_CHAR.repeat(Math.min(Math.max(name.trim().length, 3), 10))),
  );
}

/** Free, on a lock screen: "a contact", capitalised at the start of a sentence. */
export function genericNames(text: string): string {
  return text.replace(MARKED, (_m, _name: string, offset: number, whole: string) => {
    const before = whole.slice(0, offset).trimEnd();
    return before === "" || /[.!?]$/.test(before) ? "A contact" : "a contact";
  });
}
