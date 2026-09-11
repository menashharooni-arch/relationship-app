// ── What actually happened to a lead ─────────────────────────────────────────
//
// The office Leads tab used to show a CRM status — New / Contacted / Closed /
// Not interested. The owner asked what it connected to (2026-09-11), and the
// honest answer was: nothing.
//
//   • Two of the four could not be produced ANYWHERE in the product. "Closed"
//     and "Not interested" existed in the filter dropdown and in no writer —
//     no screen, no button, no API call a person could reach.
//   • "Contacted" could only be set by the Mark contacted button on that table,
//     and it appeared on exactly one screen: that table. The teammate who owns
//     the contact — the person who would actually do the contacting — never saw
//     it in their own Contacts panel.
//   • So an admin marked a lead handled, and nothing anywhere changed.
//
// It was a vocabulary from an older design, left behind when follow-ups became
// the thing the product does. This is the replacement, and the rule is that it
// is DERIVED, never set: the state of a lead is whatever its follow-up sequence
// is doing, which is the same thing the owning teammate already sees on the
// contact (ContactsClient's FlowBadge). Nothing to mark, nothing to keep in
// sync, nothing that can drift out of date again.

export type FollowUpState = "none" | "running" | "paused" | "done";

export type FollowUpStep = { sent_at?: string | null; channel?: string | null };

export const FOLLOW_UP_COPY: Record<FollowUpState, { label: string; hint: string }> = {
  none: { label: "No follow-up", hint: "Nobody has set one up yet" },
  running: { label: "Following up", hint: "Messages are scheduled and sending" },
  paused: { label: "Paused", hint: "Set up, but switched off — nothing will send" },
  done: { label: "All sent", hint: "Every message in the sequence has gone out" },
};

/** Every state, in the order the filter should offer them. */
export const FOLLOW_UP_STATES: FollowUpState[] = ["none", "running", "paused", "done"];

/**
 * A lead's follow-up state, from the row itself.
 *
 * `paused` is the owner's own switch on the contact (the email/text automation
 * toggles write these tags), so a sequence that exists but is switched off does
 * not read as "following up" to an admin looking at the table.
 */
export function followUpState(
  sequence: FollowUpStep[] | null | undefined,
  tags: string[] | null | undefined,
): FollowUpState {
  const steps = Array.isArray(sequence) ? sequence : [];
  if (steps.length === 0) return "none";
  if (steps.every((s) => !!s.sent_at)) return "done";

  const t = tags ?? [];
  // flow-paused stops everything; the per-channel switches only count as a
  // pause when every channel that still has unsent steps is off.
  if (t.includes("flow-paused")) return "paused";
  const pendingChannels = new Set(
    steps.filter((s) => !s.sent_at).map((s) => (s.channel === "sms" ? "sms" : "email")),
  );
  const allPaused = [...pendingChannels].every((c) =>
    c === "sms" ? t.includes("sms-paused") : t.includes("email-paused"),
  );
  return allPaused && pendingChannels.size > 0 ? "paused" : "running";
}
