import { getCrmConnection, setSyncError, connectionErrorMessage, resolveCrmOwnerId, type CrmLead } from "./crm-connection";

const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";
const LABEL = "HubSpot";

// Only the standard properties are sent. HubSpot REJECTS a write to a property
// that doesn't exist on the portal, so pushing capture context into custom
// fields would 400 for every customer who hadn't created them by hand first —
// it needs a Note (a separate engagement object), which is its own piece of
// work. The extra CrmLead fields are therefore unused here, deliberately.
export async function syncLeadToHubSpot(lead: CrmLead, capturedBy: string): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's; everyone else resolves to themselves. See resolveCrmOwnerId.
  const userId = await resolveCrmOwnerId("hubspot", capturedBy);
  // Private App tokens (how this integration is normally connected) never
  // expire, so expires_at is null for them and the refresh below is skipped.
  // The config is still passed because the same row can hold an OAuth token.
  const conn = await getCrmConnection("hubspot", LABEL, userId, {
    tokenUrl: HUBSPOT_TOKEN_URL,
    clientId: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
  });
  if (!conn) return;

  const [firstname, ...rest] = (lead.name || "").split(" ");
  const lastname = rest.join(" ") || undefined;

  const properties: Record<string, string> = { firstname };
  if (lastname) properties.lastname = lastname;
  if (lead.email) properties.email = lead.email;
  if (lead.phone) properties.phone = lead.phone;
  if (lead.company) properties.company = lead.company;

  const res = await fetch(HUBSPOT_CONTACTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });

  if (res.ok) {
    // Recovered — drop the banner, but only if one was actually showing.
    if (conn.syncError) await setSyncError("hubspot", userId, null);
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
      headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    if (!updateRes.ok) {
      console.warn("[sync-hubspot] updateContact failed:", updateRes.status, await updateRes.text().catch(() => ""));
      await setSyncError("hubspot", userId, connectionErrorMessage(LABEL, updateRes.status));
      return;
    }
    if (conn.syncError) await setSyncError("hubspot", userId, null);
    return;
  }

  // A VALID token can still be refused — most often because the private app or
  // OAuth grant is missing crm.objects.contacts.write, which fails every lead
  // with a 403 while Settings kept showing a healthy "Connected".
  const detail = await res.text().catch(() => "");
  console.warn("[sync-hubspot] createContact failed:", res.status, detail);
  await setSyncError("hubspot", userId, connectionErrorMessage(LABEL, res.status));
}
