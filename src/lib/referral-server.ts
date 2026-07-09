import { getAdminSupabase } from "./supabase-admin";
import { getStripe } from "./stripe";
import { isPaidPlan, TRIAL_DAYS } from "./plan";
import { REFERRAL, freeMonthDays, sourceGrantsFreeMonth, isSignupSource } from "./referral";
import { insertNotification } from "./notify";
import { sendPushToUser } from "./push";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O/1/I/L)

function randomCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// Normalize an email for self-referral detection: lowercase, strip +tags, and
// collapse Gmail dots — so name+1@gmail.com / n.a.m.e@gmail.com can't bypass it.
function normEmail(e: string | null | undefined): string {
  const raw = (e || "").toLowerCase().trim();
  const [local, domain] = raw.split("@");
  if (!domain) return raw;
  let l = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") l = l.replace(/\./g, "");
  return `${l}@${domain}`;
}

// A coarse device fingerprint from headers (user-agent + language). Weak on its
// own, but combined with IP it's a useful "same person referring themselves"
// signal. Stored at signup and compared to the referrer's device.
export function hashDevice(ua: string | null, lang: string | null): string | null {
  const s = `${ua || ""}|${lang || ""}`.trim();
  if (!s) return null;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
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

// Reverse trial: every NEW signup starts on full Pro for TRIAL_DAYS days, then
// the daily cron downgrades them to Free. Idempotent (one trial per account,
// ever), and never touches a real paying subscriber. Tagged in customization so
// the dashboard banner and the lifecycle emails can say "trial".
export async function startProTrial(userId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data: p } = await admin
    .from("profiles")
    .select("plan_expires_at, stripe_subscription_id, customization")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return;
  if (p.stripe_subscription_id) return;         // already a real paying subscriber
  const cust = (p.customization ?? {}) as Record<string, unknown>;
  if (cust._trialStarted) return;               // never re-trial an account
  if (p.plan_expires_at) return;                // already on a timed grant
  const expires = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  await admin
    .from("profiles")
    .update({ plan: "pro", plan_expires_at: expires, customization: { ...cust, _trial: true, _trialStarted: true } })
    .eq("id", userId);
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
  opts: { code: string | null; source: string | null; ip: string | null; email: string | null; device?: string | null },
): Promise<void> {
  const admin = getAdminSupabase();
  const code = (opts.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
  let source = isSignupSource(opts.source) ? opts.source : (code ? "referral" : "direct");

  // Resolve referrer from code.
  type Referrer = { id: string; email: string | null; signup_ip: string | null; signup_device: string | null };
  let referrer: Referrer | null = null;
  if (code) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, signup_ip, signup_device")
      .eq("referral_code", code)
      .maybeSingle();
    if (data) referrer = data as Referrer;
  }

  // Fraud / self-referral checks.
  let status = "signed_up";
  let flaggedReason: string | null = null;
  if (referrer) {
    const sameAccount = referrer.id === userId;
    const sameEmail = !!opts.email && !!referrer.email && normEmail(opts.email) === normEmail(referrer.email);
    if (sameAccount || sameEmail) {
      status = "self_referral";
      flaggedReason = "self_referral";
    } else if (opts.ip && referrer.signup_ip && opts.ip === referrer.signup_ip) {
      status = "flagged";
      flaggedReason = "same_ip_as_referrer";
    } else if (opts.device && referrer.signup_device && opts.device === referrer.signup_device) {
      status = "flagged";
      flaggedReason = "same_device_as_referrer";
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

  // Attribution update — kept SEPARATE from referral-code assignment so a (rare)
  // code collision can never abort it and silently drop referred_by/source/ip.
  const grantsFreeMonth = sourceGrantsFreeMonth(source) || !!referrer;
  const { error: attrErr } = await admin
    .from("profiles")
    .update({
      referred_by: referrer?.id ?? null,
      signup_source: source,
      signup_ip: opts.ip,
      signup_device: opts.device ?? null,
    })
    .eq("id", userId);
  if (attrErr) console.error("[referral] attribution update failed:", attrErr);

  // Generate the new user's own referral code (retries on collision).
  await ensureReferralCode(userId);

  if (grantsFreeMonth) {
    // Stack the referral/promo month ON TOP of the reverse trial (extend from the
    // later of now / current expiry) so a referred signup gets trial + month.
    await grantAppFreeMonths(userId, REFERRAL.NEW_USER_FREE_MONTHS, true);
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
        signup_device: opts.device ?? null,
        flagged_reason: flaggedReason,
      },
      { onConflict: "referred_id" },
    );

    // Successful (non-fraud) signup → tell the referrer where they stand
    // (1/3, 2/3, or the claimable 3/3). Best-effort: never blocks signup.
    if (referrer && status === "signed_up") {
      try {
        await notifyReferrerOfSignup(referrer.id);
      } catch (e) {
        console.error("[referral] progress notification failed:", e);
      }
    }
  }
}

