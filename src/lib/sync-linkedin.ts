import { safeFetch } from "@/lib/safe-fetch";

// ── LinkedIn (Sign In with LinkedIn using OpenID Connect) ─────────────────────
// We use OFFICIAL LinkedIn OAuth 2.0 / OIDC with the user's explicit consent and
// only the approved `openid profile email` scopes. The ONLY profile data we read
// is what userinfo returns for those scopes — in particular the `picture` (the
// member's own profile photo). We do NOT scrape LinkedIn, do NOT match photos by
// name, and never read connections or anything the member didn't consent to.
//
// NOTE: this requires the "Sign In with LinkedIn using OpenID Connect" product
// to be added AND approved on the LinkedIn app. Until then the feature stays
// hidden (see isLinkedInEnabled) — nothing here is claimed to be operational.

export const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// Minimal scopes — profile photo comes from `profile`; `openid` is required for
// the userinfo endpoint; `email` is optional but standard for account linking.
export const LINKEDIN_SCOPES = "openid profile email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me";
export const LINKEDIN_REDIRECT_URI = `${APP_URL}/api/integrations/linkedin/callback`;

/** Sentinel carried in the signed OAuth `state` for a signed-out visitor doing
 *  a one-shot photo import from the free-card builder. Not a valid user id, so
 *  it can never collide with a real account — the callback branches on it and
 *  never persists tokens for it. */
export const GUEST_STATE = "guest-photo-import";

/** True only when both LinkedIn OAuth credentials are configured. Everything
 *  upstream (Connect button, connect route) hides/fails-safe when this is false. */
export function isLinkedInEnabled(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export type LinkedInTokens = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

/** Exchange an authorization code for tokens. Mirrors the Google callback's
 *  plain-fetch token POST (fixed LinkedIn host, not user-controlled). Returns
 *  null on any failure so callers redirect to a clean error state. */
export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokens | null> {
  try {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: LINKEDIN_REDIRECT_URI,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as LinkedInTokens;
  } catch {
    return null;
  }
}

export type LinkedInProfile = {
  sub: string;
  name?: string;
  picture?: string;   // the member's profile photo URL (LinkedIn CDN)
  email?: string;
};

/** Fetch the consented profile via OIDC userinfo. Uses safeFetch (SSRF-guarded)
 *  per the outbound-fetch policy. Returns null if the token is missing/revoked
 *  or the member has no photo-visible profile. */
export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile | null> {
  try {
    const res = await safeFetch(LINKEDIN_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<LinkedInProfile>;
    if (!body || typeof body.sub !== "string") return null;
    const picture = typeof body.picture === "string" && /^https:\/\//i.test(body.picture)
      ? body.picture
      : undefined;
    return {
      sub: body.sub,
      name: typeof body.name === "string" ? body.name : undefined,
      picture,
      email: typeof body.email === "string" ? body.email : undefined,
    };
  } catch {
    return null;
  }
}
