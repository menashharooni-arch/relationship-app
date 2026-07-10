import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/token-crypto";
import { verifyState } from "@/lib/oauth-state";
import { exchangeLinkedInCode, isLinkedInEnabled } from "@/lib/sync-linkedin";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
const DONE = (status: string) => NextResponse.redirect(`${APP_URL}/settings/flows?integration=linkedin&status=${status}`);

export async function GET(request: NextRequest) {
  if (!isLinkedInEnabled()) return DONE("error");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // The user declined consent (or LinkedIn returned an error) — not a failure
  // on our side, just send them back cleanly.
  if (error || !code || !state) return DONE("error");

  // Reject a forged/unsigned state (arbitrary user_id) so tokens can't be
  // written onto another user's row.
  const userId = verifyState(state);
  if (!userId) return DONE("error");

  const tokens = await exchangeLinkedInCode(code);
  if (!tokens?.access_token) return DONE("error");

  try {
    const admin = getAdminSupabase();
    const { error: dbErr } = await admin.from("integrations").upsert({
      user_id: userId,
      provider: "linkedin",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expires_at: Date.now() + (tokens.expires_in ?? 0) * 1000,
      updated_at: new Date().toISOString(),
      sync_error: null, // upsert only touches listed columns — clear on reconnect
    }, { onConflict: "user_id,provider" });
    if (dbErr) throw dbErr;
  } catch (e) {
    console.error("[linkedin/callback] save failed:", e);
    return DONE("error");
  }

  // Connected. The user still explicitly APPROVES importing the photo from the
  // LinkedIn card in Settings — we never auto-apply it here.
  return DONE("connected");
}
