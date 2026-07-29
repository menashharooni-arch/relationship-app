import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { encryptToken } from "@/lib/token-crypto";
import { fetchPipedriveDomain } from "@/lib/sync-pipedrive";

// Pipedrive connects with a personal API token the user pastes, generated in
// their own account (Settings → Personal preferences → API). Same shape as the
// HubSpot Private App flow — no OAuth app, so nothing here waits on Pipedrive's
// marketplace review.
//
// The lookup below does double duty: it proves the token works before we store
// it, AND it returns the account's own API host, which v2 calls must use
// (https://{company}.pipedrive.com, not a shared host). Discovering it here
// keeps the user's job to pasting ONE value instead of hunting for their domain.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Pro/Office feature, same as the other CRM integrations.
  const { data: planRow } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(planRow?.plan)) {
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "Pipedrive is a Pro feature.", upgrade: "/pricing" }, { status: 402 });
  }

  const { token } = await request.json() as { token?: string };
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "no_token", message: "Paste your Pipedrive API token." }, { status: 400 });
  }

  const apiDomain = await fetchPipedriveDomain(trimmed);
  if (!apiDomain) {
    // Most likely causes, in order: the token was mistyped, it was regenerated
    // (Pipedrive allows only ONE active token per user), or an admin turned off
    // API access for that permission set.
    return NextResponse.json(
      { error: "invalid_token", message: "Pipedrive didn't accept that token. Check it was copied in full, and that your admin hasn't switched off API access." },
      { status: 400 },
    );
  }

  const { error } = await admin.from("integrations").upsert({
    user_id: user.id,
    provider: "pipedrive",
    access_token: encryptToken(trimmed),
    refresh_token: null,
    // Personal API tokens don't expire — null keeps the refresh branch dormant.
    expires_at: null,
    metadata: { api_domain: apiDomain },
    updated_at: new Date().toISOString(),
    sync_error: null, // upsert only touches listed columns — clear explicitly on reconnect
  }, { onConflict: "user_id,provider" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await getAdminSupabase()
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "pipedrive");

  return NextResponse.json({ ok: true });
}
