import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { encryptToken } from "@/lib/token-crypto";
import { sanitizeCardScope } from "@/lib/crm-scope";
import { scopeIsOwned } from "@/lib/crm-scope-server";

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
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "HubSpot is a Pro feature.", upgrade: "/upgrade" }, { status: 402 });
  }

  const { token, card_ids } = await request.json() as { token?: string; card_ids?: unknown };
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


  // Pre-connect card scope. Sent by the settings form alongside the token;
  // absent means the caller made no choice (reconnect or older client), and
  // the row's existing scope must be left alone. An explicit empty list would
  // be a connection that silently sends nothing — reject like the scope API.
  let scopeUpdate: { card_ids?: string[] | null } = {};
  if (card_ids !== undefined) {
    const scope = card_ids === null ? null : sanitizeCardScope(card_ids);
    if (scope !== null && scope.length === 0) {
      return NextResponse.json({ error: "empty_scope", message: "Pick at least one card, or choose All cards." }, { status: 400 });
    }
    if (!(await scopeIsOwned(admin, user.id, scope))) {
      return NextResponse.json({ error: "unknown_card", message: "One of those cards isn't yours." }, { status: 400 });
    }
    scopeUpdate = { card_ids: scope };
  }

  const { error } = await admin.from("integrations").upsert({
    user_id: user.id,
    provider: "hubspot",
    access_token: encryptToken(trimmed),
    refresh_token: null,
    expires_at: null,
    updated_at: new Date().toISOString(),
    ...scopeUpdate,
    sync_error: null, // upsert only touches listed columns — must clear explicitly on reconnect
  }, { onConflict: "user_id,provider" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
