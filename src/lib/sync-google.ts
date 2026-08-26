import { getCrmConnection, setSyncError, connectionErrorMessage, resolveCrmOwnerId, type CrmLead } from "./crm-connection";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1/people:createContact";
const LABEL = "Google Contacts";

// Google Contacts has no field for capture context, so the extra CrmLead
// fields are simply unused here. Taking the shared type anyway keeps one lead
// shape across every provider instead of four subtly different ones.
export async function syncLeadToGoogle(lead: CrmLead, capturedBy: string): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's; everyone else resolves to themselves. See resolveCrmOwnerId.
  const userId = await resolveCrmOwnerId("google", capturedBy);
  const conn = await getCrmConnection("google", LABEL, userId, lead.capturedByCardId, {
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
  // The capture context lands in the contact's Notes field — where they met,
  // how the card was tapped, which card (the rep, in an Office), their
  // message, tags. Google's People API calls this "biographies"; it renders
  // as Notes in Google Contacts. Without it this sync sent name/email/phone
  // only, while Pipedrive/HighLevel carried the full story (audit 2026-08-26).
  {
    const { describeCapture } = await import("./crm-connection");
    const note = describeCapture(lead);
    if (note) body.biographies = [{ value: note, contentType: "TEXT_PLAIN" }];
  }

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
