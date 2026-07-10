import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { signState } from "@/lib/oauth-state";
import { isLinkedInEnabled, LINKEDIN_AUTH_URL, LINKEDIN_REDIRECT_URI, LINKEDIN_SCOPES } from "@/lib/sync-linkedin";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

// GET /api/integrations/linkedin/connect → redirect the signed-in user into
// LinkedIn's official OAuth consent screen. Profile-photo import is a card-
// building convenience, so it's available to any signed-in user (not Pro-gated).
export async function GET() {
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

  return NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params}`);
}
