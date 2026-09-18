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

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PEOPLE_API = "https://people.googleapis.com/v1";
const GOOGLE_PEOPLE_URL = `${PEOPLE_API}/people:createContact`;
const LABEL = "Google Contacts";
const READ_MASK = "names,emailAddresses,phoneNumbers,organizations,biographies";

type Person = {
  resourceName?: string;
  etag?: string;
  names?: { givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string; type?: string }[];
  phoneNumbers?: { value?: string; type?: string }[];
  organizations?: { name?: string; title?: string }[];
  biographies?: { value?: string; contentType?: string }[];
};

const digits = (v: string | undefined | null) => (v ?? "").replace(/\D/g, "");

/**
 * The contact already in the address book with this email, or null.
 *
 * searchContacts is a prefix search over a CACHE, and Google's own docs say the
 * cache has to be warmed with an empty query before results can be trusted — so
 * the warm-up call is not optional. Only an EXACT email match counts: a prefix
 * hit on "jo@acme.co" must never update "jo@acme.com".
 *
 * Any failure here returns null and the caller creates, which is exactly the
 * behaviour before this lookup existed — a search problem can cost a duplicate,
 * never a lost contact.
 */
async function findByEmail(token: string, email: string): Promise<Person | null> {
  const headers = { Authorization: `Bearer ${token}` };
  const search = (q: string) =>
    fetch(`${PEOPLE_API}/people:searchContacts?query=${encodeURIComponent(q)}&readMask=${READ_MASK}&pageSize=10`, { headers });
  try {
    await search("");
    const res = await search(email);
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: { person?: Person }[] };
    const want = email.trim().toLowerCase();
    for (const r of body.results ?? []) {
      if (r.person?.emailAddresses?.some((e) => (e.value ?? "").trim().toLowerCase() === want)) return r.person;
    }
  } catch { /* fall through to create */ }
  return null;
}

// Google Contacts is an address book, not a CRM, so the capture context lives
// in the contact's Notes (the People API calls it "biographies").
export async function syncLeadToGoogle(lead: CrmLead, capturedBy: string, opts?: CrmSyncOptions): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's; everyone else resolves to themselves. See resolveCrmOwnerId.
  const userId = await resolveCrmOwnerId("google", capturedBy);
  const conn = await getCrmConnection("google", LABEL, userId, lead.capturedByCardId, capturedBy, {
    tokenUrl: GOOGLE_TOKEN_URL,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  if (!conn) return;

  const [givenName, ...rest] = (lead.name || "").trim().split(/\s+/);
  const familyName = rest.join(" ") || undefined;
  const note = describeCapture(lead);

  const existing = lead.email ? await findByEmail(conn.token, lead.email) : null;

  let res: Response;
  if (existing?.resourceName && existing.etag) {
    // UPDATE IN PLACE. Every field named in updatePersonFields is replaced
    // wholesale, so each list is the contact's existing entries PLUS ours —
    // a second phone number or work address someone saved by hand survives.
    const emails = [...(existing.emailAddresses ?? [])];
    if (lead.email && !emails.some((e) => (e.value ?? "").toLowerCase() === lead.email!.toLowerCase())) emails.push({ value: lead.email });
    const phones = [...(existing.phoneNumbers ?? [])];
    if (lead.phone && !phones.some((p) => digits(p.value) === digits(lead.phone))) phones.push({ value: lead.phone });
    const orgs = [...(existing.organizations ?? [])];
    if (lead.company) {
      if (orgs.length) orgs[0] = { ...orgs[0], name: lead.company };
      else orgs.push({ name: lead.company });
    }
    // Notes are only written when they are EMPTY or ours. Someone's own notes
    // in their address book are theirs; overwriting them to refresh a
    // capture summary would be data loss.
    const currentBio = existing.biographies?.[0]?.value ?? "";
    const bioIsOurs = !currentBio.trim() || currentBio.trim().endsWith(CAPTURE_NOTE_SIGNATURE);
    const body: Person = {
      etag: existing.etag,
      names: [{ givenName, familyName }],
      emailAddresses: emails,
      phoneNumbers: phones,
      organizations: orgs,
      ...(note && bioIsOurs ? { biographies: [{ value: note, contentType: "TEXT_PLAIN" }] } : { biographies: existing.biographies ?? [] }),
    };
    res = await fetch(`${PEOPLE_API}/${existing.resourceName}:updateContact?updatePersonFields=${READ_MASK}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else if ((opts?.mode ?? "capture") === "update") {
    // An edit to a contact we can't find. Creating one here would mint a
    // duplicate whenever Google's search cache is behind (it lags minutes), so
    // an edit only ever updates. New contacts come from the capture path.
    return;
  } else {
    const body: Record<string, unknown> = { names: [{ givenName, familyName }] };
    if (lead.email) body.emailAddresses = [{ value: lead.email }];
    if (lead.phone) body.phoneNumbers = [{ value: lead.phone }];
    if (lead.company) body.organizations = [{ name: lead.company }];
    if (note) body.biographies = [{ value: note, contentType: "TEXT_PLAIN" }];
    res = await fetch(GOOGLE_PEOPLE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    // A VALID token can still be refused — most often because the People API
    // isn't enabled on the Google Cloud project, or the user never granted the
    // contacts scope. Both return 403 on every single lead, forever, while
    // Settings kept showing a healthy "Connected".
    const detail = await res.text().catch(() => "");
    console.warn("[sync-google] contact write failed:", res.status, detail);
    await setSyncError("google", userId, connectionErrorMessage(LABEL, res.status));
    return;
  }

  // Recovered — drop the banner, but only if one was actually showing.
  if (conn.syncError) await setSyncError("google", userId, null);
}
