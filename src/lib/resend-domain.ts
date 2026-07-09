// Resend domain management for marketing email. Lets the admin panel create
// the sending domain, read the DNS records to add, and check verification —
// and lets senders pick the right from-address automatically once verified.

const RESEND_API = "https://api.resend.com";
const DOMAIN = "swiftcard.me";
const VERIFIED_FROM = "SwiftCard <hello@swiftcard.me>";
const FALLBACK_FROM = "SwiftCard <onboarding@resend.dev>";

type ResendRecord = { record: string; name: string; type: string; value: string; ttl?: string; priority?: number; status?: string };
export type DomainStatus = {
  configured: boolean;          // RESEND_API_KEY present
  exists: boolean;              // domain created in Resend
  status: string;               // not_started | pending | verified | failed | …
  records: ResendRecord[];
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

async function domainDetail(id: string): Promise<{ status: string; records: ResendRecord[] }> {
  const res = await fetch(`${RESEND_API}/domains/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Resend domain read failed (${res.status})`);
  const d = (await res.json()) as { status: string; records?: ResendRecord[] };
  return { status: d.status, records: d.records ?? [] };
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
    return { configured: true, exists: true, status: detail.status, records: detail.records };
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
    return { configured: true, exists: true, status: detail.status, records: detail.records };
  } catch (e) {
    return { configured: true, exists: false, status: "error", records: [], error: String(e) };
  }
}

// From-address for marketing sends: explicit env var wins; otherwise use the
// branded address once the domain is verified; fall back to Resend's sandbox
// sender (which only delivers to the account owner). Cached for 5 minutes so
// bulk sends don't hit the Resend API per-recipient.
let fromCache: { value: string; at: number } | null = null;
export async function getMarketingFrom(): Promise<string> {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  if (fromCache && Date.now() - fromCache.at < 5 * 60_000) return fromCache.value;
  let value = FALLBACK_FROM;
  try {
    const found = process.env.RESEND_API_KEY ? await findDomain() : null;
    if (found?.status === "verified") value = VERIFIED_FROM;
  } catch {
    /* fall back */
  }
  fromCache = { value, at: Date.now() };
  return value;
}