// ── Signup-count referral rewards ────────────────────────────────────────────
// Every REFERRAL.SIGNUPS_PER_REWARD (3) successful signups through a user's
// link unlock ONE claimable free month of Pro, up to MAX_REFERRAL_REWARDS (3)
// months total (= 9 signups). The user must explicitly TAP to claim — from the
// notification or the Refer-a-friend box in Settings; nothing is auto-granted.
//
// Claims are tracked on the EXISTING referrals columns (no schema change):
// claiming marks 3 valid rows reward_granted=true + rewarded_at, so
//   months claimed  = floor(#reward_granted rows / 3)
//   months unlocked = floor(min(#valid rows, 9) / 3)
//   claimable now   = unlocked − claimed
// Flagged / self-referral signups never count.

const INVALID_REF_STATUSES = ["flagged", "self_referral"];

export type ReferralProgress = {
  code: string | null;
  validSignups: number;    // successful (non-fraud) signups, uncapped
  progressInBatch: number; // 0..2 — signups toward the NEXT free month
  claimable: number;       // free months ready to claim right now
  monthsClaimed: number;   // free months already claimed (0..3)
  capReached: boolean;     // all 3 months claimed
};

async function computeProgress(userId: string): Promise<Omit<ReferralProgress, "code">> {
  const admin = getAdminSupabase();
  const { data: rows } = await admin
    .from("referrals")
    .select("id, status, reward_granted")
    .eq("referrer_id", userId);

  const per = REFERRAL.SIGNUPS_PER_REWARD;
  const cap = REFERRAL.MAX_REFERRAL_REWARDS;
  const valid = (rows ?? []).filter((r) => !INVALID_REF_STATUSES.includes(r.status as string));
  const claimedRows = valid.filter((r) => r.reward_granted).length;

  const monthsClaimed = Math.min(cap, Math.floor(claimedRows / per));
  const counted = Math.min(valid.length, cap * per); // signups beyond the cap don't count
  const unlocked = Math.min(cap, Math.floor(counted / per));
  const claimable = Math.max(0, unlocked - monthsClaimed);
  const capReached = monthsClaimed >= cap;
  const progressInBatch = capReached ? 0 : counted - unlocked * per;

  return { validSignups: valid.length, progressInBatch, claimable, monthsClaimed, capReached };
}

// For Settings / dashboard. Resilient: returns null pre-migration so UI never breaks.
export async function getReferralProgress(userId: string): Promise<ReferralProgress | null> {
  try {
    const code = await ensureReferralCode(userId);
    const p = await computeProgress(userId);
    return { code, ...p };
  } catch {
    return null;
  }
}

// The explicit "tap to get it" action. Consumes 3 unclaimed valid signups and
// grants one month — Stripe balance credit for active paying subscribers,
// app-level Pro month (extending any current grant) for everyone else.
export async function claimReferralReward(
  userId: string,
): Promise<{ ok: true; monthsClaimed: number; claimable: number } | { ok: false; error: string }> {
  const admin = getAdminSupabase();
  const per = REFERRAL.SIGNUPS_PER_REWARD;

  const before = await computeProgress(userId);
  if (before.claimable <= 0) {
    return {
      ok: false,
      error: before.capReached
        ? `You've already claimed all ${REFERRAL.MAX_REFERRAL_REWARDS} referral months — thanks for spreading the word!`
        : `No free month ready yet — ${per - before.progressInBatch} more signup${per - before.progressInBatch === 1 ? "" : "s"} to go.`,
    };
  }

  // Consume the OLDEST unclaimed valid signups for this claim.
  const { data: candidates } = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_id", userId)
    .eq("reward_granted", false)
    .not("status", "in", `(${INVALID_REF_STATUSES.join(",")})`)
    .order("created_at", { ascending: true })
    .limit(per);
  const ids = (candidates ?? []).map((c) => c.id as string);
  if (ids.length < per) return { ok: false, error: "No free month ready to claim yet." };

  const nowIso = new Date().toISOString();
  const { data: updated } = await admin
    .from("referrals")
    .update({ reward_granted: true, rewarded_at: nowIso })
    .in("id", ids)
    .eq("reward_granted", false)
    .select("id");

  if ((updated ?? []).length < per) {
    // A concurrent claim raced us — release whatever we took and bail cleanly.
    if (updated?.length) {
      await admin.from("referrals").update({ reward_granted: false, rewarded_at: null }).in("id", updated.map((u) => u.id));
    }
    return { ok: false, error: "That claim was already processed — refresh to see your updated plan." };
  }

  await grantReferrerReward(userId, REFERRAL.REFERRER_FREE_MONTHS);
  await admin.from("profiles").update({ referral_reward_earned: true }).eq("id", userId); // legacy "earned ≥1" flag

  const after = await computeProgress(userId);
  return { ok: true, monthsClaimed: after.monthsClaimed, claimable: after.claimable };
}

