import { createHash } from "node:crypto";
import { getAdminSupabase } from "./supabase-admin";
import { normEmail } from "./referral-server";

// ── One Pro trial per PERSON, not per account ────────────────────────────────
//
// trial-eligibility.ts used to ask Stripe one question: has this CUSTOMER ever
// subscribed? A new email is a new customer, so a second account — or the same
// email after the 30-day account purge — got a second 14-day trial with the
// same card. This ledger remembers who has had one, keyed by one-way hashes so
// it holds no readable personal data, and lib/account-purge.ts never touches it
// (supabase/pro-trial-safeguards.sql).
//
//   card            the Stripe card fingerprint a trial started on
//   email_trial     the normalised account email a trial started on
//   email_retention the email that took the delete-flow free days
//
// FAILS OPEN on a missing table or a read error: the ledger narrows who gets a
// free trial, and an outage in it must never stop someone paying or signing up.

export type LedgerKind = "card" | "email_trial" | "email_retention";

export function ledgerKey(kind: LedgerKind, raw: string): string {
  const value = kind === "card" ? raw.trim() : normEmail(raw);
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

/** Has this card / email already been used for `kind`? Unknown → false. */
export async function ledgerHas(kind: LedgerKind, raw: string | null | undefined): Promise<boolean> {
  if (!raw || !raw.trim()) return false;
  try {
    const { data, error } = await getAdminSupabase()
      .from("trial_ledger")
      .select("kind")
      .eq("kind", kind)
      .eq("key_hash", ledgerKey(kind, raw))
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

/**
 * The history isProTrialEligible needs, read tolerantly: a separate select so
 * a database without supabase/pro-trial-safeguards.sql (no column) can never
 * break the caller's own profile query — it just reads as "no trial recorded".
 */
export async function trialHistoryFor(
  userId: string,
  accountEmail: string | null | undefined,
): Promise<{ proTrialStartedAt: string | null; accountEmail: string | null }> {
  let proTrialStartedAt: string | null = null;
  try {
    const { data, error } = await getAdminSupabase()
      .from("profiles")
      .select("pro_trial_started_at")
      .eq("id", userId)
      .maybeSingle();
    if (!error) proTrialStartedAt = (data as { pro_trial_started_at?: string | null } | null)?.pro_trial_started_at ?? null;
  } catch { /* pre-migration */ }
  return { proTrialStartedAt, accountEmail: accountEmail ?? null };
}

/**
 * A Pro trial just started on this account (Stripe trialing checkout, or an
 * Apple intro offer). Stamps profiles.pro_trial_started_at — which nothing ever
 * clears — and the email ledger, so neither this account nor this email is
 * offered another. Best-effort and idempotent; never throws.
 */
export async function recordProTrialStarted(userId: string, accountEmail: string | null | undefined): Promise<void> {
  await ledgerAdd("email_trial", accountEmail);
  try {
    await getAdminSupabase()
      .from("profiles")
      .update({ pro_trial_started_at: new Date().toISOString() })
      .eq("id", userId)
      .is("pro_trial_started_at", null);
  } catch { /* pre-migration: the column does not exist yet */ }
}

/**
 * Record that this card / email has used `kind`. Returns true when THIS call
 * wrote the row (first use), false when it was already there or the write
 * could not be made. Idempotent: a replayed webhook simply gets false.
 */
export async function ledgerAdd(kind: LedgerKind, raw: string | null | undefined): Promise<boolean> {
  if (!raw || !raw.trim()) return false;
  try {
    const { data, error } = await getAdminSupabase()
      .from("trial_ledger")
      .upsert({ kind, key_hash: ledgerKey(kind, raw) }, { onConflict: "kind,key_hash", ignoreDuplicates: true })
      .select("kind");
    if (error) return false;
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}
