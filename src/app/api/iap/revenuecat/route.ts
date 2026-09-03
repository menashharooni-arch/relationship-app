import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { decideRcEvent, type PlanSource, appleGrantPatch, sandboxEventAllowed } from "@/lib/iap-entitlement";

// ── RevenueCat webhook: the durable path from an App Store purchase to the
//    profiles.plan column ─────────────────────────────────────────────────────
//
// RevenueCat calls this for every subscription lifecycle event on the iOS
// shell's Pro subscription (App Review 3.1.1 remedy — see lib/iap.ts). The
// app_user_id is the Supabase user id, set at SDK configure time, so mapping
// an event to a profile is a primary-key lookup, not an email guess.
//
// Auth: RevenueCat sends the literal value configured in its dashboard as the
// Authorization header. We require `Bearer ${REVENUECAT_WEBHOOK_TOKEN}`.
// No token configured → endpoint refuses everything (fail closed, like every
// other IAP surface).
//
// Idempotent by construction: grants and revokes are absolute row states, not
// increments, so RevenueCat's retries and out-of-order deliveries converge.
// Source-guarding lives in lib/iap-entitlement.ts — Apple events can never
// downgrade a Stripe-paying customer.

export async function POST(req: NextRequest) {
  const expected = process.env.REVENUECAT_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const want = Buffer.from(`Bearer ${expected}`);
  const got = Buffer.from(auth);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const event = body?.event as
    | { type?: string; app_user_id?: string; original_app_user_id?: string; environment?: string }
    | undefined;
  if (!event?.type) return NextResponse.json({ error: "no_event" }, { status: 400 });

  // Anonymous RC ids ($RCAnonymousID:...) can appear on events that predate
  // identification; there is no profile to map them to. Acknowledge so RC
  // stops retrying — the post-login RENEWAL/transfer events carry the real id.
  const uid = [event.app_user_id, event.original_app_user_id].find(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("$RCAnonymousID:"),
  );
  if (!uid) return NextResponse.json({ ok: true, skipped: "anonymous" });
  // Only Supabase uids are ever set as app_user_id; anything else can't map
  // to a profile, and a 500 here would make RC retry it forever.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
    return NextResponse.json({ ok: true, skipped: "not_a_uid" });
  }

  const admin = getAdminSupabase();

  // Sandbox events (a $0 purchase by a sandbox Apple ID — how App Review tests,
  // and how anyone with a sandbox tester account could farm free Pro) only
  // count for the designated review/test accounts. The auth lookup runs on the
  // rare sandbox path only.
  if (event.environment?.toUpperCase() === "SANDBOX") {
    const { data: authUser } = await admin.auth.admin.getUserById(uid);
    if (!sandboxEventAllowed(authUser?.user?.email)) {
      return NextResponse.json({ ok: true, skipped: "sandbox_not_allowed" });
    }
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, plan, customization, stripe_subscription_id, office_id")
    .eq("id", uid)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  if (!profile) return NextResponse.json({ ok: true, skipped: "no_profile" });

  const customization = { ...((profile.customization as Record<string, unknown> | null) ?? {}) };
  const decision = decideRcEvent({
    eventType: event.type,
    currentPlan: (profile.plan as string | null) ?? null,
    planSource: customization._planSource as PlanSource | undefined,
    hasStripeSubscription: !!profile.stripe_subscription_id,
    isOfficeMember: !!profile.office_id,
  });

  if (decision.action === "grant") {
    await admin
      .from("profiles")
      .update(appleGrantPatch(customization))
      .eq("id", profile.id);
    return NextResponse.json({ ok: true, applied: "grant" });
  }

  if (decision.action === "revoke") {
    delete customization._planSource;
    await admin
      .from("profiles")
      .update({ plan: "free", customization })
      .eq("id", profile.id);
    return NextResponse.json({ ok: true, applied: "revoke" });
  }

  return NextResponse.json({ ok: true, applied: "ignore" });
}
