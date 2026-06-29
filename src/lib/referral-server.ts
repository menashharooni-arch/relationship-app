import { getAdminSupabase } from "./supabase-admin";
import { getStripe } from "./stripe";
import { isPaidPlan } from "./plan";
import { REFERRAL, freeMonthDays, sourceGrantsFreeMonth, isSignupSource } from "./referral";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O/1/I/L)

function randomCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// Ensure a user has a referral code; generate a unique one if missing.
export async function ensureReferralCode(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data: p } = await admin.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
  if (p?.referral_code) return p.referral_code as string;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { error } = await admin.from("profiles").update({ referral_code: code }).eq("id", userId);
    if (!error) return code;
    // 23505 = unique violation → try another code
    if ((error as { code?: string }).code !== "23505") break;
  }
  return null;
}

// App-level "free month": Pro now, downgraded back to free after the expiry
// (unless they convert to a paid Stripe subscription before then).
async function grantAppFreeMonths(userId: string, months: number, extend: boolean): Promise<void> {
  const admin = getAdminSupabase();
  let baseMs = Date.now();
  if (extend) {
    const { data: p } = await admin.from("profiles").select("plan_expires_at").eq("id", userId).maybeSingle();
    const cur = p?.plan_expires_at ? new Date(p.plan_expires_at as string).getTime() : 0;
    if (cur > baseMs) baseMs = cur;
  }
  const expires = new Date(baseMs + freeMonthDays(months) * 86400000).toISOString();
  await admin.from("profiles").update({ plan: "pro", plan_expires_at: expires }).eq("id", userId);
}

// Reward a referrer with free months. If they're already a paying subscriber we
// credit their Stripe balance (auto-applies to the next invoice); otherwise we
// give them an app-level free month.
async function grantReferrerReward(userId: string, months: number): Promise<void> {
  const admin = getAdminSupabase();
  const { data: p } = await admin
    .from("profiles")
    .select("plan, stripe_customer_id, stripe_subscription_id, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return;

  const payingNow = isPaidPlan(p.plan) && !!p.stripe_subscription_id && !p.plan_expires_at;
  if (payingNow && p.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(p.stripe_subscription_id as string);
      const price = sub.items.data[0]?.price;
      const amount = (price?.unit_amount ?? 0) * months;
      if (amount > 0) {
        await stripe.customers.createBalanceTransaction(p.stripe_customer_id as string, {
          amount: -amount,
          currency: price?.currency ?? "usd",
          description: `SwiftCard referral reward — ${months} month${months > 1 ? "s" : ""} of Pro free`,
        });
        return;
      }
    } catch (e) {
      console.error("[referral] Stripe credit failed, falling back to app grant:", e);
    }
  }
  await grantAppFreeMonths(userId, months, true);
}

// Called ONCE when a new user's profile is first created (onboarding), for both
// email and Google signups. Attributes the source, links the referrer, grants
// the new user's free month, runs basic fraud checks, and records a referrals row.
export async function applyReferralOnSignup(
  userId: string,
  opts: { code: string | null; source: string | null; ip: string | null; email: string | null },
): Promise<void> {
  const admin = getAdminSupabase();
  const code = (opts.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
  let source = isSignupSource(opts.source) ? opts.source : (code ? "referral" : "direct");

  // Resolve referrer from code.
  type Referrer = { id: string; email: string | null; signup_ip: string | null };
  let referrer: Referrer | null = null;
  if (code) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, signup_ip")
      .eq("referral_code", code)
      .maybeSingle();
    if (data) referrer = data as Referrer;
  }

  // Fraud / self-referral checks.
  let status = "signed_up";
  let flaggedReason: string | null = null;
  if (referrer) {
    const sameAccount = referrer.id === userId;
    const sameEmail = !!opts.email && !!referrer.email && opts.email.toLowerCase() === referrer.email.toLowerCase();
    if (sameAccount || sameEmail) {
      status = "self_referral";
      flaggedReason = "self_referral";
    } else if (opts.ip && referrer.signup_ip && opts.ip === referrer.signup_ip) {
      status = "flagged";
      flaggedReason = "same_ip_as_referrer";
    } else if (opts.ip) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("signup_ip", opts.ip);
      if ((count ?? 0) >= 3) {
        status = "flagged";
        flaggedReason = "ip_signup_volume";
      }
    }
    if (status === "self_referral") {
      referrer = null; // a self-referral has no valid referrer for analytics linkage
      source = "direct";
    }
  }

  // Update the new user's profile: attribution + their own referral code + the
  // free month (every promo source, and any genuine referral, grants it).
  const ownCode = randomCode();
  const grantsFreeMonth = sourceGrantsFreeMonth(source) || !!referrer;
  await admin
    .from("profiles")
    .update({
      referred_by: referrer?.id ?? null,
      signup_source: source,
      signup_ip: opts.ip,
      ...(ownCode ? { referral_code: ownCode } : {}),
    })
    .eq("id", userId);
  // referral_code may collide (rare) — ensure one exists regardless.
  await ensureReferralCode(userId);

  if (grantsFreeMonth) {
    await grantAppFreeMonths(userId, REFERRAL.NEW_USER_FREE_MONTHS, false);
  }

  // Record the referral relationship (only when there's a real or attempted referrer).
  if (referrer || flaggedReason) {
    await admin.from("referrals").upsert(
      {
        referrer_id: referrer?.id ?? null,
        referred_id: userId,
        code,
        status,
        signup_ip: opts.ip,
        flagged_reason: flaggedReason,
      },
      { onConflict: "referred_id" },
    );
  }
}

