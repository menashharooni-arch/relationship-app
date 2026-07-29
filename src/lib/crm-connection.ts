import { getAdminSupabase } from "./supabase-admin";
import { encryptToken, decryptToken } from "./token-crypto";

// ── Shared plumbing for every CRM connection ─────────────────────────────────
//
// Fetching the stored token, refreshing it before expiry, and reporting a dead
// connection is identical for every provider — only the token URL, the env var
// names and the label in the message differ. sync-google and sync-hubspot each
// carried their own copy, which is how a fix landed in one and not the other:
// the "surface API failures, not just refresh failures" change had to be made
// twice, by hand, in files that were already near-duplicates. A third and
// fourth provider would have made that four copies.
//
// What stays per-provider is the part that genuinely differs: the endpoint, the
// field mapping, and how each API signals a duplicate. That belongs in
// sync-<provider>.ts, not here.

export type CrmProviderKey = "google" | "hubspot" | "pipedrive" | "highlevel";

// Providers whose token never expires (Pipedrive personal API tokens, HighLevel
// Private Integration tokens) simply omit this — expires_at is null for them, so
// the refresh branch never runs.
export type RefreshConfig = {
  tokenUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
};

export type CrmConnection = {
  token: string;
  /** Banner currently stored, so a success can clear it without a second read. */
  syncError: string | null;
  /** Non-secret routing detail: Pipedrive api_domain, HighLevel locationId. */
  metadata: Record<string, unknown>;
};

/**
 * Write (or clear) the banner Settings shows next to "Connected".
 *
 * Writing it is what turns a silently-dead integration into a visible one.
 * Clearing it on the next success stops a one-off blip nagging forever.
 */
export async function setSyncError(
  provider: CrmProviderKey,
  userId: string,
  message: string | null,
): Promise<void> {
  await getAdminSupabase()
    .from("integrations")
    .update({ sync_error: message })
    .eq("user_id", userId)
    .eq("provider", provider);
}

/**
 * Load a usable token for `provider`, refreshing it first if it's about to
 * expire. Returns null when there is no connection, or when the connection is
 * broken in a way the user has to fix — in which case the banner is already set.
 */
export async function getCrmConnection(
  provider: CrmProviderKey,
  label: string,
  userId: string,
  refresh?: RefreshConfig,
): Promise<CrmConnection | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("integrations")
    // sync_error rides along so a later success can clear a stale banner without
    // an extra read — and without writing on every captured lead when it's
    // already null, which would be a pointless round trip per capture.
    .select("access_token, refresh_token, expires_at, sync_error, metadata")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data) return null;

  const now = Date.now();
  const accessToken = decryptToken(data.access_token);
  const storedError = (data.sync_error as string | null) ?? null;
  const metadata = (data.metadata as Record<string, unknown> | null) ?? {};

  // Static-token providers have no expires_at, so this whole branch is skipped
  // and the stored token is used as-is.
  if (refresh && data.expires_at && now > (data.expires_at as number) - 5 * 60 * 1000) {
    if (!data.refresh_token) {
      await setSyncError(provider, userId, `No refresh token on file — reconnect ${label}.`);
      return null;
    }

    const res = await fetch(refresh.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: refresh.clientId ?? "",
        client_secret: refresh.clientSecret ?? "",
        refresh_token: decryptToken(data.refresh_token),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[crm:${provider}] token refresh failed:`, res.status, detail);
      await setSyncError(provider, userId, `Token refresh failed (${res.status}) — reconnect ${label} to resume syncing.`);
      return null;
    }

    // Some providers rotate the refresh token on every use and some don't —
    // keep the existing one when none comes back, or the NEXT refresh fails.
    const tokens = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
    await admin
      .from("integrations")
      .update({
        access_token: encryptToken(tokens.access_token),
        refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : data.refresh_token,
        expires_at: now + tokens.expires_in * 1000,
        updated_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq("user_id", userId)
      .eq("provider", provider);

    // The update above already cleared sync_error, so the caller has nothing
    // stale left to clear.
    return { token: tokens.access_token, syncError: null, metadata };
  }

  return { token: accessToken, syncError: storedError, metadata };
}

/**
 * Turn a provider's HTTP failure into copy the user can act on.
 *
 * 401/403 is the realistic case — a scope never granted, an API not enabled on
 * the project, a rotated token — and it needs different advice from a transient
 * 5xx, because retrying will never fix it.
 */
export function connectionErrorMessage(label: string, status: number): string {
  return status === 401 || status === 403
    ? `${label} refused the last contact (${status}) — reconnect ${label} and allow contact access.`
    : `Couldn't save the last contact to ${label} (${status}). New leads will keep trying.`;
}
