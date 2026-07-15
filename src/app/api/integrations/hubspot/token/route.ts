import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { encryptToken } from "@/lib/token-crypto";

// HubSpot's self-serve OAuth ("public app") creation is currently disabled on
// their end, so this integration connects via a Private App access token
// instead — the user pastes a token they generate in their own HubSpot
// account (Settings → Integrations → Private Apps), same shape as the
// existing Zapier webhook-URL flow. Private App tokens don't expire, so
// sync-hubspot.ts's refresh logic is simply never triggered for these rows.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // HubSpot is a Pro/Office feature, same as the other CRM integrations.
  const { data: planRow } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(planRow?.plan)) {
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "HubSpot is a Pro feature.", upgrade: "/pricing" }, { status: 402 });
  }

  const { token } = await request.json() as { token?: string };
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "no_token", message: "Paste your HubSpot access token." }, { status: 400 });
  }

  // Confirm the token is real before storing it — a lightweight, read-only
  // call that needs no scopes beyond "the token is valid for some portal".
  const check = await fetch("https://api.hubapi.com/account-info/v3/details", {
    headers: { Authorization: `Bearer ${trimmed}` },
  }).catch(() => null);
  if (!check || !check.ok) {
    return NextResponse.json(
      { error: "invalid_token", message: "That token wasn't accepted by HubSpot — check it and try again." },
      { status: 400 },
    );
  }

  const { error } = await admin.from("integrations").upsert({
    user_id: user.id,
    provider: "hubspot",
    access_token: encryptToken(trimmed),
    refresh_token: null,
    expires_at: null,
    updated_at: new Date().toISOString(),
    sync_error: null, // upsert only touches listed columns — must clear explicitly on reconnect
  }, { onConflict: "user_id,provider" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
