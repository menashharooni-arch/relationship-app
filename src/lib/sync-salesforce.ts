import {
  getCrmConnection,
  setSyncError,
  connectionErrorMessage,
  resolveCrmOwnerId,
  describeCapture,
  type CrmLead,
} from "./crm-connection";

const SF_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const SF_API = "/services/data/v62.0";
const LABEL = "Salesforce";

/** Every API call goes to the org's own host — accept only Salesforce's (SSRF). */
export function isSalesforceInstanceUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (
      u.hostname.endsWith(".salesforce.com") || u.hostname.endsWith(".my.salesforce.com")
    );
  } catch {
    return false;
  }
}

// Leads arrive as Salesforce LEADS — the object sales teams already route,
// assign and work — with LeadSource "SwiftCard" and the full capture context
// in Description (where met, location, capture channel, the capturing card's
// URL, tags, their message). Standard fields ONLY: the HubSpot lesson —
// writing a field an org hasn't defined 400s every sync.
//
// Salesforce requires LastName and Company on a Lead. A person sharing just
// "Maya" from a card with no company must still land: LastName falls back to
// the whole name, Company to the person's name — never a hard failure over a
// sparse capture.
//
// Dedup mirrors HubSpot's: SOQL-find the Lead by email → PATCH it; none →
// POST a new one. No email → always create (nothing safe to match on).
export async function syncLeadToSalesforce(lead: CrmLead, capturedBy: string): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's; everyone else resolves to themselves. See resolveCrmOwnerId.
  const userId = await resolveCrmOwnerId("salesforce", capturedBy);
  const conn = await getCrmConnection("salesforce", LABEL, userId, lead.capturedByCardId, {
    tokenUrl: SF_TOKEN_URL,
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  });
  if (!conn) return;

  const instanceUrl = conn.metadata?.instance_url;
  if (!isSalesforceInstanceUrl(instanceUrl)) {
    await setSyncError("salesforce", userId, "Connection is missing its Salesforce org URL — reconnect Salesforce.");
    return;
  }
  const base = String(instanceUrl).replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" };

  const [firstName, ...rest] = (lead.name || "").trim().split(/\s+/);
  const fields: Record<string, string> = {
    FirstName: rest.length ? firstName : "",
    LastName: rest.length ? rest.join(" ") : (firstName || "Unknown"),
    Company: lead.company?.trim() || lead.name || "Unknown",
    LeadSource: "SwiftCard",
  };
  if (lead.email) fields.Email = lead.email;
  if (lead.phone) fields.Phone = lead.phone;
  const note = describeCapture(lead);
  if (note) fields.Description = note;

  // Existing Lead with this email? Update it instead of duplicating.
  let existingId: string | null = null;
  if (lead.email) {
    // SOQL string literal: backslash must be escaped BEFORE the quote, or a
    // trailing "\\" in the input would neutralize the closing quote's escape.
    const soqlEmail = lead.email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const soql = `SELECT Id FROM Lead WHERE Email = '${soqlEmail}' LIMIT 1`;
    const q = await fetch(`${base}${SF_API}/query?q=${encodeURIComponent(soql)}`, { headers });
    if (q.ok) {
      const d = (await q.json()) as { records?: { Id?: string }[] };
      existingId = d.records?.[0]?.Id ?? null;
    } else if (q.status === 401 || q.status === 403) {
      // 403 INVALID_SESSION or API disabled (Professional Edition) — surface it.
      await setSyncError("salesforce", userId, connectionErrorMessage(LABEL, q.status));
      return;
    }
  }

  const res = existingId
    ? await fetch(`${base}${SF_API}/sobjects/Lead/${existingId}`, { method: "PATCH", headers, body: JSON.stringify(fields) })
    : await fetch(`${base}${SF_API}/sobjects/Lead`, { method: "POST", headers, body: JSON.stringify(fields) });

  if (res.ok || res.status === 204) {
    if (conn.syncError) await setSyncError("salesforce", userId, null);
    return;
  }

  const detail = await res.text().catch(() => "");
  console.warn("[sync-salesforce] lead write failed:", res.status, detail.slice(0, 300));
  await setSyncError("salesforce", userId, connectionErrorMessage(LABEL, res.status));
}
