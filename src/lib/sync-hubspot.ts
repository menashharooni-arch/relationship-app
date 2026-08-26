import { getCrmConnection, setSyncError, connectionErrorMessage, resolveCrmOwnerId, describeCapture, type CrmLead } from "./crm-connection";

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
  const conn = await getCrmConnection("hubspot", LABEL, userId, lead.capturedByCardId, {
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
    // Attach the capture context as a Note engagement — where they met, how
    // the card was tapped, which card (the rep, in an Office), their message,
    // tags. This was the ONE provider that sent bare name/email/phone (audit
    // 2026-08-26): standard properties reject unknown fields, but a Note is a
    // standard object every portal has. Best-effort — the contact is saved.
    try {
      const created = (await res.json()) as { id?: string };
      await attachContextNote(conn.token, created?.id, lead);
    } catch { /* note is a bonus, never a failure */ }
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
    try {
      const updated = (await updateRes.json()) as { id?: string };
      await attachContextNote(conn.token, updated?.id, lead);
    } catch { /* note is a bonus, never a failure */ }
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

// The capture context as a HubSpot Note, associated to the contact.
// Association type 202 is HubSpot's standard note→contact link.
async function attachContextNote(token: string, contactId: string | undefined, lead: CrmLead): Promise<void> {
  const note = describeCapture(lead);
  if (!contactId || !note) return;
  await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { hs_note_body: note, hs_timestamp: new Date().toISOString() },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
    }),
  }).catch(() => {});
}
