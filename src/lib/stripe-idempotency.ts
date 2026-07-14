import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Webhook idempotency ───────────────────────────────────────────────────────
// Stripe delivers each event at least once, so redeliveries (and Stripe's own
// retries after our 500s) can replay a handler. We record each processed event
// id in `stripe_events` (see supabase/stripe-events-dedup.sql) and skip anything
// already seen. FAILS OPEN: if the table doesn't exist yet, or the insert errors,
// we process the event — the handlers are mostly idempotent, so a missed dedup
// is safe, whereas dropping a real event is not.

// Returns true if this event was already processed (caller should skip).
export async function isDuplicateStripeEvent(eventId: string, type: string): Promise<boolean> {
  if (!eventId) return false;
  const admin = getAdminSupabase();
  try {
    const { error } = await admin.from("stripe_events").insert({ event_id: eventId, type });
    if (!error) return false; // fresh insert → first time we've seen it
    // Unique-violation (23505) → already processed → duplicate.
    if ((error as { code?: string }).code === "23505") return true;
    // Any other error (e.g. table missing) → fail open, process the event.
    return false;
  } catch {
    return false;
  }
}
