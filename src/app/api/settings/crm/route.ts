import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { isPaidPlan } from "@/lib/plan";

// PATCH — save which events to forward to the connected CRM (Zapier).
export async function PATCH(req: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: prof } = await admin.from("profiles").select("plan, customization").eq("id", user.id).single();
  if (!isPaidPlan(prof?.plan)) {
    return NextResponse.json({ code: "INTEGRATION_PRO_ONLY", error: "upgrade", message: "Forwarding events to your CRM is a Pro feature.", upgrade: "/pricing" }, { status: 402 });
  }

  const { notifications, views } = (await req.json()) as { notifications?: boolean; views?: boolean };
  const customization = {
    ...((prof?.customization as Record<string, unknown>) ?? {}),
    crm: { notifications: !!notifications, views: !!views },
  };

  const { error } = await admin.from("profiles").update({ customization }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
