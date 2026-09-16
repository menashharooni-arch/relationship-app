// ── What a person's Pro status IS, in words — one place ─────────────────────
//
// Pure (no I/O, no React) so the webhook, the billing API, BillingManager, the
// dashboard banner and the "Pro ended" panel all describe the same state the
// same way. Two surfaces disagreeing about when a trial ends, or whether a
// charge is coming, is how people get billed by surprise.

const DAY_MS = 86_400_000;

/** customization key: ISO time a Stripe trial converts to paid. Mirrored by the
 *  Stripe webhook so the dashboard never has to call Stripe to know it. */
export const TRIAL_ENDS_KEY = "_trialEndsAt";

/** customization key: Pro ended and the person has not yet chosen between
 *  subscribing and continuing on Free. Cleared by api/account/choose-plan and
 *  by any paid plan being provisioned. */
export const PRO_ENDED_PENDING_KEY = "_proEndedChoicePending";

/** customization key: at least one invoice on this account was actually PAID
 *  (amount > 0). Separates "a trial whose first charge failed" from "a paying
 *  customer whose renewal failed" — only the second gets the 7-day grace. */
export const EVER_PAID_KEY = "_everPaid";

export function daysUntil(iso: string | null | undefined, nowMs: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - nowMs) / DAY_MS));
}

export function formatBillingDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** A Stripe subscription's trial end as ISO, only while it is actually trialing. */
export function stripeTrialEndIso(sub: { status?: string | null; trial_end?: number | null }): string | null {
  if (sub.status !== "trialing" || !sub.trial_end) return null;
  return new Date(sub.trial_end * 1000).toISOString();
}

/** Did any of these invoices actually take money? A $0.00 trial-start invoice
 *  is "paid" in Stripe's terms and must not count. */
export function anyInvoiceActuallyPaid(invoices: { amount_paid?: number | null }[]): boolean {
  return invoices.some((i) => (i.amount_paid ?? 0) > 0);
}

/**
 * The trial status line. `native` drops the price (App Store 3.1.1 — the iOS
 * shell never quotes a price outside StoreKit's own sheet).
 */
export function trialStatusLine(opts: {
  trialEndsAt: string;
  amountCents?: number | null;
  native: boolean;
  nowMs?: number;
}): string {
  const days = daysUntil(opts.trialEndsAt, opts.nowMs);
  const left = days === 1 ? "1 day left" : `${days} days left`;
  const date = formatBillingDate(opts.trialEndsAt);
  if (opts.native || !opts.amountCents) return `Pro trial · ${left} · ends ${date}`;
  return `Pro trial · ${left} · first charge $${(opts.amountCents / 100).toFixed(2)} on ${date}`;
}

/** Notification copy when Pro ends and the account is now on Free. */
export function proEndedNotice(wasTrial: boolean): { title: string; body: string } {
  return {
    title: wasTrial ? "Your Pro trial has ended" : "Your Pro plan has ended",
    body: "Subscribe to keep all your cards and your Pro design, or continue on Free. Nothing has been deleted.",
  };
}

/** Accounts created on or after this moment must pass the plan step once
 *  (dashboard → /welcome until a plan is recorded). Earlier accounts were never
 *  asked and are left exactly as they are. */
export const PLAN_STEP_REQUIRED_SINCE = "2026-09-17T00:00:00Z";
