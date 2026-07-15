import crypto from "node:crypto";

// ── Sign in with Apple token revocation (App Store requirement 6.2) ──────────
//
// When a user who signed up with "Sign in with Apple" deletes their account,
// Apple requires us to revoke their Apple tokens via
// https://appleid.apple.com/auth/revoke.
//
// This is SCAFFOLDING and is dead code for every current user: Sign in with
// Apple is not enabled on the Supabase project yet, so no account has an Apple
// identity. It's written to be completely safe to ship:
//   • If the user has no Apple identity → no-op.
//   • If the required env vars are missing → skip gracefully (no-op).
//   • Any error is swallowed — this must NEVER block or fail account deletion.
//
// Env vars (named to match the existing Wallet APPLE_* convention in
// wallet-config.ts; none of these exist yet — that's a later owner action):
//   APPLE_TEAM_ID            – 10-char Apple Team ID (already used by Wallet)
//   APPLE_SIGN_IN_CLIENT_ID  – the Services ID / bundle id (me.swiftcard.app)
//   APPLE_SIGN_IN_KEY_ID     – the Key ID of the Sign in with Apple private key
//   APPLE_SIGN_IN_PRIVATE_KEY – the .p8 private key (PEM text)

type MinimalUser = {
  identities?: Array<{
    provider?: string | null;
    identity_data?: Record<string, unknown> | null;
  } | null> | null;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Build the ES256 client-secret JWT Apple requires to authenticate the revoke
// call. Signed with the Sign in with Apple .p8 private key.
function buildAppleClientSecret(opts: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: opts.keyId };
  const payload = {
    iss: opts.teamId,
    iat: now,
    exp: now + 60 * 5, // short-lived; only used for this one call
    aud: "https://appleid.apple.com",
    sub: opts.clientId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // ES256 → ECDSA P-256 + SHA-256, JOSE raw R||S signature (ieee-p1363).
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: opts.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Best-effort revocation of a user's Sign in with Apple tokens at deletion.
 * Never throws; returns a small status for logging/testing.
 *
 * Returns:
 *   "not_apple"        – the user didn't sign in with Apple (no-op).
 *   "not_configured"   – Apple env vars aren't set (no-op).
 *   "no_token"         – no Apple refresh/access token available to revoke (no-op).
 *   "revoked"          – a revoke request was sent (2xx or not — best effort).
 *   "error"            – something failed; deletion continues regardless.
 */
export async function revokeAppleTokensOnDelete(user: MinimalUser | null | undefined): Promise<
  "not_apple" | "not_configured" | "no_token" | "revoked" | "error"
> {
  try {
    const appleIdentity = (user?.identities ?? []).find((i) => i?.provider === "apple");
    if (!appleIdentity) return "not_apple";

    const teamId = process.env.APPLE_TEAM_ID;
    const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
    const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
    const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
    if (!teamId || !clientId || !keyId || !privateKey) return "not_configured";

    // Supabase stores the provider tokens on the identity's identity_data. Field
    // naming is finalized once the provider is live; read defensively.
    const data = (appleIdentity.identity_data ?? {}) as Record<string, unknown>;
    const token =
      (typeof data.refresh_token === "string" && data.refresh_token) ||
      (typeof data.provider_refresh_token === "string" && data.provider_refresh_token) ||
      (typeof data.access_token === "string" && data.access_token) ||
      "";
    if (!token) return "no_token";

    const tokenTypeHint =
      typeof data.refresh_token === "string" || typeof data.provider_refresh_token === "string"
        ? "refresh_token"
        : "access_token";

    const clientSecret = buildAppleClientSecret({ teamId, keyId, clientId, privateKey });
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenTypeHint,
    });

    await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });
    return "revoked";
  } catch {
    // Never let Apple revocation block account deletion.
    return "error";
  }
}
