import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { saveAppleRefreshToken } from "@/lib/apple-token-store";

// ── Native-shell leg of Apple refresh-token persistence ──────────────────────
//
// The web OAuth flow exchanges the code in /auth/callback on the SERVER, so the
// provider refresh token can be stored right there. The native shell exchanges
// in the webview (completeNativeOAuth — the PKCE verifier lives in the
// webview's storage, so the exchange must happen client-side). The token is
// then only in browser memory; this endpoint is how it reaches the store.
//
// Security posture:
// - The caller must hold a valid session (cookie-authenticated via
//   @supabase/ssr); the token is stored under THAT session's user id, never an
//   id from the request body — so one user cannot write another's row.
// - The body token is opaque to us and useless without our Apple client
//   secret; storing it is strictly less exposure than the session cookie the
//   request already carries.
// - No-ops unless the session's provider is actually Apple.

export async function POST(request: NextRequest) {
  let refreshToken: unknown;
  try {
    ({ refreshToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (typeof refreshToken !== "string" || !refreshToken || refreshToken.length > 2048) {
    return NextResponse.json({ error: "bad_token" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.app_metadata?.provider !== "apple") {
    return NextResponse.json({ error: "not_apple" }, { status: 400 });
  }

  await saveAppleRefreshToken(user.id, refreshToken);
  return NextResponse.json({ ok: true });
}
