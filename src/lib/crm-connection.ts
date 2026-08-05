import { getAdminSupabase } from "./supabase-admin";
import { encryptToken, decryptToken } from "./token-crypto";
import { resolveOfficeContext } from "./office-roles";
import { isCardInScope, parseCardScope } from "./crm-scope";

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

/**
 * A captured lead, with the context that makes it worth more than a name.
 *
 * The first four fields are all Google and HubSpot ever sent. Everything below
 * them is what SwiftCard uniquely knows — where the meeting happened, how the
 * card was tapped, which card (so which rep) captured it — and is the whole
 * reason a native integration beats a generic Zapier hop. Providers that can't
 * express a field simply ignore it.
 */
export type CrmLead = {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  whereMet?: string | null;
  location?: string | null;
  /** Human-readable capture channel, e.g. "QR code" — already run through getSourceLabel. */
  source?: string | null;
  notes?: string | null;
  message?: string | null;
  /** Card slug that captured it. In an Office this identifies the rep. */
  capturedByCard?: string | null;
  /**
   * cards.id of the capturing card — the key per-card CRM scoping is checked
   * against. Separate from capturedByCard because that one is the SLUG, which
   * the owner can rename at will; an id can't drift out from under a scope.
   * Undefined only for a legacy profile-card with no cards row, which
   * isCardInScope treats as out-of-scope whenever a scope is set.
   */
  capturedByCardId?: string | null;
};

/**
 * Render the capture context as a short human note.
 *
 * Deliberately prose, not JSON: this lands on a timeline a salesperson reads
 * for ten seconds before dialling, so it has to be skimmable. Returns null when
 * there's nothing worth saying, so we never attach an empty note.
 */
export function describeCapture(lead: CrmLead): string | null {
  const lines: string[] = [];
  const met = [lead.whereMet, lead.location].filter(Boolean).join(" · ");
  if (met) lines.push(`Met: ${met}`);
  if (lead.source) lines.push(`Captured via: ${lead.source}`);
  if (lead.capturedByCard) lines.push(`Card: ${lead.capturedByCard}`);
  if (lead.company) lines.push(`Company: ${lead.company}`);
  if (lead.message) lines.push(`They wrote: ${lead.message}`);
  if (lead.notes) lines.push(`Notes: ${lead.notes}`);
  if (!lines.length) return null;
  return `${lines.join("\n")}\n\n— captured with SwiftCard`;
}

export type CrmConnection = {
  token: string;
  /** Banner currently stored, so a success can clear it without a second read. */
  syncError: string | null;
  /** Non-secret routing detail: Pipedrive api_domain, HighLevel locationId. */
  metadata: Record<string, unknown>;
};

/**
 * Whose CRM connection a captured lead should be written to.
 *
 * Same question `resolveBillingSubjectId` answers for subscriptions, and the
 * answer has the same shape — because an Office is one business, not N loose
 * accounts. A 12-agent agency has ONE HighLevel account and wants every agent's
 * leads landing in it, attributed to the agent who captured them. Requiring all
 * 12 to connect their own CRM would be absurd, and 12 disconnected CRMs is not
 * a product anyone asked for.
 *
 * Order matters, and it is deliberately "own connection first":
 *
 *   1. The capturing user's OWN connection, if they have one. This is what
 *      keeps the change additive — anyone connected today keeps exactly the
 *      destination they have now, including a sub-user who connected their
 *      personal Google Contacts before their office existed.
 *   2. Otherwise, for an office SUB-USER, the office owner's connection. This
 *      is the agency case, and it costs the sub-user no setup at all.
 *   3. Otherwise themselves — no office, or an owner, so nothing to inherit.
 *
 * A BROKEN own-connection deliberately does NOT fall through to the office. The
 * row exists, so this returns the sub-user, getCrmConnection reports the
 * failure against their account, and their contacts stop rather than silently
 * rerouting into the agency's CRM. Quietly sending someone's contacts somewhere
 * they didn't choose is worse than pausing.
 */
export async function resolveCrmOwnerId(
  provider: CrmProviderKey,
  capturedByUserId: string,
): Promise<string> {
  const admin = getAdminSupabase();

  // Presence check only — an existing-but-broken row still counts as "theirs".
  const { data: own } = await admin
    .from("integrations")
    .select("id")
    .eq("user_id", capturedByUserId)
    .eq("provider", provider)
    .maybeSingle();
  if (own) return capturedByUserId;

  const ctx = await resolveOfficeContext(capturedByUserId);
  if (ctx && !ctx.isOwner && ctx.ownerId) return ctx.ownerId;

  return capturedByUserId;
}

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
 * expire. Returns null when there is no connection, when the card is out of
 * this connection's scope, or when the connection is broken in a way the user
 * has to fix — in which case the banner is already set.
 *
 * PER-CARD SCOPING IS ENFORCED HERE, and here only, on purpose. Every provider
 * has to come through this function to get a token, so one check covers all of
 * them and a fifth provider cannot be added with the gate missing. Putting it
 * in the lead route instead would have been wrong as well as fragile: each sync
 * resolves its OWN destination account via resolveCrmOwnerId (an Office
 * sub-user inherits the owner's CRM), so the route doesn't yet know whose
 * integration row — and therefore whose scope — is about to be used.
 *
 * `cardId` is required rather than optional so the compiler, not a reviewer,
 * is what stops a future call site from forgetting it.
 */
export async function getCrmConnection(
  provider: CrmProviderKey,
  label: string,
  userId: string,
  cardId: string | null | undefined,
  refresh?: RefreshConfig,
): Promise<CrmConnection | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("integrations")
    // sync_error rides along so a later success can clear a stale banner without
    // an extra read — and without writing on every captured lead when it's
    // already null, which would be a pointless round trip per capture.
    // card_ids rides along for the same reason: the scope check costs no extra
    // query, it is just one more column on a row we were already reading.
    .select("access_token, refresh_token, expires_at, sync_error, metadata, card_ids")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (!data) return null;

  // Scope check BEFORE anything else: no token refresh, no network call, and
  // above all no setSyncError. A card the owner deliberately left out is not a
  // broken connection, so it must not raise a banner telling them to fix
  // something that is working as configured.
  //
  // `card_ids` is absent (undefined) on a pre-migration database, which
  // parseCardScope reads as null — all cards — so this is a no-op until someone
  // actually sets a scope.
  if (!isCardInScope(parseCardScope((data as { card_ids?: unknown }).card_ids), cardId)) return null;

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
