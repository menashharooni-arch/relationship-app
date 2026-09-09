// ── The company group chat: who an @-mention reaches ────────────────────────
// Shared by the chat API route (server) and the Chat tab (client autocomplete),
// and pinned by tests/agent-chat.test.ts. Source of truth is org.json, so a
// new agent is mentionable the moment it joins the org.
//
// A "responder" is the id a chat turn runs as: a runnable agent_id ("seo",
// "manager") or a lead's party id ("maya") — leads have no agent_settings row
// but do take chat turns (they answer for their team and delegate).
import { ORG, type Party } from "./agent-org";

export type Mentionable = { handle: string; responders: string[]; label: string; emoji: string; kind: "everyone" | "chief" | "team" | "lead" | "worker" };

const parties = Object.entries(ORG) as Array<[string, Party]>;

/** Team handle → the lead that owns it (matches the TEAMS ids in the tab). */
export const TEAM_LEAD: Record<string, string> = { marketing: "maya", growth: "sasha", strategy: "theo", success: "nina", engineering: "rex", protection: "rex", watchdogs: "rex" };

/** The responder id a party runs its chat turn as. */
export function responderOf(partyId: string): string | null {
  const p = ORG[partyId];
  if (!p) return null;
  if (p.kind === "human") return null;
  if (p.agent_id) return p.agent_id;
  if (p.kind === "lead") return partyId;
  return null;
}

/** Every runnable worker (plus Atlas) — what @everyone reaches. */
export function everyoneResponders(): string[] {
  return parties.filter(([, p]) => p.agent_id).map(([, p]) => p.agent_id!);
}

/** The workers reporting to a lead, as responder ids. */
export function teamResponders(leadId: string): string[] {
  return parties.filter(([, p]) => p.kind === "worker" && p.reports_to === leadId && p.agent_id).map(([, p]) => p.agent_id!);
}

/** The party id behind a responder id ("seo" → "jake", "maya" → "maya"). */
export function partyOfResponder(responder: string): string {
  const hit = parties.find(([id, p]) => p.agent_id === responder || id === responder);
  return hit ? hit[0] : responder;
}

/** Everything the composer can autocomplete, in the order it should list them. */
export function mentionables(): Mentionable[] {
  const out: Mentionable[] = [
    { handle: "everyone", responders: everyoneResponders(), label: "Everyone — every agent takes a turn (one run each)", emoji: "📢", kind: "everyone" },
  ];
  for (const [id, p] of parties) {
    if (p.kind === "chief") out.push({ handle: p.name.toLowerCase(), responders: [responderOf(id)!], label: `${p.name} · ${p.role}`, emoji: p.emoji, kind: "chief" });
  }
  for (const [team, lead] of Object.entries(TEAM_LEAD)) {
    if (team === "protection" || team === "watchdogs") continue;
    const p = ORG[lead];
    out.push({ handle: team, responders: teamResponders(lead), label: `${p.name}'s whole team (${teamResponders(lead).length} agents)`, emoji: p.emoji, kind: "team" });
  }
  for (const [id, p] of parties) {
    if (p.kind === "lead") out.push({ handle: p.name.toLowerCase(), responders: [id], label: `${p.name} · ${p.role}`, emoji: p.emoji, kind: "lead" });
  }
  for (const [id, p] of parties) {
    if (p.kind === "worker") out.push({ handle: p.name.toLowerCase(), responders: [responderOf(id)!], label: `${p.name} · ${p.role}`, emoji: p.emoji, kind: "worker" });
  }
  return out;
}

/**
 * Parse the @-mentions in an owner message into the ordered, de-duplicated
 * list of responders. Names, party ids, agent ids and team handles all work,
 * case-insensitively, with a trailing 's / punctuation forgiven ("@Jake's").
 * No mention at all → Atlas takes it (he is the chief of staff).
 */
export function parseMentions(text: string): { responders: string[]; unknown: string[] } {
  const responders: string[] = [];
  const unknown: string[] = [];
  const add = (ids: string[]) => { for (const id of ids) if (!responders.includes(id)) responders.push(id); };
  const re = /@([a-z0-9_'-]+)/gi;
  let m: RegExpExecArray | null;
  const resolve = (token: string): string[] | null => {
    if (token === "everyone" || token === "all" || token === "everybody" || token === "team") return everyoneResponders();
    if (TEAM_LEAD[token]) return teamResponders(TEAM_LEAD[token]);
    // A party by id or by first name (the owner is not a responder).
    const byParty = parties.find(([id, p]) => id === token || p.name.toLowerCase() === token);
    if (byParty) { const r = responderOf(byParty[0]); return r ? [r] : []; }
    // A raw agent_id ("@seo", "@manager").
    const byAgent = parties.find(([, p]) => p.agent_id === token);
    if (byAgent) return [byAgent[1].agent_id!];
    return null;
  };
  while ((m = re.exec(text))) {
    const base = m[1].toLowerCase().replace(/['-]+$/, "");
    // Exact first ("@atlas", "@wes"), then with a possessive/plural stripped ("@jake's", "@jakes").
    const candidates = [base, base.replace(/'s$/, ""), base.replace(/s$/, "")];
    let hit: string[] | null = null;
    for (const c of candidates) { if (!c) continue; hit = resolve(c); if (hit) break; }
    if (hit) add(hit);
    else if (base.length > 1) unknown.push(m[1]);
  }
  if (!responders.length) add(["manager"]);
  return { responders, unknown };
}

/** True when the responder id names someone who can take a chat turn. */
export function isResponder(id: string): boolean {
  return parties.some(([pid, p]) => p.agent_id === id || (pid === id && p.kind === "lead"));
}
