import { getAdminSupabase } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plan";
import { getOfficeSeatUsage } from "@/lib/office-seats";
import { writeAudit } from "@/lib/audit";
import type Stripe from "stripe";

// ── Pure guard: what seat target is actually applicable right now ─────────────
// A scheduled reduction can never drop below what's in use at apply-time (the
// team may have grown after it was scheduled). Also honors the 2-seat minimum.
export function applicableTarget(scheduled: number, inUse: number): number {
  return Math.max(scheduled, inUse, PLAN_LIMITS.OFFICE_MIN_SEATS);
}

// Apply every scheduled seat reduction whose effective date has passed. Called
// by the daily cron (/api/reminders). Best-effort per office; a Stripe failure
// leaves that office's schedule in place to retry next run. Returns the count
// applied. The Stripe quantity change fires customer.subscription.updated, whose
// existing handler syncs offices.seats + trims any overflow members.
export async function applyDueSeatReductions(): Promise<number> {
  const admin = getAdminSupabase();
  const nowIso = new Date().toISOString();

  const { data: offices } = await admin
    .from("offices")
    .select("id, owner_id, scheduled_seats, scheduled_seats_at")
    .not("scheduled_seats", "is", null)
    .lte("scheduled_seats_at", nowIso);

  let applied = 0;
  for (const o of offices ?? []) {
    const scheduled = o.scheduled_seats as number;
    const usage = await getOfficeSeatUsage(o.id as string, scheduled);
    const inUse = usage.ownerSeats + usage.active + usage.pending;
    const target = applicableTarget(scheduled, inUse);

    const { data: prof } = await admin
      .from("profiles")
      .select("stripe_subscription_id, plan")
      .eq("id", o.owner_id)
      .maybeSingle();

    // Only touch Stripe for a live Office subscription; otherwise just clear the
    // stale schedule (the office was cancelled/downgraded meanwhile).
    if (prof?.plan === "enterprise" && prof.stripe_subscription_id) {
      try {
        const sub = (await getStripe().subscriptions.retrieve(prof.stripe_subscription_id as string)) as Stripe.Subscription;
        const item = sub.items.data[0];
        if (item && (item.quantity ?? 0) !== target) {
          await getStripe().subscriptions.update(prof.stripe_subscription_id as string, {
            items: [{ id: item.id, quantity: target }],
            // At the period boundary — the lower price applies to the new cycle,
            // no confusing mid-cycle proration credit.
            proration_behavior: "none",
          });
        }
      } catch {
        continue; // leave the schedule for the next run
      }
    }

    await admin
      .from("offices")
      .update({ seats: target, scheduled_seats: null, scheduled_seats_at: null })
      .eq("id", o.id as string);
    await writeAudit({ action: "seat.changed", orgId: o.id as string, metadata: { seats: target, mode: "scheduled_applied" } });
    applied++;
  }
  return applied;
}
