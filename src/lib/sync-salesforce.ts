import {
  getCrmConnection,
  setSyncError,
  connectionErrorMessage,
  resolveCrmOwnerId,
  describeCapture,
  CAPTURE_NOTE_SIGNATURE,
  type CrmLead,
  type CrmSyncOptions,
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
// URL and rep, tags, their message). Standard fields ONLY: the HubSpot
// lesson — writing a field an org hasn't defined 400s every sync.
//
// Salesforce requires LastName and Company on a NEW Lead. A person sharing
// just "Maya" from a card with no company must still land: LastName falls back
// to the whole name, Company to the person's name — never a hard failure over
// a sparse capture. Those fallbacks are for creation only: an existing Lead
// keeps the Company a rep entered rather than being renamed to the person.
//
// Dedup: SOQL-find the Lead by email. An open Lead is PATCHed. A CONVERTED one
// cannot be (Salesforce rejects every write with CANNOT_UPDATE_CONVERTED_LEAD,
// which used to raise a permanent error banner for one returning customer), so
// the new capture is logged as a completed Task on the Contact it became — the
// rep sees they met again, and no duplicate Lead is created for a customer.
// No email → always create (nothing safe to match on).

// Standard-field lengths. A longer value 400s the whole write (STRING_TOO_LONG).
const MAX = { FirstName: 40, LastName: 80, Company: 255, Email: 80, Phone: 40, Description: 32000 } as const;
const clip = (v: string, n: number) => (v.length > n ? v.slice(0, n) : v);

export async function syncLeadToSalesforce(lead: CrmLead, capturedBy: string, opts?: CrmSyncOptions): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's; everyone else resolves to themselves. See resolveCrmOwnerId.
  const userId = await resolveCrmOwnerId("salesforce", capturedBy);
  const conn = await getCrmConnection("salesforce", LABEL, userId, lead.capturedByCardId, capturedBy, {
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
  const note = describeCapture(lead);

  // Existing Lead with this email? Open ones first, newest first.
  type Found = { Id?: string; IsConverted?: boolean; ConvertedContactId?: string | null; Description?: string | null };
  let existing: Found | null = null;
  if (lead.email) {
    // SOQL string literal: backslash must be escaped BEFORE the quote, or a
    // trailing "\\" in the input would neutralize the closing quote's escape.
    const soqlEmail = lead.email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const soql = `SELECT Id, IsConverted, ConvertedContactId, Description FROM Lead WHERE Email = '${soqlEmail}' ORDER BY IsConverted ASC, CreatedDate DESC LIMIT 1`;
    const q = await fetch(`${base}${SF_API}/query?q=${encodeURIComponent(soql)}`, { headers });
    if (q.ok) {
      const d = (await q.json()) as { records?: Found[] };
      existing = d.records?.[0] ?? null;
    } else if (q.status === 401 || q.status === 403) {
      // 403 INVALID_SESSION or API disabled (Professional Edition) — surface it.
      await setSyncError("salesforce", userId, connectionErrorMessage(LABEL, q.status));
      return;
    }
  }

  // Orgs ship with fuzzy duplicate rules (similar name + company blocks the
  // save with a 400 DUPLICATES_DETECTED) — which drops real leads: two people
  // from the same company scanning the same card LOOK like duplicates. We
  // already dedup by exact email above, so tell Salesforce to save anyway.
  const writeHeaders = { ...headers, "Sforce-Duplicate-Rule-Header": "allowSave=true" };

  // Already a customer: log the touch on their Contact instead.
  if (existing?.Id && existing.IsConverted) {
    if (existing.ConvertedContactId && note && (opts?.mode ?? "capture") === "capture") {
      const t = await fetch(`${base}${SF_API}/sobjects/Task`, {
        method: "POST",
        headers: writeHeaders,
        body: JSON.stringify({
          WhoId: existing.ConvertedContactId,
          Subject: "Met again — captured with SwiftCard",
          Status: "Completed",
          ActivityDate: new Date().toISOString().slice(0, 10),
          Description: clip(note, MAX.Description),
        }),
      }).catch(() => null);
      if (t && !t.ok) console.warn("[sync-salesforce] task on converted lead failed:", t.status, (await t.text().catch(() => "")).slice(0, 300));
    }
    if (conn.syncError) await setSyncError("salesforce", userId, null);
    return;
  }

  let res: Response;
  if (existing?.Id) {
    const fields: Record<string, string> = { LastName: clip(rest.length ? rest.join(" ") : (firstName || "Unknown"), MAX.LastName) };
    if (rest.length) fields.FirstName = clip(firstName, MAX.FirstName);
    // Only a REAL company replaces what the rep has; never the name fallback.
    if (lead.company?.trim()) fields.Company = clip(lead.company.trim(), MAX.Company);
    if (lead.phone) fields.Phone = clip(lead.phone, MAX.Phone);
    // Description is ours to refresh only while it is empty or still the note
    // we wrote. Once a rep has written in it, it is theirs.
    const current = (existing.Description ?? "").trim();
    if (note && (!current || current.endsWith(CAPTURE_NOTE_SIGNATURE))) fields.Description = clip(note, MAX.Description);
    res = await fetch(`${base}${SF_API}/sobjects/Lead/${existing.Id}`, { method: "PATCH", headers: writeHeaders, body: JSON.stringify(fields) });
  } else {
    const fields: Record<string, string> = {
      FirstName: rest.length ? clip(firstName, MAX.FirstName) : "",
      LastName: clip(rest.length ? rest.join(" ") : (firstName || "Unknown"), MAX.LastName),
      Company: clip(lead.company?.trim() || lead.name || "Unknown", MAX.Company),
      LeadSource: "SwiftCard",
    };
    if (lead.email) fields.Email = clip(lead.email, MAX.Email);
    if (lead.phone) fields.Phone = clip(lead.phone, MAX.Phone);
    if (note) fields.Description = clip(note, MAX.Description);
    res = await fetch(`${base}${SF_API}/sobjects/Lead`, { method: "POST", headers: writeHeaders, body: JSON.stringify(fields) });
  }

  if (res.ok || res.status === 204) {
    if (conn.syncError) await setSyncError("salesforce", userId, null);
    return;
  }

  const detail = await res.text().catch(() => "");
  console.warn("[sync-salesforce] lead write failed:", res.status, detail.slice(0, 300));
  await setSyncError("salesforce", userId, connectionErrorMessage(LABEL, res.status));
}
