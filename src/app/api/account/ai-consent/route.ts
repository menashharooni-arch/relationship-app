import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { aiConsentCopy, readAiConsent } from "@/lib/ai-consent";
import { aiProviderName } from "@/lib/ai";

// Stores the account's decision on sending data to the AI provider.
//
// Was accept-only: a POST with no body meant "accepted", because the notice it
// backed had a single "Got it" button. App Review rejected that under
// 5.1.1(i)/5.1.2(i) — Apple asked for permission, which requires the option to
// refuse. So the decision is now explicit, and "declined" is a real stored
// state that src/lib/ai-consent.ts enforces on every AI route.
//
// The flag lives on profiles.customization alongside the other underscore
// -prefixed flags (_deleted, _usage). The legacy `_aiConsentAccepted` is
// written in sync below for anything old still reading it, but readAiConsent
// deliberately ignores it as an input — a "Got it" tap on the pre-rejection
// notice wasn't informed consent, so those accounts get the real ask once.
// Read side, for the globally-mounted native consent dialog (GlobalAiConsent
// in the root layout) and the Settings control: the current decision plus the
// exact disclosure copy, built server-side from the live provider so the
// client can never show a stale provider name.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("customization")
    .eq("id", user.id)
    .single();

  const provider = aiProviderName();
  return NextResponse.json({
    consent: readAiConsent(profile?.customization),
    provider,
    copy: aiConsentCopy(provider ?? "our AI provider"),
  });
}

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
