import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";
import { isZapierWebhookUrl } from "@/lib/safe-fetch";
import { sanitizeCardScope } from "@/lib/crm-scope";
import { scopeIsOwned } from "@/lib/crm-scope-server";

// PATCH — save webhook URL
export async function PATCH(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Zapier integration is a Pro/Office feature.
  const { data: planRow } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(planRow?.plan)) {
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "Zapier is a Pro feature.", upgrade: "/pricing" }, { status: 402 });
  }

  const { zapier_webhook_url, zapier_card_ids } = await request.json() as { zapier_webhook_url?: string; zapier_card_ids?: unknown };

  // Only accept a real Zapier catch-hook URL (or clearing it). This stops an
  // arbitrary internal URL from being stored and later POSTed lead PII (SSRF).
  if (zapier_webhook_url && !isZapierWebhookUrl(zapier_webhook_url)) {
    return NextResponse.json(
      { error: "invalid_url", message: "Enter a Zapier webhook URL (https://hooks.zapier.com/…)." },
      { status: 400 },
    );
  }

  // Optional pre-connect card scope, same vocabulary as the CRM rows: absent =
  // don't touch, null = all cards, list = only these. Empty would be a webhook
  // that looks connected and never fires — reject it like the scope API does.
  let scopeUpdate: { zapier_card_ids?: string[] | null } = {};
  if (zapier_card_ids !== undefined) {
    const scope = zapier_card_ids === null ? null : sanitizeCardScope(zapier_card_ids);
    if (scope !== null && scope.length === 0) {
      return NextResponse.json({ error: "empty_scope", message: "Pick at least one card, or choose All cards." }, { status: 400 });
    }
    if (!(await scopeIsOwned(admin, user.id, scope))) {
      return NextResponse.json({ error: "unknown_card", message: "One of those cards isn't yours." }, { status: 400 });
    }
    scopeUpdate = { zapier_card_ids: scope };
  }

  const { error } = await admin
    .from("profiles")
    .update({ zapier_webhook_url: zapier_webhook_url || null, ...scopeUpdate })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST — test webhook with sample payload
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Test send is Pro-only too, and the URL must be a real Zapier hook — without
  // this, res.ok/res.status leaked back is a blind internal port-scan oracle.
  const admin2 = getAdminSupabase();
  const { data: planRow2 } = await admin2.from("profiles").select("plan").eq("id", user.id).single();
  if (!isPaidPlan(planRow2?.plan)) {
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "Zapier is a Pro feature.", upgrade: "/pricing" }, { status: 402 });
  }

  const { webhookUrl } = await request.json() as { webhookUrl?: string };
  if (!webhookUrl) return NextResponse.json({ error: "no_url" }, { status: 400 });
  if (!isZapierWebhookUrl(webhookUrl)) {
    return NextResponse.json({ error: "invalid_url", message: "Enter a Zapier webhook URL (https://hooks.zapier.com/…)." }, { status: 400 });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "555-0100",
        message: "Loved meeting you at the conference!",
        location: "New York, US",
        card_owner: "your-username",
        tags: [],
        created_at: new Date().toISOString(),
        _test: true,
      }),
    });
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
