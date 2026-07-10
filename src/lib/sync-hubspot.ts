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

async function getValidToken(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .single();

  if (!data) return null;

  const now = Date.now();
  const accessToken = decryptToken(data.access_token);

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

    return tokens.access_token;
  }

  return accessToken;
}

export async function syncLeadToHubSpot(lead: LeadData, userId: string): Promise<void> {
  const token = await getValidToken(userId);
  if (!token) return;

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

  if (res.ok) return;

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
    }
    return;
  }

  console.warn("[sync-hubspot] createContact failed:", res.status, await res.text().catch(() => ""));
}
