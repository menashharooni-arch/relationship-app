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

// Record/clear the banner Settings shows next to "Connected". Writing it is
// what turns a silently-dead integration into a visible one; clearing it on the
// next success stops a one-off blip from nagging forever.
async function setSyncError(userId: string, message: string | null): Promise<void> {
  await getAdminSupabase()
    .from("integrations")
    .update({ sync_error: message })
    .eq("user_id", userId)
    .eq("provider", "google");
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
    .eq("provider", "google")
    .single();

  if (!data) return null;

  const now = Date.now();
  const accessToken = decryptToken(data.access_token);
  const storedError = (data.sync_error as string | null) ?? null;

  // Refresh if expiring within 5 minutes
  if (data.expires_at && now > data.expires_at - 5 * 60 * 1000) {
    if (!data.refresh_token) {
      await admin.from("integrations").update({ sync_error: "No refresh token on file — reconnect Google Contacts." }).eq("user_id", userId).eq("provider", "google");
      return null;
    }
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

    if (!res.ok) {
      // Silent before: sync would just stop working forever with "Connected"
      // still showing in Settings. Now it's visible and prompts a reconnect.
      const detail = await res.text().catch(() => "");
      console.warn("[sync-google] token refresh failed:", res.status, detail);
      await admin.from("integrations").update({
        sync_error: `Token refresh failed (${res.status}) — reconnect Google Contacts to resume syncing.`,
      }).eq("user_id", userId).eq("provider", "google");
      return null;
    }
    const tokens = await res.json() as { access_token: string; expires_in: number };

    await admin.from("integrations").update({
      access_token: encryptToken(tokens.access_token),
      expires_at: now + tokens.expires_in * 1000,
      updated_at: new Date().toISOString(),
      sync_error: null,
    }).eq("user_id", userId).eq("provider", "google");

    // The update above already cleared sync_error, so the caller has nothing
    // stale left to clear.
    return { token: tokens.access_token, syncError: null };
  }

  return { token: accessToken, syncError: storedError };
}

export async function syncLeadToGoogle(lead: LeadData, userId: string): Promise<void> {
  const auth = await getValidToken(userId);
  if (!auth) return;
  const { token } = auth;

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
    // A VALID token can still be refused — most often because the People API
    // isn't enabled on the Google Cloud project, or the user never granted the
    // contacts scope. Both return 403 on every single lead, forever, while
    // Settings kept showing a healthy "Connected". Surfacing it is the whole
    // point: the refresh path above already reported its failures, this one
    // didn't, so the integration could be completely dead and look fine.
    const detail = await res.text().catch(() => "");
    console.warn("[sync-google] createContact failed:", res.status, detail);
    await setSyncError(
      userId,
      res.status === 401 || res.status === 403
        ? `Google refused the last contact (${res.status}) — reconnect Google Contacts and allow contacts access.`
        : `Couldn't save the last contact to Google (${res.status}). New leads will keep trying.`,
    );
    return;
  }
  // Recovered — drop the banner, but only if one was actually showing.
  if (auth.syncError) await setSyncError(userId, null);
}
