// ── The agent company org, shared by the Agent Flow tab and its API routes ───
// Source of truth is marketing-agents/org.json (the runners read the same
// file), so a rename or a re-org happens in exactly one place.
import orgJson from "../../marketing-agents/org.json";

export type Party = {
  name: string;
  role: string;
  emoji: string;
  color: string;
  kind: "human" | "chief" | "lead" | "worker";
  reports_to?: string;
  agent_id?: string;
};

export const ORG: Record<string, Party> = orgJson.parties as Record<string, Party>;

/** agent_settings agent_id → org party id (e.g. "seo" → "jake"). */
export const PARTY_BY_AGENT: Record<string, string> = Object.fromEntries(
  Object.entries(ORG).filter(([, p]) => p.agent_id).map(([pid, p]) => [p.agent_id!, pid]),
);

export function partyOf(agentId: string): string {
  return PARTY_BY_AGENT[agentId] ?? agentId;
}

/** Display name for either a party id or a raw agent_id: "Jake · SEO". */
export function displayName(id: string): string {
  const p = ORG[id] ?? ORG[partyOf(id)];
  return p ? `${p.name} · ${p.role}` : id;
}

export function firstName(id: string): string {
  const p = ORG[id] ?? ORG[partyOf(id)];
  return p?.name ?? id;
}