// Called from the Stripe webhook when `referredUserId` becomes a PAYING customer.
// Grants the referrer their ONE-TIME reward. Never called from the browser.
export async function rewardReferrerIfEligible(referredUserId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data: ref } = await admin
    .from("referrals")
    .select("id, referrer_id, status, reward_granted")
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (!ref || !ref.referrer_id) return;
  if (ref.status === "self_referral" || ref.status === "flagged") return; // never reward fraud
  if (ref.reward_granted) return;

  // Mark the friend as converted to paid.
  if (ref.status !== "paid" && ref.status !== "rewarded") {
    await admin.from("referrals").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", ref.id);
  }

  // One reward per referrer, ever.
  const { data: referrer } = await admin
    .from("profiles")
    .select("referral_reward_earned")
    .eq("id", ref.referrer_id)
    .maybeSingle();
  if (REFERRAL.REFERRER_REWARD_ONCE && referrer?.referral_reward_earned) {
    // Friend still counts as paid; the referrer just doesn't earn again.
    return;
  }

  // Grant it (idempotent: mark earned first so concurrent webhooks don't double-grant).
  const { data: claimed } = await admin
    .from("profiles")
    .update({ referral_reward_earned: true })
    .eq("id", ref.referrer_id)
    .eq("referral_reward_earned", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return; // someone else already claimed it for this referrer

  await grantReferrerReward(ref.referrer_id, REFERRAL.REFERRER_FREE_MONTHS);
  await admin
    .from("referrals")
    .update({ reward_granted: true, status: "rewarded", rewarded_at: new Date().toISOString() })
    .eq("id", ref.id);
}

// For the dashboard / settings referral area. Resilient: returns null if the
// migration hasn't been run yet, so the UI never breaks.
export async function getReferralStatus(userId: string): Promise<{ code: string | null; rewardEarned: boolean } | null> {
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from("profiles")
      .select("referral_code, referral_reward_earned")
      .eq("id", userId)
      .maybeSingle();
    let code = (data?.referral_code as string | null) ?? null;
    if (!code) code = await ensureReferralCode(userId);
    return { code, rewardEarned: !!data?.referral_reward_earned };
  } catch {
    return null;
  }
}

// Daily cron: downgrade users whose free month has ended (unless they converted
// to a paid Stripe subscription). Returns how many were processed.
export async function expireFreeMonths(): Promise<number> {
  const admin = getAdminSupabase();
  const { data: expired } = await admin
    .from("profiles")
    .select("id, stripe_subscription_id")
    .not("plan_expires_at", "is", null)
    .lte("plan_expires_at", new Date().toISOString());

  for (const u of expired ?? []) {
    if (u.stripe_subscription_id) {
      await admin.from("profiles").update({ plan_expires_at: null }).eq("id", u.id);
    } else {
      await admin.from("profiles").update({ plan: "free", plan_expires_at: null }).eq("id", u.id);
    }
  }
  return (expired ?? []).length;
}
