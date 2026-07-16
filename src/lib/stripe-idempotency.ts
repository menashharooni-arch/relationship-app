import { getAdminSupabase } from "@/lib/supabase-admin";
import { reportError } from "@/lib/report-error";

// ── Webhook idempotency ───────────────────────────────────────────────────────
// Stripe delivers each event at least once, so redeliveries (and Stripe's own
// retries after our 500s) can replay a handler. We record each processed event
// id in `stripe_events` (see supabase/stripe-events-dedup.sql) and skip anything
// already seen. FAILS OPEN: if the table doesn't exist yet, or the insert errors,
// we process the event — the handlers are mostly idempotent, so a missed dedup
// is safe, whereas dropping a real event is not.

// Returns true if this event was already processed (caller should skip).
//
// IMPORTANT: this marks the event processed by INSERTING before the handler
// runs. If the handler then FAILS, the caller MUST call `clearStripeEvent` so
// Stripe's retry re-processes it — otherwise the retry sees the row, treats the
// event as a duplicate, and the event is dropped forever (a paid customer never
// provisioned, or a cancellation never applied). See webhook route's catch.
export async function isDuplicateStripeEvent(eventId: string, type: string): Promise<boolean> {
  if (!eventId) return false;
  const admin = getAdminSupabase();
  try {
    const { error } = await admin.from("stripe_events").insert({ event_id: eventId, type });
    if (!error) return false; // fresh insert → first time we've seen it
    // Unique-violation (23505) → already processed → duplicate.
    if ((error as { code?: string }).code === "23505") return true;
    // Any other error (e.g. table missing) → fail open, process the event —
    // but this silently defeats dedup for every future delivery, so make it
    // visible rather than a permanently invisible gap (billing audit).
    await reportError("stripe.idempotency.insert_failed", error, { eventId, type });
    return false;
  } catch (e) {
    await reportError("stripe.idempotency.insert_threw", e, { eventId, type });
    return false;
  }
}

// Remove the dedup marker for an event whose handler failed, so Stripe's retry
// is NOT skipped as a duplicate. Best-effort: if this delete itself fails the
// worst case reverts to the prior behavior (event skipped on retry), which the
// caller's 500 + alerting already surfaces.
export async function clearStripeEvent(eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    await getAdminSupabase().from("stripe_events").delete().eq("event_id", eventId);
  } catch {
    /* best-effort */
  }
}
