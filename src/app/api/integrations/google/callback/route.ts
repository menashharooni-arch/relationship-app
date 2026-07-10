import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/token-crypto";
import { verifyState } from "@/lib/oauth-state";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=google&status=error`);
  }

  // State must carry a valid signature — an unsigned/forged state (arbitrary
  // user_id) is rejected, so tokens can't be written onto another user's row.
  const userId = verifyState(state);
  if (!userId) {
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=google&status=error`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/integrations/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=google&status=error`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  try {
    const admin = getAdminSupabase();
    const { error } = await admin.from("integrations").upsert({
      user_id: userId,
      provider: "google",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expires_at: Date.now() + tokens.expires_in * 1000,
      updated_at: new Date().toISOString(),
      sync_error: null, // upsert only touches listed columns — must clear explicitly on reconnect
    }, { onConflict: "user_id,provider" });
    if (error) throw error;
  } catch (e) {
    console.error("[google/callback] save failed:", e);
    return NextResponse.redirect(`${APP_URL}/settings/flows?integration=google&status=error`);
  }

  return NextResponse.redirect(`${APP_URL}/settings/flows?integration=google&status=connected`);
}
