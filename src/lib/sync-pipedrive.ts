import {
  getCrmConnection,
  setSyncError,
  connectionErrorMessage,
  resolveCrmOwnerId,
  describeCapture,
  type CrmLead,
} from "./crm-connection";

// ── Pipedrive ────────────────────────────────────────────────────────────────
//
// Connected with a personal API token the user pastes (Settings → Personal
// preferences → API). No OAuth app, so nothing here waits on Pipedrive's
// marketplace review.
//
// Two API versions on purpose, and both are current:
//   • Persons  → /api/v2/persons. v1 Persons is being SUNSET, so v2 is the only
//     correct target. v2 also requires the x-api-token HEADER — it does not
//     accept the old ?api_token= query parameter, which keeps the token out of
//     request URLs and logs.
//   • Notes    → /v1/notes. Notes is explicitly NOT in Pipedrive's deprecation
//     list and has no v2 equivalent, so v1 is right here rather than legacy.
//
// The note is what makes this worth having. A Person row holds name, email and
// phone — the same thing any generic connector produces. The note carries where
// you met, how the card was tapped and which rep captured it, on the timeline a
// salesperson actually reads before calling back.

const LABEL = "Pipedrive";
// Fallback host. The company-specific domain is discovered on connect and kept
// in metadata; this is only used if that lookup never ran.
const DEFAULT_HOST = "https://api.pipedrive.com";

function hostFor(metadata: Record<string, unknown>): string {
  const domain = typeof metadata.api_domain === "string" ? metadata.api_domain.trim() : "";
  if (!domain) return DEFAULT_HOST;
  return domain.startsWith("http") ? domain.replace(/\/+$/, "") : `https://${domain}`;
}

/** Look up the account's own API host. Returns null if the token is bad. */
export async function fetchPipedriveDomain(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${DEFAULT_HOST}/v1/users/me`, {
      headers: { "x-api-token": token },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { company_domain?: string } };
    const domain = body?.data?.company_domain;
    return domain ? `https://${domain}.pipedrive.com` : null;
  } catch {
    return null;
  }
}

export async function syncLeadToPipedrive(lead: CrmLead, capturedBy: string): Promise<void> {
  // An office sub-user with no connection of their own inherits the office
  // owner's, so a whole team's leads land in the agency's Pipedrive.
  const userId = await resolveCrmOwnerId("pipedrive", capturedBy);
  // No refresh config: personal API tokens don't expire, so expires_at is null
  // and the refresh branch never runs.
  const conn = await getCrmConnection("pipedrive", LABEL, userId, lead.capturedByCardId);
  if (!conn) return;

  const host = hostFor(conn.metadata);

  const person: Record<string, unknown> = { name: lead.name };
  if (lead.email) person.emails = [{ value: lead.email, primary: true, label: "work" }];
  if (lead.phone) person.phones = [{ value: lead.phone, primary: true, label: "mobile" }];

  const res = await fetch(`${host}/api/v2/persons`, {
    method: "POST",
    headers: { "x-api-token": conn.token, "Content-Type": "application/json" },
    body: JSON.stringify(person),
  });

  if (!res.ok) {
    // 401/403 here usually means the token was regenerated (Pipedrive allows
    // only ONE active token per user, so creating a new one silently kills
    // ours) or an admin switched off API access for that permission set.
    const detail = await res.text().catch(() => "");
    console.warn("[sync-pipedrive] createPerson failed:", res.status, detail);
    await setSyncError("pipedrive", userId, connectionErrorMessage(LABEL, res.status));
    return;
  }

  // Attach the capture context. Best-effort by design: the person is already
  // saved, and losing the note is far better than reporting the whole sync as
  // failed and sending someone to reconnect a connection that works.
  try {
    const body = (await res.json()) as { data?: { id?: number } };
    const personId = body?.data?.id;
    const note = describeCapture(lead);
    if (personId && note) {
      await fetch(`${host}/v1/notes`, {
        method: "POST",
        headers: { "x-api-token": conn.token, "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: personId, content: note }),
      });
    }
  } catch {
    /* note is a bonus, never a failure */
  }

  // Recovered — drop the banner, but only if one was actually showing.
  if (conn.syncError) await setSyncError("pipedrive", userId, null);
}
