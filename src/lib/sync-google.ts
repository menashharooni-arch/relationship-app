import { getAdminSupabase } from "./supabase-admin";
import { encryptToken, decryptToken } from "./token-crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people:createContact";

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
    .eq("provider", "google")
    .single();

  if (!data) return null;

  const now = Date.now();
  const accessToken = decryptToken(data.access_token);

  // Refresh if expiring within 5 minutes
  if (data.expires_at && now > data.expires_at - 5 * 60 * 1000) {
    if (!data.refresh_token) return null;
    const refreshToken = decryptToken(data.refresh_token);

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;
    const tokens = await res.json() as { access_token: string; expires_in: number };

    await admin.from("integrations").update({
      access_token: encryptToken(tokens.access_token),
      expires_at: now + tokens.expires_in * 1000,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("provider", "google");

    return tokens.access_token;
  }

  return accessToken;
}

export async function syncLeadToGoogle(lead: LeadData, userId: string): Promise<void> {
  const token = await getValidToken(userId);
  if (!token) return;

  const [givenName, ...rest] = (lead.name || "").split(" ");
  const familyName = rest.join(" ") || undefined;

  const body: Record<string, unknown> = {
    names: [{ givenName, familyName }],
  };
  if (lead.email) body.emailAddresses = [{ value: lead.email }];
  if (lead.phone) body.phoneNumbers = [{ value: lead.phone }];
  if (lead.company) body.organizations = [{ name: lead.company }];

  const res = await fetch(GOOGLE_PEOPLE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn("[sync-google] createContact failed:", res.status, await res.text().catch(() => ""));
  }
}
