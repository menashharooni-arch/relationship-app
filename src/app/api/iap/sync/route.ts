import { NextResponse } from "next/server";
import { isOfficePlan } from "@/lib/plan";
import { appleGrantPatch } from "@/lib/iap-entitlement";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { IAP_ENTITLEMENT } from "@/lib/iap-shared";

// ── Instant entitlement sync after an in-app purchase ───────────────────────
//
// The client calls this the moment StoreKit confirms a purchase, so Pro
// unlocks before the user's thumb leaves the button. The RevenueCat WEBHOOK
// (api/iap/revenuecat) is the durable source of truth; this is the low-latency
// mirror of it, and it re-verifies with RevenueCat's REST API rather than
// trusting the client's word — a spoofed fetch to this route grants nothing.
//
// Requires REVENUECAT_SECRET_KEY (the sk_ key, server-only). Without it this
// is a no-op and the webhook alone drives the plan — slower, still correct.

export async function POST() {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret) return NextResponse.json({ ok: true, skipped: "not_configured" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let active = false;
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ ok: true, skipped: "rc_error" });
    const d = await r.json();
    const ent = d?.subscriber?.entitlements?.[IAP_ENTITLEMENT];
    active = !!ent && (!ent.expires_date || new Date(ent.expires_date).getTime() > Date.now());
  } catch {
    return NextResponse.json({ ok: true, skipped: "rc_unreachable" });
  }

  if (!active) return NextResponse.json({ ok: true, applied: "none" });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, customization, office_id")
    .eq("id", user.id)
    .single();
  // Same rule as decideRcEvent: Apple only sells Pro, so an OFFICE plan (the
  // higher, Stripe-billed tier) is never overwritten by this grant.
  if (isOfficePlan(profile?.plan) || profile?.office_id) return NextResponse.json({ ok: true, applied: "none" });
  const customization = { ...((profile?.customization as Record<string, unknown> | null) ?? {}) };
  await admin
    .from("profiles")
    .update(appleGrantPatch(customization))
    .eq("id", user.id);
  return NextResponse.json({ ok: true, applied: "grant" });
}
