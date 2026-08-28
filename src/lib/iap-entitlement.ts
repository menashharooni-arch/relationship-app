// ── Apple-subscription entitlement rules, as pure functions ─────────────────
//
// Two billing sources can now grant the same `plan` column: Stripe (web) and
// Apple via RevenueCat (iOS shell). The row remembers which source granted the
// current plan in customization._planSource ("stripe" | "apple"), and these
// rules exist so the two sources can never clobber each other:
//
//   • A source may always GRANT (upgrade wins, and records itself as source).
//   • A source may only REVOKE what it granted. Apple expiring must not take
//     Pro away from a Stripe subscriber; a Stripe cancellation must not take
//     Pro away from an Apple subscriber.
//
// Kept free of I/O so tests/iap-entitlement.test.ts can pin every case.

import { isOfficePlan } from "@/lib/plan";

export type PlanSource = "stripe" | "apple";

/** RevenueCat webhook event types that mean "the pro entitlement is active". */
const RC_GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
]);

/** Event types that mean "access has actually ended". CANCELLATION is
 *  deliberately absent: it fires when auto-renew is switched off while the
 *  paid period is still running — access continues until EXPIRATION. */
const RC_REVOKE_EVENTS = new Set(["EXPIRATION"]);

export type RcDecision =
  | { action: "grant" }
  | { action: "revoke" }
  | { action: "ignore" };

/**
 * What a RevenueCat webhook event should do to the profile.
 *
 * Revoke only applies when Apple is the source of the current plan and no
 * Stripe subscription is on the row — if the customer also pays by Stripe,
 * their plan is Stripe's to manage and the Apple expiry must not touch it.
 */
export function decideRcEvent(opts: {
  eventType: string;
  currentPlan: string | null;
  planSource: PlanSource | null | undefined;
  hasStripeSubscription: boolean;
  /** Seat member of an Office — their plan is the org's, never Apple's. */
  isOfficeMember?: boolean;
}): RcDecision {
  const type = opts.eventType.toUpperCase();
  // Apple only sells Pro. An account on OFFICE (a higher, Stripe-billed tier —
  // Apple has no per-seat subscriptions) must not be overwritten to "pro" by a
  // grant: someone who bought Pro in the app and later upgraded to Office on
  // the web would otherwise be silently downgraded by their Apple sub's next
  // RENEWAL event. "Upgrade wins" means office stays.
  // NB the DB spells Office "enterprise" (lib/subscription DB_PLAN) — the
  // original `=== "office"` compared against the UI label and matched nothing.
  if (RC_GRANT_EVENTS.has(type)) {
    return isOfficePlan(opts.currentPlan) || opts.isOfficeMember ? { action: "ignore" } : { action: "grant" };
  }
  if (!RC_REVOKE_EVENTS.has(type)) return { action: "ignore" };
  if (opts.planSource !== "apple") return { action: "ignore" };
  if (opts.hasStripeSubscription) return { action: "ignore" };
  if (opts.currentPlan === "free" || opts.currentPlan === null) return { action: "ignore" };
  return { action: "revoke" };
}

/**
 * Whether a Stripe-driven downgrade (subscription deleted) may proceed.
 * False when Apple currently backs the plan — the customer is still paying,
 * just not through Stripe.
 */
export function stripeDowngradeAllowed(planSource: PlanSource | null | undefined): boolean {
  return planSource !== "apple";
}

/**
 * The profile patch for an Apple grant. Besides plan + source it clears any
 * app-level timed grant (plan_expires_at, _trial) — otherwise the daily
 * expireFreeMonths sweep saw "expiry passed, no Stripe sub" and downgraded a
 * paying Apple subscriber to Free.
 */
export function appleGrantPatch(customization: Record<string, unknown>): {
  plan: "pro";
  plan_expires_at: null;
  customization: Record<string, unknown>;
} {
  const next: Record<string, unknown> = { ...customization, _planSource: "apple" };
  delete next._trial;
  delete next._proWarnedFor;
  return { plan: "pro", plan_expires_at: null, customization: next };
}

/** True when this row's Pro is paid through Apple (used by every timed-grant path). */
export function isApplePaid(customization: unknown): boolean {
  return (customization as { _planSource?: string } | null)?._planSource === "apple";
}
