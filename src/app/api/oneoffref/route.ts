import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// TEMPORARY: check whether REFERRAL_SETUP.sql has been applied.
const TOKEN = "sc-oneoff-8r4k2w9m";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) return NextResponse.json({ error: "nope" }, { status: 404 });
  const admin = getAdminSupabase();

  const referrals = await admin.from("referrals").select("id", { count: "exact", head: true });
  const cols = await admin.from("profiles").select("referral_code, referred_by, plan_expires_at, referral_reward_earned, signup_source").limit(1);
  const codes = await admin.from("profiles").select("referral_code", { count: "exact", head: true }).not("referral_code", "is", null);

  const ready = !referrals.error && !cols.error;
  return NextResponse.json({
    ready,
    referralsTable: referrals.error ? `MISSING — ${referrals.error.message}` : `ok (${referrals.count ?? 0} referrals)`,
    profileColumns: cols.error ? `MISSING — ${cols.error.message}` : "ok",
    usersWithReferralCode: codes.error ? `n/a — ${codes.error.message}` : codes.count,
    message: ready
      ? "Referral system is ACTIVE."
      : "Not applied yet — run REFERRAL_SETUP.sql in the Supabase SQL editor.",
  });
}
