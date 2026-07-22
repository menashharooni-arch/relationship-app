// ── Which accounts an office's uniform branding may overwrite ────────────────
// Propagating office branding rewrites live cards, so the target set must be
// tight: ONLY members whose profile STILL points at this office. A member with
// a stale `office_members` row (they switched teams, or the office
// subscription lapsed and their profile.office_id was cleared) must NOT have
// their card rebranded — otherwise an ex-member's live card could be silently
// overwritten with a former office's branding.
//
// The OWNER is deliberately excluded (owner decision, Jul 2026): the admin's
// personal cards are individual to the admin, and uniform branding governs
// sub-users' cards only. An earlier version included the owner here, which
// rewrote the admin's own cards with the office template on every save.
//
// `ownerId`          — excluded even if they somehow appear in the member lists.
// `activeMemberIds`  — user ids from office_members where status='active'.
// `verifiedInOffice` — user ids whose profiles row still has this office_id.
// The result is the intersection (never a member who is only in one list),
// minus the owner, de-duplicated. Pure so the deny path is unit-testable.
export function resolveBrandTargetIds(
  ownerId: string,
  activeMemberIds: string[],
  verifiedInOffice: string[],
): string[] {
  const verified = new Set(verifiedInOffice);
  const targets = new Set<string>();
  for (const id of activeMemberIds) {
    if (id && id !== ownerId && verified.has(id)) targets.add(id);
  }
  return [...targets];
}
