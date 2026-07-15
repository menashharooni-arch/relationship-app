import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { signState } from "@/lib/oauth-state";
import { isLinkedInEnabled, LINKEDIN_AUTH_URL, LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES } from "@/lib/sync-linkedin";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// GET /api/integrations/linkedin/connect → redirect the signed-in user into
// LinkedIn's official OAuth consent screen. Profile-photo import is a card-
// building convenience, so it's available to any signed-in user (not Pro-gated).
// `?next=<same-origin path>` returns the user to where they started (the card
// editor's "Suggest my profile picture") instead of Settings.
export async function GET(request: Request) {
  const nextRaw = new URL(request.url).searchParams.get("next") ?? "";
  // Same-origin relative paths only — anything else falls back to Settings.
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";

  // Fail safe: with no credentials the feature is off — send the user back
  // rather than to a broken LinkedIn error page.
  if (!isLinkedInEnabled()) {
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=linkedin&status=error`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  // Signed state binds this user_id + issue time so a forged/unsigned state
  // can't write LinkedIn tokens onto another user's row.
  const state = signState(user.id);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    scope: LINKEDIN_SCOPES,
    state,
  });

  const res = NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params}`);
  // The redirect_uri registered with LinkedIn is fixed, so the return path
  // rides in a short-lived cookie the callback reads back.
  if (next) {
    res.cookies.set("li_return_to", next, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  }
  return res;
}
