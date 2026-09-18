import {
  getCrmConnection,
  setSyncError,
  connectionErrorMessage,
  resolveCrmOwnerId,
  describeCapture,
  shouldAttachNote,
  type CrmLead,
  type CrmSyncOptions,
} from "./crm-connection";

// ── HighLevel (GoHighLevel) ──────────────────────────────────────────────────
//
// Connected with a Private Integration token the user creates in their own
// account (Settings → Private Integrations), scoped to contacts.write. Static
// token, no OAuth app, so nothing waits on marketplace review.
//
// TWO values are needed, not one. A Private Integration token is NOT implicitly
// scoped to a sub-account — HighLevel requires locationId on every request — so
// the connect form asks for the Location ID as well. Both are validated
// together on save.
//
// upsert, not create: /contacts/upsert honours the location's own "Allow
// Duplicate Contact" preference (Settings → Business Profile → Contact
// Preferences). That delegates the dedup policy to what the customer has
// already decided rather than us guessing, and means meeting the same person
// twice updates one record instead of making two.

const HL_BASE = "https://services.leadconnectorhq.com";
// HighLevel requires an explicit API version header on every request; without
// it the call is rejected outright.
const HL_VERSION = "2021-07-28";
const LABEL = "HighLevel";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Version: HL_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}


export type HighLevelCheck = "ok" | "missing_scope" | "rejected";

/**
 * Confirm a token + location pair really work together, before storing them.
 *
 * Validating the PAIR matters: a valid token with someone else's location id
 * would otherwise be accepted here and then fail on every single lead.
 *
 * Private Integration scopes are independent — contacts.write does NOT grant
 * any read — so no single call is guaranteed to be allowed. Reading the
 * sub-account needs locations.readonly; listing one contact of it needs
 * contacts.readonly. Either one proves the token reaches that location, so
 * both are tried. When both are refused for SCOPE rather than for a bad token,
 * the user is told exactly which box to tick instead of "check your token",
 * which sent people round in circles with a token that was fine.
 */
export async function checkHighLevelConnection(token: string, locationId: string): Promise<HighLevelCheck> {
  let scopeRefused = false;
  const attempt = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(url, { headers: headers(token) });
      if (res.ok) return true;
      const text = await res.text().catch(() => "");
      if ((res.status === 401 || res.status === 403) && /scope/i.test(text)) scopeRefused = true;
      return false;
    } catch {
      return false;
    }
  };
  if (await attempt(`${HL_BASE}/locations/${encodeURIComponent(locationId)}`)) return "ok";
  if (await attempt(`${HL_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`)) return "ok";
  return scopeRefused ? "missing_scope" : "rejected";
}

export async function syncLeadToHighLevel(lead: CrmLead, capturedBy: string, opts?: CrmSyncOptions): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's, so a whole agency's leads land in one HighLevel sub-account.
  const userId = await resolveCrmOwnerId("highlevel", capturedBy);
  // No refresh config — Private Integration tokens are static and never expire,
  // so expires_at is null and the refresh branch never runs. HighLevel does
  // recommend rotating them periodically, and a rotation looks exactly like a
  // revoked token here: the next lead 401s and the banner tells them to reconnect.
  const conn = await getCrmConnection("highlevel", LABEL, userId, lead.capturedByCardId, capturedBy);
  if (!conn) return;

  const locationId = typeof conn.metadata.location_id === "string" ? conn.metadata.location_id : "";
  if (!locationId) {
    await setSyncError("highlevel", userId, `Reconnect ${LABEL} — the sub-account it points at is missing.`);
    return;
  }

  const [firstName, ...rest] = (lead.name || "").trim().split(/\s+/);
  const lastName = rest.join(" ") || undefined;

  // source and tags are FIRST-CLASS HighLevel fields, which is what makes this
  // more than a contact dump: a tag is what fires the workflows the customer has
  // already built — welcome text, pipeline placement, task assignment. We supply
  // the trigger; their existing automation does the work.
  const tags = [
    "swiftcard",
    ...(lead.capturedByCard ? [`swiftcard-${lead.capturedByCard}`] : []),
    // The lead's own tags ride along as real HighLevel tags — that is what
    // fires tag-triggered workflows. Capture-time tags are whitelisted in the
    // leads route; edit-time tags are the owner's own.
    ...(lead.tags ?? []),
  ];

  // NO tags in the upsert body. HighLevel documents that field as "will
  // overwrite all current tags associated with the contact" — so meeting a
  // known contact again, or editing one, wiped every tag the customer's own
  // pipeline had put on them ("hot-lead", "appointment-set"…) and replaced
  // them with ours. Tags go on afterwards through the Add Tags endpoint,
  // which only ever adds.
  const body: Record<string, unknown> = {
    locationId,
    firstName,
    ...(lastName ? { lastName } : {}),
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.phone ? { phone: lead.phone } : {}),
    ...(lead.company ? { companyName: lead.company } : {}),
    ...(lead.source ? { source: `SwiftCard – ${lead.source}` } : { source: "SwiftCard" }),
  };

  const res = await fetch(`${HL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: headers(conn.token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // 401 here is most often a rotated token; 403 a missing contacts.write
    // scope. Both fail every lead until someone reconnects.
    const detail = await res.text().catch(() => "");
    console.warn("[sync-highlevel] upsert failed:", res.status, detail);
    await setSyncError("highlevel", userId, connectionErrorMessage(LABEL, res.status));
    return;
  }

  let contactId: string | undefined;
  try {
    const payload = (await res.json()) as { contact?: { id?: string }; id?: string };
    contactId = payload?.contact?.id ?? payload?.id;
  } catch { /* no id, no follow-ups — the contact itself is saved */ }

  if (contactId) {
    // Additive tagging. Not best-effort in spirit — a tag is what starts the
    // customer's workflow — but a failure here must not report the saved
    // contact as lost, so it is logged rather than bannered.
    try {
      const t = await fetch(`${HL_BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
        method: "POST",
        headers: headers(conn.token),
        body: JSON.stringify({ tags }),
      });
      if (!t.ok) console.warn("[sync-highlevel] add tags failed:", t.status, await t.text().catch(() => ""));
    } catch { /* logged above when it answers at all */ }

    // Attach the capture context as a note. Best-effort: the contact is
    // already saved, and losing the note is far better than reporting a
    // working connection as broken.
    const note = describeCapture(lead);
    if (note && shouldAttachNote(opts)) {
      await fetch(`${HL_BASE}/contacts/${encodeURIComponent(contactId)}/notes`, {
        method: "POST",
        headers: headers(conn.token),
        body: JSON.stringify({ body: note }),
      }).catch(() => {});
    }
  }

  // Recovered — drop the banner, but only if one was actually showing.
  if (conn.syncError) await setSyncError("highlevel", userId, null);
}
