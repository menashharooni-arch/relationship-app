import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Stores one-time acceptance of the native AI-consent notice (App Store, Nov
// 2025). The flag lives on profiles.customization._aiConsentAccepted, matching
// the existing _-prefixed customization-flag convention (_deleted, _usage, …).
// Purely additive: web never shows the notice, but the flag is harmless there.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("customization")
    .eq("id", user.id)
    .single();

  const customization = (profile?.customization as Record<string, unknown> | null) ?? {};
  await admin
    .from("profiles")
    .update({ customization: { ...customization, _aiConsentAccepted: true } })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
