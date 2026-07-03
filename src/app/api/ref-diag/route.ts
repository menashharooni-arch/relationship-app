import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { getReferralProgress } from "@/lib/referral-server";

// TEMPORARY: verifies the new referral-progress queries (incl. the PostgREST
// not-in filter used by claims) against the live DB. Removed after use.
const TOKEN = "rF7kQ2mX9vB4nT6wJ8cZ3yH5sL1aPdGe";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const admin = getAdminSupabase();
  const out: Record<string, unknown> = {};

  // 1. The exact candidates query claimReferralReward runs (not-in filter).
  const { data: menash } = await admin.from("profiles").select("id").eq("username", "menash").maybeSingle();
  const cand = await admin
    .from("referrals")
    .select("id")
    .eq("referrer_id", menash?.id ?? "00000000-0000-0000-0000-000000000000")
    .eq("reward_granted", false)
    .not("status", "in", "(flagged,self_referral)")
    .order("created_at", { ascending: true })
    .limit(3);
  out.claim_candidates_query = cand.error ? { ok: false, error: cand.error.message } : { ok: true, rows: cand.data?.length ?? 0 };

  // 2. Full progress computation via the real function.
  const progress = menash?.id ? await getReferralProgress(menash.id) : null;
  out.progress = progress ? { ok: true, ...progress } : { ok: false };

  // 3. The rewarded_at update shape (dry: filter matches nothing).
  const upd = await admin
    .from("referrals")
    .update({ reward_granted: false, rewarded_at: null })
    .eq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  out.claim_update_shape = upd.error ? { ok: false, error: upd.error.message } : { ok: true };

  const failures = Object.entries(out).filter(([, v]) => (v as { ok?: boolean }).ok === false).map(([k]) => k);
  return NextResponse.json({ allOk: failures.length === 0, failures, out });
}
