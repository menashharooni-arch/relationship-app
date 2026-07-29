import { getCrmConnection, setSyncError, connectionErrorMessage } from "./crm-connection";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people:createContact";
const LABEL = "Google Contacts";

type LeadData = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
};

export async function syncLeadToGoogle(lead: LeadData, userId: string): Promise<void> {
  const conn = await getCrmConnection("google", LABEL, userId, {
    tokenUrl: GOOGLE_TOKEN_URL,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  if (!conn) return;

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
    headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // A VALID token can still be refused — most often because the People API
    // isn't enabled on the Google Cloud project, or the user never granted the
    // contacts scope. Both return 403 on every single lead, forever, while
    // Settings kept showing a healthy "Connected".
    const detail = await res.text().catch(() => "");
    console.warn("[sync-google] createContact failed:", res.status, detail);
    await setSyncError("google", userId, connectionErrorMessage(LABEL, res.status));
    return;
  }

  // Recovered — drop the banner, but only if one was actually showing.
  if (conn.syncError) await setSyncError("google", userId, null);
}
