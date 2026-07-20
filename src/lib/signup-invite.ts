import { getAdminSupabase } from "@/lib/supabase-admin";

// Short-lived httpOnly cookie set by /api/invite/verify once a code checks out;
// /onboarding re-verifies it before it will provision a brand-new account.
export const INVITE_COOKIE = "sc_invite";

// Invite-only signups. A brand-new account is provisioned at /onboarding only
// if it presents a valid code from public.signup_invites OR the email has a
// pending office-team invite. All access here is via the service-role client.

export function normalizeInviteCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function isValidSignupInvite(code: string): Promise<boolean> {
  const c = normalizeInviteCode(code);
  if (!c) return false;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("signup_invites")
    .select("code, max_uses, uses, disabled")
    .eq("code", c)
    .maybeSingle();
  if (!data || data.disabled) return false;
  return (data.uses ?? 0) < (data.max_uses ?? 0);
}

// Record that this account used a code: mark the per-user row (idempotent) and
// bump the code's use count. Read-then-write increment is fine for a launch
// gate (generous max_uses); the per-user upsert prevents double-counting the
// same account across onboarding retries.
export async function consumeSignupInvite(code: string, userId: string): Promise<void> {
  const c = normalizeInviteCode(code);
  if (!c) return;
  const admin = getAdminSupabase();
  const { data: already } = await admin
    .from("signup_invite_uses")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (already) return; // already counted for this user
  await admin.from("signup_invite_uses").upsert({ user_id: userId, code: c }, { onConflict: "user_id" });
  const { data } = await admin.from("signup_invites").select("uses").eq("code", c).maybeSingle();
  if (data) await admin.from("signup_invites").update({ uses: (data.uses ?? 0) + 1 }).eq("code", c);
}

// A friend arriving through a referral link (/r/CODE) may create an account
// without a signup code — the referral IS their invite. The sc_ref cookie is
// only a pass when it resolves to a real user's referral_code; attribution and
// fraud checks still run in applyReferralOnSignup after provisioning.
export async function isValidReferralPass(code: string | null | undefined): Promise<boolean> {
  const c = String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!c) return false;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", c)
    .limit(1);
  return (data ?? []).length > 0;
}

// An invited teammate (pending office_members row for their email) may create
// an account without a signup code — the invite itself is their pass.
export async function hasPendingOfficeInvite(email: string | null | undefined): Promise<boolean> {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admin = getAdminSupabase();
  // EXACT match, not ilike: invite_email is always stored lowercased on write
  // (src/app/api/office/invite/route.ts), so .eq() on the lowercased address is
  // correct — and it closes a LIKE-wildcard bypass, since `_`/`%` are valid in
  // an attacker-chosen signup email and ilike would treat them as wildcards
  // (e.g. "j_hn@x.com" matching a pending invite for "john@x.com").
  const { data } = await admin
    .from("office_members")
    .select("id")
    .eq("invite_email", e)
    .eq("status", "pending")
    .limit(1);
  return (data ?? []).length > 0;
}
