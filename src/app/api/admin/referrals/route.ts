import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin";
import { REFERRAL } from "@/lib/referral";

// Admin referral analytics for the signup-count reward model:
// 3 successful signups = 1 claimable free month (user must tap to claim), max 3.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const admin = getAdminSupabase();
    const [{ data: profs, error: pErr }, { data: refs, error: rErr }] = await Promise.all([
      admin.from("profiles").select("signup_source, plan_expires_at"),
      admin.from("referrals").select("referrer_id, status, reward_granted, flagged_reason, code, created_at"),
    ]);
    // Supabase resolves (not throws) on a missing table/column — check explicitly.
    if (pErr || rErr) {
      return NextResponse.json({ ready: false, message: "Run REFERRAL_SETUP.sql in Supabase to enable referral analytics." });
    }

    // Signups by source.
    const bySource: Record<string, number> = {};
    for (const p of profs ?? []) {
      const s = (p.signup_source as string) || "direct";
      bySource[s] = (bySource[s] ?? 0) + 1;
    }

    const per = REFERRAL.SIGNUPS_PER_REWARD;
    const cap = REFERRAL.MAX_REFERRAL_REWARDS;
    const referrals = refs ?? [];
    const isValid = (r: { status: string | null }) => r.status !== "flagged" && r.status !== "self_referral";

    const totalReferrals = referrals.length;
    const validSignups = referrals.filter(isValid).length;
    const paid = referrals.filter((r) => r.status === "paid").length;
    const flagged = referrals.filter((r) => r.status === "flagged" || r.flagged_reason).length;
    const selfReferral = referrals.filter((r) => r.status === "self_referral").length;
    const activeFreeMonths = (profs ?? []).filter((p) => p.plan_expires_at).length;

    // Per-referrer rollup → months claimed + months sitting unclaimed.
    const byReferrer: Record<string, { valid: number; claimed: number }> = {};
    for (const r of referrals) {
      if (!r.referrer_id || !isValid(r)) continue;
      const slot = (byReferrer[r.referrer_id as string] ??= { valid: 0, claimed: 0 });
      slot.valid++;
      if (r.reward_granted) slot.claimed++;
    }
    let monthsClaimed = 0;
    let monthsClaimable = 0;
    for (const u of Object.values(byReferrer)) {
      const claimed = Math.min(cap, Math.floor(u.claimed / per));
      const unlocked = Math.min(cap, Math.floor(Math.min(u.valid, cap * per) / per));
      monthsClaimed += claimed;
      monthsClaimable += Math.max(0, unlocked - claimed);
    }

    const flaggedList = referrals
      .filter((r) => !isValid(r) || r.flagged_reason)
      .slice(0, 50)
      .map((r) => ({ code: r.code, reason: r.flagged_reason || r.status, created_at: r.created_at }));

    return NextResponse.json({
      ready: true,
      bySource,
      totalReferrals,
      validSignups,
      paid,
      monthsClaimed,
      monthsClaimable,
      flagged,
      selfReferral,
      activeFreeMonths,
      flaggedList,
    });
  } catch {
    return NextResponse.json({ ready: false, message: "Run REFERRAL_SETUP.sql in Supabase to enable referral analytics." });
  }
}
