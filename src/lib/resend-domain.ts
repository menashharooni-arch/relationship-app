// Resend domain management for marketing email. Lets the admin panel create
// the sending domain, read the DNS records to add, and check verification —
// and lets senders pick the right from-address automatically once verified.

const RESEND_API = "https://api.resend.com";
const DOMAIN = "swiftcard.me";

type ResendRecord = { record: string; name: string; type: string; value: string; ttl?: string; priority?: number; status?: string };
export type DomainStatus = {
  configured: boolean;          // RESEND_API_KEY present
  exists: boolean;              // domain created in Resend
  status: string;               // not_started | pending | verified | failed | …
  records: ResendRecord[];
  /** Open/click tracking as Resend reports it AFTER ensureDomain() has had its
   *  say — both must be false; see disableTracking(). */
  tracking?: { open: boolean; click: boolean };
  error?: string;
};

function headers() {
  return { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" };
}

async function findDomain(): Promise<{ id: string; status: string } | null> {
  const res = await fetch(`${RESEND_API}/domains`, { headers: headers() });
  if (!res.ok) throw new Error(`Resend domains list failed (${res.status})`);
  const data = (await res.json()) as { data?: { id: string; name: string; status: string }[] };
  return data.data?.find((d) => d.name === DOMAIN) ?? null;
}

type DomainDetail = { status: string; records: ResendRecord[]; tracking: { open: boolean; click: boolean } };

async function domainDetail(id: string): Promise<DomainDetail> {
  const res = await fetch(`${RESEND_API}/domains/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Resend domain read failed (${res.status})`);
  const d = (await res.json()) as { status: string; records?: ResendRecord[]; open_tracking?: boolean; click_tracking?: boolean };
  return { status: d.status, records: d.records ?? [], tracking: { open: d.open_tracking === true, click: d.click_tracking === true } };
}

// Open and click tracking are OFF for this domain, and stay off.
//
// Click tracking rewrites every link in the body to Resend's tracking host,
// so a card link that reads swiftcard.me/dana in the text points somewhere
// else when hovered — the exact link/text mismatch spam filters (and Gmail's
// "suspicious link" banner) exist to catch — and it does it on mail sent
// under a user's name to one person. Open tracking adds an invisible remote
// pixel, the other classic bulk-mail marker. Neither is worth a single message
// in a spam folder. This is a dashboard toggle anyone can flip by accident;
// enforcing it from code on every status read makes the mistake self-healing.
// PATCH /domains/{id} — https://resend.com/docs/api-reference/domains/update-domain
async function disableTracking(id: string, current: DomainDetail["tracking"]): Promise<DomainDetail["tracking"]> {
  if (!current.open && !current.click) return current;
  try {
    const res = await fetch(`${RESEND_API}/domains/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ open_tracking: false, click_tracking: false }),
    });
    if (res.ok) return { open: false, click: false };
  } catch { /* reported through the returned state, below */ }
  // Still on: the admin panel shows it in red rather than this hiding the
  // domain's verified status behind an error.
  return current;
}

// Current state; creates the domain in Resend on first call so the DNS
// records are immediately available to show the admin.
export async function ensureDomain(): Promise<DomainStatus> {
  if (!process.env.RESEND_API_KEY) {
    return { configured: false, exists: false, status: "no_api_key", records: [], error: "RESEND_API_KEY is not set" };
  }
  try {
    let found = await findDomain();
    if (!found) {
      const res = await fetch(`${RESEND_API}/domains`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: DOMAIN }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { configured: true, exists: false, status: "create_failed", records: [], error: `Couldn't create domain: ${err.slice(0, 200)}` };
      }
      const created = (await res.json()) as { id: string; status: string };
      found = { id: created.id, status: created.status };
    }
    const detail = await domainDetail(found.id);
    const tracking = await disableTracking(found.id, detail.tracking);
    return { configured: true, exists: true, status: detail.status, records: detail.records, tracking };
  } catch (e) {
    return { configured: true, exists: false, status: "error", records: [], error: String(e) };
  }
}

// Ask Resend to (re)check the DNS records now.
export async function verifyDomain(): Promise<DomainStatus> {
  if (!process.env.RESEND_API_KEY) {
    return { configured: false, exists: false, status: "no_api_key", records: [], error: "RESEND_API_KEY is not set" };
  }
  try {
    const found = await findDomain();
    if (!found) return ensureDomain();
    await fetch(`${RESEND_API}/domains/${found.id}/verify`, { method: "POST", headers: headers() });
    const detail = await domainDetail(found.id);
    const tracking = await disableTracking(found.id, detail.tracking);
    return { configured: true, exists: true, status: detail.status, records: detail.records, tracking };
  } catch (e) {
    return { configured: true, exists: false, status: "error", records: [], error: String(e) };
  }
}

// From-address for marketing sends: explicit env var wins; otherwise use the
// branded address once the domain is verified; fall back to Resend's sandbox
// sender (which only delivers to the account owner). Cached for 5 minutes so
// bulk sends don't hit the Resend API per-recipient.
// getMarketingFrom() is GONE. It returned RESEND_FROM_EMAIL first and was
// spread over the template's own sender, so setting MARKETING_FROM_EMAIL never
// had any effect — campaigns kept shipping from the transactional address and
// the marketing/transactional split silently did not exist. Worse, its
// fallback was the Resend shared sandbox domain, which is unauthenticated for
// us and would have stamped a real customer name onto it.
//
// Sender selection now lives in ONE place: src/lib/email-senders.ts.
