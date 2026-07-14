import { getAdminSupabase } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plan";

// ── Office seat accounting — ONE source of truth ─────────────────────────────
// A purchased Office seat count is the ORG's total card seats INCLUDING the
// owner (spec §2): a 5-seat plan = the owner + up to 4 employee cards/invites.
//   used      = 1 (owner) + active members + pending invitations
//   available = purchased − used   (never negative)
// Pending invitations RESERVE a seat; revoking/declining/expiring a pending
// invite releases it (its row is gone or no longer "pending"). Enforced on the
// server (invite + accept), never only in the UI.

export type SeatUsage = {
  purchased: number;
  ownerSeats: number;   // always 1
  active: number;       // active member cards (excludes the owner)
  pending: number;      // pending invitations reserving a seat
  used: number;         // ownerSeats + active + pending
  available: number;    // max(0, purchased − used)
};

// Pure core so the math is unit-testable without a DB.
export function computeSeatUsage(purchased: number, active: number, pending: number): SeatUsage {
  const seats = Math.max(PLAN_LIMITS.OFFICE_MIN_SEATS, Math.floor(purchased) || PLAN_LIMITS.OFFICE_MIN_SEATS);
  const a = Math.max(0, Math.floor(active));
  const p = Math.max(0, Math.floor(pending));
  const used = 1 + a + p; // owner always consumes one seat
  return {
    purchased: seats,
    ownerSeats: 1,
    active: a,
    pending: p,
    used,
    available: Math.max(0, seats - used),
  };
}

// DB-reading wrapper: counts active + pending office_members for an office.
export async function getOfficeSeatUsage(officeId: string, purchasedSeats: number): Promise<SeatUsage> {
  const admin = getAdminSupabase();
  const [{ count: active }, { count: pending }] = await Promise.all([
    admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "active"),
    admin.from("office_members").select("*", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pending"),
  ]);
  return computeSeatUsage(purchasedSeats, active ?? 0, pending ?? 0);
}
