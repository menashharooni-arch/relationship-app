import type { TeamPerson, TeamInvite } from "@/lib/office-team";
import type { SeatUsage } from "@/lib/office-seats";

// ── "Needs attention" — real, actionable items only ─────────────────────────
// Every item here is derived from a fact already on the page; nothing is
// invented, and a quiet office renders NOTHING rather than a reassuring-but-
// empty panel. Pure so the rules are unit-testable without a database.
//
// Ordering is by what costs the owner money soonest: an empty paid seat and an
// uncontacted lead are burning cash right now; an idle teammate is a nudge.

export type AttentionKind =
  | "invite_expired"
  | "card_incomplete"
  | "member_idle"
  | "empty_seat"
  | "lead_uncontacted";

export type AttentionItem = {
  kind: AttentionKind;
  // Plain English, already interpolated. No enums, no ids, no slugs.
  title: string;
  detail: string;
  actionLabel: string;
  // Where the action goes. `null` = the UI supplies an in-page handler.
  href: string | null;
  // Identifies the subject for in-page handlers (member row id / person id).
  targetId?: string;
  severity: "high" | "normal";
};

const firstName = (n: string) => n.split(/\s+/)[0] || n;

export function computeAttention(input: {
  people: TeamPerson[];
  invites: TeamInvite[];
  seats: SeatUsage;
  uncontactedLeads: number;
  canManageSeats: boolean;
  canInvite: boolean;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  // A lead nobody has followed up on is the most expensive thing on this list.
  if (input.uncontactedLeads > 0) {
    items.push({
      kind: "lead_uncontacted",
      title: input.uncontactedLeads === 1 ? "1 new lead is waiting" : `${input.uncontactedLeads} new leads are waiting`,
      detail: "Nobody on your team has followed up with them yet.",
      actionLabel: "See leads",
      href: "/office/admin/leads",
      severity: "high",
    });
  }

  // Paid-for and empty. Only surfaced to someone who can actually act on it.
  if (input.seats.available > 0 && (input.canInvite || input.canManageSeats)) {
    const n = input.seats.available;
    items.push({
      kind: "empty_seat",
      title: n === 1 ? "You're paying for 1 unused seat" : `You're paying for ${n} unused seats`,
      detail: "Invite someone to use it, or remove it to lower your bill.",
      actionLabel: input.canInvite ? "Add team member" : "Manage seats",
      href: input.canInvite ? null : "/settings/flows?billing=1#billing",
      severity: "normal",
    });
  }

  for (const inv of input.invites) {
    if (inv.status !== "invite_expired") continue;
    items.push({
      kind: "invite_expired",
      title: `${inv.email}'s invitation expired`,
      detail: "They never got their card set up. Send it again and it's valid for another 14 days.",
      actionLabel: "Resend invite",
      href: null,
      targetId: inv.memberRowId,
      severity: "high",
    });
  }

  for (const p of input.people) {
    if (p.isOwner) continue;
    if (p.status === "card_incomplete") {
      items.push({
        kind: "card_incomplete",
        title: `${firstName(p.name)} hasn't finished their card`,
        detail: "They joined but never created a card, so they have nothing to share.",
        actionLabel: "See details",
        href: `/office/admin/team/${p.userId}`,
        targetId: p.userId,
        severity: "high",
      });
    }
  }

  for (const p of input.people) {
    if (p.isOwner || p.status !== "idle") continue;
    items.push({
      kind: "member_idle",
      title: `${firstName(p.name)}'s card hasn't been used lately`,
      detail: "No views or leads in the last two weeks — they may need a nudge.",
      actionLabel: "See details",
      href: `/office/admin/team/${p.userId}`,
      targetId: p.userId,
      severity: "normal",
    });
  }

  // NOTE: "all seats occupied" is deliberately NOT an item here. Because an
  // office either has a spare seat (→ empty_seat) or doesn't (→ seats full),
  // including both would leave this panel permanently non-empty, which defeats
  // the rule that it appears only when there is something to DO. A fully-staffed
  // team where everyone is active needs no action. The seat count is already on
  // the header, and the moment being full actually blocks the owner — when they
  // try to add someone — the Add-member modal says so and sells the seat inline.

  return items;
}
