import { getAdminSupabase } from "./supabase-admin";
import { encryptToken, decryptToken } from "./token-crypto";

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

type LeadData = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
};

// Record/clear the banner Settings shows next to "Connected". Writing it is
// what turns a silently-dead integration into a visible one; clearing it on the
// next success stops a one-off blip from nagging forever.
async function setSyncError(userId: string, message: string | null): Promise<void> {
  await getAdminSupabase()
    .from("integrations")
    .update({ sync_error: message })
    .eq("user_id", userId)
    .eq("provider", "hubspot");
}

async function getValidToken(userId: string): Promise<{ token: string; syncError: string | null } | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("integrations")
    // sync_error comes along so a success can clear a stale banner WITHOUT an
    // extra read — and without writing on every single lead when it's already
    // null, which would be a pointless round trip per capture.
    .select("access_token, refresh_token, expires_at, sync_error")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .single();

  if (!data) return null;

  const now = Date.now();
  const accessToken = decryptToken(data.access_token);
  const storedError = (data.sync_error as string | null) ?? null;

  if (data.expires_at && now > data.expires_at - 5 * 60 * 1000) {
    if (!data.refresh_token) {
      await admin.from("integrations").update({ sync_error: "No refresh token on file — reconnect HubSpot." }).eq("user_id", userId).eq("provider", "hubspot");
      return null;
    }
    const refreshToken = decryptToken(data.refresh_token);

    const res = await fetch(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      // Silent before: sync would just stop working forever with "Connected"
      // still showing in Settings. Now it's visible and prompts a reconnect.
      const detail = await res.text().catch(() => "");
      console.warn("[sync-hubspot] token refresh failed:", res.status, detail);
      await admin.from("integrations").update({
        sync_error: `Token refresh failed (${res.status}) — reconnect HubSpot to resume syncing.`,
      }).eq("user_id", userId).eq("provider", "hubspot");
      return null;
    }
    const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number };

    await admin.from("integrations").update({
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : data.refresh_token,
      expires_at: now + tokens.expires_in * 1000,
      updated_at: new Date().toISOString(),
      sync_error: null,
    }).eq("user_id", userId).eq("provider", "hubspot");

    // The update above already cleared sync_error, so the caller has nothing
    // stale left to clear.
    return { token: tokens.access_token, syncError: null };
  }

  return { token: accessToken, syncError: storedError };
}

export async function syncLeadToHubSpot(lead: LeadData, userId: string): Promise<void> {
  const auth = await getValidToken(userId);
  if (!auth) return;
  const { token } = auth;

  const [firstname, ...rest] = (lead.name || "").split(" ");
  const lastname = rest.join(" ") || undefined;

  const properties: Record<string, string> = { firstname };
  if (lastname) properties.lastname = lastname;
  if (lead.email) properties.email = lead.email;
  if (lead.phone) properties.phone = lead.phone;
  if (lead.company) properties.company = lead.company;

  const res = await fetch(HUBSPOT_CONTACTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });

  if (res.ok) {
    // Recovered — drop the banner, but only if one was actually showing.
    if (auth.syncError) await setSyncError(userId, null);
    return;
  }

  // 409 = a contact with this email already exists in HubSpot. Previously this
  // was treated as "done, nothing to do" — meaning a repeat lead's updated
  // phone/company/message never actually reached HubSpot after the first
  // capture. Update the existing contact by email instead of silently no-oping.
  if (res.status === 409 && lead.email) {
    const updateUrl = `${HUBSPOT_CONTACTS_URL}/${encodeURIComponent(lead.email)}?idProperty=email`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    if (!updateRes.ok) {
      console.warn("[sync-hubspot] updateContact failed:", updateRes.status, await updateRes.text().catch(() => ""));
      await setSyncError(userId, `Couldn't update an existing HubSpot contact (${updateRes.status}). New leads will keep trying.`);
      return;
    }
    if (auth.syncError) await setSyncError(userId, null);
    return;
  }

  // A VALID token can still be refused — most often because the private app or
  // OAuth grant is missing crm.objects.contacts.write, which fails every lead
  // with a 403 while Settings kept showing a healthy "Connected". The refresh
  // path already reported its failures; this one didn't, so the integration
  // could be entirely dead and still look fine.
  const detail = await res.text().catch(() => "");
  console.warn("[sync-hubspot] createContact failed:", res.status, detail);
  await setSyncError(
    userId,
    res.status === 401 || res.status === 403
      ? `HubSpot refused the last contact (${res.status}) — reconnect HubSpot and allow contacts write access.`
      : `Couldn't save the last contact to HubSpot (${res.status}). New leads will keep trying.`,
  );
}
