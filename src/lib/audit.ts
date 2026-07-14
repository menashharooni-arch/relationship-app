import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Append-only audit log ─────────────────────────────────────────────────────
// Records billing, seat, invitation, member, role, and company-card changes
// (spec §11/§12). Best-effort and FAILS OPEN: a missing table or insert error is
// swallowed so audit logging can never block or break the action it records.
// Requires supabase/office-lifecycle-audit.sql to be run; until then this no-ops.

export type AuditAction =
  | "invite.created" | "invite.resent" | "invite.revoked" | "invite.declined" | "invite.expired"
  | "invite.accepted"
  | "member.removed" | "member.added"
  | "role.changed"
  | "seat.changed" | "seat.reduction_scheduled" | "seat.reduction_canceled"
  | "plan.changed" | "plan.canceled" | "plan.reactivated"
  | "brand.updated";

export async function writeAudit(entry: {
  action: AuditAction;
  actorId?: string | null;
  orgId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getAdminSupabase().from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      org_id: entry.orgId ?? null,
      target_id: entry.targetId ?? null,
      action: entry.action,
      metadata: entry.metadata ?? {},
    });
  } catch {
    /* table missing / transient error — auditing must never break the action */
  }
}
