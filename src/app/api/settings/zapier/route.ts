import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// PATCH — save webhook URL
export async function PATCH(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { zapier_webhook_url } = await request.json() as { zapier_webhook_url?: string };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ zapier_webhook_url: zapier_webhook_url || null })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST — test webhook with sample payload
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { webhookUrl } = await request.json() as { webhookUrl?: string };
  if (!webhookUrl) return NextResponse.json({ error: "no_url" }, { status: 400 });

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
