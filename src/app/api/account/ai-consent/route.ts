import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";

// Stores the account's decision on sending data to the AI provider.
//
// Was accept-only: a POST with no body meant "accepted", because the notice it
// backed had a single "Got it" button. App Review rejected that under
// 5.1.1(i)/5.1.2(i) — Apple asked for permission, which requires the option to
// refuse. So the decision is now explicit, and "declined" is a real stored
// state that src/lib/ai-consent.ts enforces on every AI route.
//
// The flag lives on profiles.customization alongside the other underscore
// -prefixed flags (_deleted, _usage). The legacy `_aiConsentAccepted: true` is
// left untouched where it exists — readAiConsent still reads it as acceptance,
// so nobody who already agreed is asked twice.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // No body → "accepted", so an older shell build still records acceptance the
  // way it always did rather than silently failing to store anything.
  const decision = body?.decision === "declined" ? "declined" : "accepted";

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("customization")
    .eq("id", user.id)
    .single();

  const customization = (profile?.customization as Record<string, unknown> | null) ?? {};
  await admin
    .from("profiles")
    .update({
      customization: {
        ...customization,
        _aiConsent: decision,
        // Kept in sync so anything still reading the old flag agrees with the
        // new one instead of contradicting it.
        _aiConsentAccepted: decision === "accepted",
      },
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, decision });
}