// After each successful referred signup: tell the referrer where they stand.
// 1/3 and 2/3 are progress notes; 3/3 is the claimable "tap here to get it".
async function notifyReferrerOfSignup(referrerId: string): Promise<void> {
  const per = REFERRAL.SIGNUPS_PER_REWARD;
  const cap = REFERRAL.MAX_REFERRAL_REWARDS;
  const p = await computeProgress(referrerId);

  let type = "referral_progress";
  let title: string;
  let body: string;

  if (p.validSignups > cap * per) {
    // Past the lifetime cap — appreciative, no reward implied.
    title = "Another friend joined through your link! 🙌";
    body = `You've already earned the maximum ${cap} referral months — thanks for spreading the word.`;
  } else if (p.progressInBatch === 0 && p.claimable > 0) {
    // This signup completed a batch of 3 → a month is ready to claim.
    type = "referral_claim";
    title = "3 of 3 referrals complete! 🎉";
    body = "Congratulations — you've got Pro free for one month. Tap here to get it.";
  } else {
    const left = per - p.progressInBatch;
    title = `${p.progressInBatch} of ${per} referrals complete`;
    body = `${left === 2 ? "Two more" : "One more"} to unlock Pro free for one month.`;
  }

  await insertNotification({ user_id: referrerId, type, title, body });
  await sendPushToUser(referrerId, {
    title,
    body,
    url: `${APP_URL}/settings/flows#refer`,
    tag: `referral-${p.validSignups}`,
  }).catch(() => {});
}

// Called from the Stripe webhook when a referred user becomes a PAYING customer.
// Rewards are NOT granted here anymore (they're signup-count based and claimed
// by the user) — this records the conversion for analytics and runs the
// same-payment-method fraud check (a flagged signup stops counting).
export async function markReferralConversion(referredUserId: string): Promise<void> {
  const admin = getAdminSupabase();
  const { data: ref } = await admin
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (!ref || !ref.referrer_id) return;
  if (INVALID_REF_STATUSES.includes(ref.status as string)) return;

  const nowIso = new Date().toISOString();

  // Payment-method self-referral: the friend pays with the SAME card as the
  // referrer → same person on two accounts. Flag it (removes it from counting).
  const { data: friendPm } = await admin.from("profiles").select("payment_fingerprint").eq("id", referredUserId).maybeSingle();
  const { data: referrerPm } = await admin.from("profiles").select("payment_fingerprint").eq("id", ref.referrer_id).maybeSingle();
  if (friendPm?.payment_fingerprint && referrerPm?.payment_fingerprint && friendPm.payment_fingerprint === referrerPm.payment_fingerprint) {
    await admin.from("referrals").update({ status: "flagged", flagged_reason: "same_payment_method", paid_at: nowIso }).eq("id", ref.id);
    return;
  }

  if (ref.status === "signed_up") {
    await admin.from("referrals").update({ status: "paid", paid_at: nowIso }).eq("id", ref.id);
  }
}

export type DowngradedUser = { id: string; email: string | null; name: string | null; wasTrial: boolean };

// Daily cron: downgrade users whose trial / free-month grant has ended (unless
// they converted to a paid Stripe subscription). Returns the users who were
// actually downgraded (app-grant users only) so the caller can email them.
// NOTE: only NEW capture / creation pauses on Free — existing cards, contacts,
// and sequences are never deleted (see the card/lead routes and the sequence
// send-time check).
export async function expireFreeMonths(): Promise<DowngradedUser[]> {
  const admin = getAdminSupabase();
  const { data: expired } = await admin
    .from("profiles")
    .select("id, email, name, stripe_subscription_id, customization")
    .not("plan_expires_at", "is", null)
    .lte("plan_expires_at", new Date().toISOString());

  const downgraded: DowngradedUser[] = [];
  for (const u of expired ?? []) {
    if (u.stripe_subscription_id) {
      // A real subscriber whose grant window lapsed — just clear the expiry so
      // the row is never mistaken for an app grant. Never downgrade them.
      await admin.from("profiles").update({ plan_expires_at: null }).eq("id", u.id);
      continue;
    }
    const cust = (u.customization ?? {}) as Record<string, unknown>;
    const wasTrial = cust._trial === true;
    const nextCust = { ...cust };
    delete nextCust._trial;
    delete nextCust._proWarnedFor;
    if (wasTrial) nextCust._trialEnded = true;
    await admin
      .from("profiles")
      .update({ plan: "free", plan_expires_at: null, customization: nextCust })
      .eq("id", u.id);
    downgraded.push({ id: u.id as string, email: (u.email as string) ?? null, name: (u.name as string) ?? null, wasTrial });
  }
  return downgraded;
}
