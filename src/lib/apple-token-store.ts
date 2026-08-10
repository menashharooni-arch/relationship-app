import { getAdminSupabase } from "@/lib/supabase-admin";

// ── Apple provider-token persistence (App Review 5.1.1(v)) ───────────────────
//
// Deleting a Sign-in-with-Apple account must revoke the user's Apple token at
// appleid.apple.com/auth/revoke. The catch: Supabase hands the provider's
// refresh token to the CLIENT once, on the session right after the code
// exchange (`session.provider_refresh_token`) — it is NOT stored in
// `identity_data`, which carries only ID-token claims. So unless we save it at
// sign-in, deletion has nothing to revoke and 5.1.1(v) silently isn't met.
//
// Storage: public.apple_refresh_tokens (user_id PK → auth.users ON DELETE
// CASCADE, refresh_token, updated_at). RLS is enabled with NO policies and
// anon/authenticated grants revoked — service-role only, same posture as
// push_subscriptions. Schema recorded in supabase/apple-refresh-tokens.sql.
//
// Apple refresh tokens do not expire on a schedule; a re-auth may mint a new
// one, so we upsert and always keep the latest.

export async function saveAppleRefreshToken(userId: string, refreshToken: string): Promise<void> {
  if (!userId || !refreshToken) return;
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("apple_refresh_tokens")
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  // Best-effort by design: failing to store must never break sign-in itself.
  // But say so — a silent miss here resurfaces months later as a 5.1.1 gap.
  if (error) console.error("[apple-token-store] save failed:", error.message);
}

export async function readAppleRefreshToken(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("apple_refresh_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.refresh_token ?? null;
}
