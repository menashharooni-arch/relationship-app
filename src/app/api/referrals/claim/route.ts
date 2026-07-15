import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { claimReferralReward, getReferralProgress } from "@/lib/referral-server";
import { officeSubUserBlockMessage } from "@/lib/office-roles";

const SUB_USER_MSG = "Referral rewards aren't available on team accounts managed by an organization.";

// The explicit "tap here to get it" — claims one earned referral month
// (3 successful signups = 1 claimable month, max 3 months). Tapped from the
// notification or the Refer-a-friend box in Settings; nothing auto-grants.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Office sub-users have no referral programme — enforced here, not just
  // hidden in the Settings UI.
  const blocked = await officeSubUserBlockMessage(user.id, { message: SUB_USER_MSG });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const result = await claimReferralReward(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

// Current progress — lets client surfaces refresh their state.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await officeSubUserBlockMessage(user.id, { message: SUB_USER_MSG });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  const progress = await getReferralProgress(user.id);
  if (!progress) return NextResponse.json({ error: "Referrals not available" }, { status: 503 });
  return NextResponse.json(progress);
}
