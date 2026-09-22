// ── The one notice a card trial owes the person paying ──────────────────────
//
// A Stripe Pro/Office trial ends by CHARGING the card on file. Visa and
// Mastercard both require a heads-up before that happens, and they want it at
// different moments:
//
//   Visa        at least 7 days before the first charge, and it must state the
//               AMOUNT, not just the date.
//   Mastercard  for trials longer than 7 days: between 3 and 7 days before the
//               trial ends.
//
// The windows overlap at exactly 7 days, so ONE email sent there satisfies
// both — which is also the fewest emails, the owner's standing preference.
// Stripe's own "trial ending" email used to cover the Visa side; it was turned
// off on 2026-09-22 (it was Stripe-branded and quoted a support address we
// don't use), so this is what replaces it.
//
// Landing on "exactly 7 days" needs a run more often than once a day, which is
// why api/billing/trial-notice is called hourly by GitHub Actions (Vercel's
// Hobby plan caps crons at two per project, once a day each — see
// push-catchup.yml for the same reasoning). The daily reminders cron calls this
// too, as a backstop: if the hourly schedule stalls, the notice still goes out
// a little late rather than not at all. `_trialChargeWarnedFor` makes both
// callers idempotent, so nobody is emailed twice.
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { TRIAL_CHARGE_CENTS_KEY, TRIAL_CHARGE_INTERVAL_KEY, TRIAL_ENDS_KEY } from "./billing-state";
import { getAccountEmail } from "./account-email";
import { trialChargeSoonEmail } from "./email-templates";
import { reportError } from "./report-error";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Send when 7 days or less remain — the hourly caller means the first run that
 *  sees this is normally within an hour of the 7-day mark, satisfying Visa's
 *  "at least 7 days" and staying inside Mastercard's 3-to-7-day window. The
 *  extra hour of slack is what keeps a run that fires a few minutes late from
 *  pushing the notice a whole hour under 7 days. */
const NOTICE_WINDOW_MS = 7 * DAY_MS + HOUR_MS;

/** Below this, a late notice is worse than useless — it would land inside the
 *  window Mastercard calls too late (under 3 days) and Visa never accepted.
 *  It still goes out: an imperfect notice beats a surprise charge, and the
 *  alternative is a dispute we would lose. */
const LATE_MS = 3 * DAY_MS;

/** Is this trial due its notice right now? Pure, so the timing that Visa and
 *  Mastercard actually care about is testable without a database. */
export function trialNoticeDue(msLeft: number): boolean {
  return msLeft > 0 && msLeft <= NOTICE_WINDOW_MS;
}

export type TrialNoticeResult = { considered: number; sent: number; late: number };

export async function sendTrialChargeNotices(
  supabase: SupabaseClient,
  resend: Resend,
  nowMs: number = Date.now(),
): Promise<TrialNoticeResult> {
  const result: TrialNoticeResult = { considered: 0, sent: 0, late: 0 };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

  const { data: trials } = await supabase
    .from("profiles")
    .select("id, email, name, plan, customization")
    // Both paid plans: an Office trial converts by charging a card exactly like
    // a Pro one, and the card networks draw no distinction between them.
    .in("plan", ["pro", "enterprise"])
    .not("stripe_subscription_id", "is", null)
    .not(`customization->>${TRIAL_ENDS_KEY}`, "is", null);

  for (const u of trials ?? []) {
    const cust = (u.customization ?? {}) as Record<string, unknown>;
    const endsAt = typeof cust[TRIAL_ENDS_KEY] === "string" ? (cust[TRIAL_ENDS_KEY] as string) : null;
    if (!endsAt) continue;
    const endMs = new Date(endsAt).getTime();
    if (!Number.isFinite(endMs)) continue;
    const msLeft = endMs - nowMs;
    // Already charged (or the date is nonsense): nothing to warn about.
    if (msLeft <= 0) continue;
    if (!trialNoticeDue(msLeft)) continue;
    // Keyed to the DATE, not a boolean: a trial that gets extended is a new
    // charge date and deserves a fresh notice.
    if (cust._trialChargeWarnedFor === endsAt) continue;

    result.considered += 1;
    if (msLeft < LATE_MS) result.late += 1;

    // Claim before sending, exactly like the other reminder jobs: the hourly
    // route and the daily backstop can overlap, and a post-send stamp would let
    // both pass the check above and both email the same person.
    await supabase
      .from("profiles")
      .update({ customization: { ...cust, _trialChargeWarnedFor: endsAt } })
      .eq("id", u.id);

    const to = await getAccountEmail(u.id as string, (u.email as string) ?? null);
    if (!to) continue;

    const cents = typeof cust[TRIAL_CHARGE_CENTS_KEY] === "number" ? (cust[TRIAL_CHARGE_CENTS_KEY] as number) : null;
    const intervalWord =
      typeof cust[TRIAL_CHARGE_INTERVAL_KEY] === "string" ? (cust[TRIAL_CHARGE_INTERVAL_KEY] as string) : undefined;

    const tpl = trialChargeSoonEmail({
      firstName: (u.name as string)?.split(" ")[0] || "there",
      // "Office", never the internal "enterprise" id — the product never uses
      // that word to a customer (same rule as receipts).
      planName: u.plan === "enterprise" ? "Office" : "Pro",
      chargeDate: new Date(endMs).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      amountCents: cents,
      intervalWord,
      manageUrl: `${appUrl}/settings/flows?billing=1`,
    });

    // Billing mail: sent regardless of marketing preferences. Someone who
    // muted product updates has not agreed to be charged without notice.
    const { data: sent, error: sendError } = await resend.emails
      .send({ ...tpl, to })
      .catch((e: unknown) => ({ data: null, error: e instanceof Error ? e : new Error(String(e)) }));
    if (sendError || !sent?.id) {
      await reportError("trial-notice.email", sendError ?? "no id returned", { userId: u.id });
      continue;
    }
    result.sent += 1;
    try {
      await supabase
        .from("email_logs")
        .insert({ user_id: u.id, email: to, type: "trial_charge_soon", subject: tpl.subject, resend_id: sent.id });
    } catch { /* logging is best-effort */ }
  }

  return result;
}
