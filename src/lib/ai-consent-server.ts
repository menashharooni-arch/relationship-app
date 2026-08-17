import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { aiConsentAllows } from "@/lib/ai-consent";

// Server-side half of the AI consent gate. Separate from lib/ai-consent.ts
// because that module is imported (type-only) by a client component, and this
// one reaches for the service-role client — which must never be pulled into a
// client bundle.
//
// The point of this file: the modal is a promise, and a promise the server does
// not keep is worth nothing. Apple asked us to "ask the user's permission
// before sharing the data"; if declining only hid a dialog while the scanner
// still uploaded the photo, the app would be doing exactly what the rejection
// described. So every route that sends personal data to the AI provider calls
// this first.

/**
 * Returns a 403 response when this account has explicitly refused, or null when
 * the request may proceed.
 *
 * Fails OPEN on a lookup error — deliberately. A transient database blip should
 * degrade to today's behaviour (the feature works) rather than silently break
 * paid features for everyone; the decline is stored and will be read correctly
 * on the next call. The failure this guard exists to prevent is a standing
 * "declined" being ignored, not a one-off read error.
 */
export async function aiConsentBlock(userId: string): Promise<NextResponse | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("customization")
    .eq("id", userId)
    .single();

  if (error) return null;
  if (aiConsentAllows(data?.customization)) return null;

  return NextResponse.json(
    {
      error: "ai_consent_required",
      code: "AI_CONSENT_REQUIRED",
      message: "AI features are turned off for this account. Turn them back on to use this.",
    },
    { status: 403 },
  );
}

/**
 * Boolean form, for the one surface that should DEGRADE rather than refuse.
 *
 * The in-app assistant answers most questions from the local knowledge base
 * with no AI call at all, and only reaches for the model when the corpus can't
 * match. Returning 403 there would break a help widget over a preference,
 * whereas skipping the model just makes it answer from what it already knows —
 * which is the honest consequence of declining, not a punishment for it.
 */
export async function aiConsentAllowsFor(userId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("profiles")
    .select("customization")
    .eq("id", userId)
    .single();
  if (error) return true; // fail open, same reasoning as above
  return aiConsentAllows(data?.customization);
}
