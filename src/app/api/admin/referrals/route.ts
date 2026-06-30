import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const admin = getAdminSupabase();
    const [{ data: profs, error: pErr }, { data: refs, error: rErr }] = await Promise.all([
      admin.from("profiles").select("signup_source, referral_reward_earned, plan_expires_at"),
      admin.from("referrals").select("status, reward_granted, flagged_reason, code, referred_id, created_at"),
    ]);
    // Supabase resolves (not throws) on a missing table/column, so the try/catch
    // alone wouldn't catch a pre-migration state — check the errors explicitly.
    if (pErr || rErr) {
      return NextResponse.json({ ready: false, message: "Run REFERRAL_SETUP.sql in Supabase to enable referral analytics." });
    }

    // Signups by source.
    const bySource: Record<string, number> = {};
    for (const p of profs ?? []) {
      const s = (p.signup_source as string) || "direct";
      bySource[s] = (bySource[s] ?? 0) + 1;
    }

    const referrals = refs ?? [];
    const totalReferrals = referrals.length;
    const paid = referrals.filter((r) => r.status === "paid" || r.status === "rewarded").length;
    const rewarded = referrals.filter((r) => r.reward_granted).length;
    const flagged = referrals.filter((r) => r.status === "flagged" || r.flagged_reason).length;
    const selfReferral = referrals.filter((r) => r.status === "self_referral").length;
    const activeFreeMonths = (profs ?? []).filter((p) => p.plan_expires_at).length;
    const conversionRate = totalReferrals ? Math.round((paid / totalReferrals) * 1000) / 10 : 0;

    const flaggedList = referrals
      .filter((r) => r.status === "flagged" || r.status === "self_referral" || r.flagged_reason)
      .slice(0, 50)
      .map((r) => ({ code: r.code, reason: r.flagged_reason || r.status, created_at: r.created_at }));

    return NextResponse.json({
      ready: true,
      bySource,
      totalReferrals,
      paid,
      rewarded,
      flagged,
      selfReferral,
      activeFreeMonths,
      conversionRate,
      flaggedList,
    });
  } catch {
    // Migration not run yet — degrade gracefully so the panel still loads.
    return NextResponse.json({ ready: false, message: "Run REFERRAL_SETUP.sql in Supabase to enable referral analytics." });
  }
}
