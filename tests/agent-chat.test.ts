import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseMentions, mentionables, isResponder, everyoneResponders, teamResponders, TEAM_LEAD } from "@/lib/agent-chat";

const read = (p: string) => readFileSync(p, "utf8");

// ── The company group chat, pinned (owner order 2026-09-08) ─────────────────
// "A messaging group chat system within my agent flow that me and all my
// agents are on. I can @ them and tell them to do certain or individual things
// or to fix certain things … it's actually working properly with every single
// agent." Every guarantee below is what makes that true; break one and the
// build fails, not the owner's afternoon.

const orgJson = JSON.parse(read("marketing-agents/org.json")) as { parties: Record<string, { name: string; kind: string; reports_to?: string; agent_id?: string }> };
const config = JSON.parse(read("marketing-agents/config.json")) as { agents: Record<string, unknown> };
const parties = Object.entries(orgJson.parties).map(([id, p]) => ({ id, ...p }));
const workers = parties.filter((p) => p.agent_id);
const leads = parties.filter((p) => p.kind === "lead");

const route = read("src/app/api/admin/agents/chat/route.ts");
const lib = read("src/lib/agent-chat.ts");
const turn = read("marketing-agents/chat-turn.mjs");
const chatLib = read("marketing-agents/lib/chat.mjs");
const agentkit = read("marketing-agents/lib/agentkit.mjs");
const watchdog = read("marketing-agents/watchdog.mjs");
const workflow = read(".github/workflows/agent-chat.yml");
const sql = read("supabase/agent-chat.sql");
const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");

describe("chat: @-mentions reach the right people", () => {
  it("first names, party ids, agent ids and team handles all resolve", () => {
    expect(parseMentions("@Jake what are you on?").responders).toEqual(["seo"]);
    expect(parseMentions("@jake @Nora").responders).toEqual(["seo", "blog"]);
    expect(parseMentions("@seo raw id").responders).toEqual(["seo"]);
    expect(parseMentions("@manager").responders).toEqual(["manager"]);
    expect(parseMentions("@Atlas how did we do?").responders).toEqual(["manager"]);
    expect(parseMentions("@marketing report back").responders).toEqual(teamResponders("maya"));
    expect(parseMentions("@engineering what's broken?").responders).toEqual(teamResponders("rex"));
  });

  it("leads are responders in their own right (they answer for the team and delegate)", () => {
    for (const l of leads) {
      expect(parseMentions(`@${l.name} hi`).responders, `@${l.name}`).toEqual([l.id]);
      expect(isResponder(l.id)).toBe(true);
    }
  });

  it("@everyone is every agent with an agent_id — once each, one run each", () => {
    const all = parseMentions("@everyone standup").responders;
    expect(all).toEqual(everyoneResponders());
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(workers.map((w) => w.agent_id!).sort());
    expect(parseMentions("@all").responders).toEqual(all);
  });

  it("no @ at all → Atlas takes it; unknown names are reported, not dropped silently", () => {
    expect(parseMentions("how did the company do this week?").responders).toEqual(["manager"]);
    const r = parseMentions("@Bob do the thing");
    expect(r.responders).toEqual(["manager"]);
    expect(r.unknown).toEqual(["Bob"]);
  });

  it("a trailing 's is forgiven, and names that end in s are not mangled (@atlas, @wes)", () => {
    expect(parseMentions("@Jake's post").responders).toEqual(["seo"]);
    expect(parseMentions("@atlas").responders).toEqual(["manager"]);
    expect(parseMentions("@wes").responders).toEqual(["forums"]);
    expect(parseMentions("@Rex, the login is broken.").responders).toEqual(["rex"]);
  });

  it("every worker and every lead is mentionable in the composer, by first name", () => {
    const handles = new Set(mentionables().map((m) => m.handle));
    for (const p of [...workers, ...leads]) expect(handles.has(p.name.toLowerCase()), `@${p.name.toLowerCase()} missing from the composer`).toBe(true);
    expect(handles.has("everyone")).toBe(true);
    for (const team of ["marketing", "growth", "success", "engineering"]) expect(handles.has(team), `@${team}`).toBe(true);
    // Every team handle points at a lead that exists.
    for (const lead of Object.values(TEAM_LEAD)) expect(orgJson.parties[lead]?.kind).toBe("lead");
  });
});

describe("chat: every single agent can actually take a turn", () => {
  it("every responder the UI can produce is one the runner can resolve", () => {
    // marketing-agents/lib/chat.mjs resolves workers through config.json and
    // leads through org.json — so every agent_id must have a config entry.
    for (const w of workers) expect(config.agents[w.agent_id!], `${w.agent_id} has no config.json entry — its chat turn would exit 2`).toBeTruthy();
    expect(chatLib).toMatch(/export function resolveResponder/);
    expect(chatLib).toMatch(/ORG\[responder\]\?\.kind === "lead"/);
    expect(chatLib).toMatch(/\["fixer"\]\.includes\(responder\)/);
  });

  it("chat turns are direct runs: they skip pause/bench gates but never the token caps", () => {
    expect(agentkit).toMatch(/export async function getChatSettings/);
    expect(agentkit).toMatch(/const direct = trigger === "chat"/);
    expect(agentkit).toMatch(/blocked = direct \? null/);
    expect(agentkit).toMatch(/if \(!this\.direct && \(settings\.paused \|\| system\.paused \|\| autoStopped\(system\)\)\)/);
    // The monthly cap is checked BEFORE the gates are skipped — chat can't overspend.
    const start = agentkit.slice(agentkit.indexOf("static async start("), agentkit.indexOf("return new Run("));
    expect(start).toMatch(/monthTokensUsed\(\)/);
    expect(start).toMatch(/monthly_usage_cap_tokens/);
    expect(turn).toMatch(/Run\.start\(agentId, "chat"\)/);
    expect(turn).toMatch(/standDownIfUsageExhausted\(run\)/);
  });

  it("the turn runner is as draft-only as every other agent", () => {
    // Only our own agent_* tables are ever written; nothing else, nowhere else.
    const forbidden = /api\.twitter\.com|graph\.facebook\.com|graph\.instagram\.com|api\.linkedin\.com|oauth\.reddit\.com|reddit\.com\/api\/submit|\/comments\/submit|chat\.postMessage/i;
    expect(turn).not.toMatch(forbidden);
    expect(chatLib).not.toMatch(forbidden);
    expect(turn).not.toMatch(/await email\(/);
    const tables = [...`${turn}\n${chatLib}`.matchAll(/\/rest\/v1\/([a-z_]+)|\.from\("([a-z_]+)"\)|sb\("([a-z_]+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const t of tables) expect(t, `chat runner writes ${t}`).toMatch(/^agent_/);
    expect(workflow).toMatch(/contents: read/);
    expect(workflow).not.toMatch(/git push/);
  });

  it("a 'fix' is a closed set of agents, and always a queue item + Fixer draft PR", () => {
    expect(turn).toMatch(/const FIX_ALLOWED = new Set\(\["perf", "security", "flowcheck", "bugwatch", "cro", "seo"\]\)/);
    expect(turn).toMatch(/const canFix = FIX_ALLOWED\.has\(agentId\)/);
    expect(turn).toMatch(/if \(!canFix \|\| !fx\?\.title\) continue/);
    expect(turn).toMatch(/await dispatchFixer\(added\.id\)/);
    expect(chatLib).toMatch(/dispatchWorkflow\("agent-fixer\.yml", \{ item_id: itemId \}\)/);
  });

  it("delegation follows the org chart: Atlas → anyone, a lead → only their own team, workers → nobody", () => {
    expect(turn).toMatch(/const canDelegate = kind === "chief" \? allWorkers\(\) : kind === "lead" \? teamOf\(party\) : \[\]/);
    expect(turn).toMatch(/if \(!canDelegate\.includes\(d\?\.to\) \|\| !d\?\.order\) continue/);
    expect(chatLib).toMatch(/p\.reports_to === leadParty/);
  });

  it("the reply always lands in the thread and closes the order, even when the turn fails", () => {
    expect(turn).toMatch(/kind: "reply"/);
    expect(turn).toMatch(/status: "done"/);
    expect(turn).toMatch(/status: "failed"/);
    expect(turn).toMatch(/'s turn failed/);
    expect(turn).toMatch(/await snapshotClaudeUsage\(\)/);
  });
});

describe("chat: the plumbing", () => {
  it("the route is admin-only, dispatches one workflow run per responder, and logs the order to comms", () => {
    expect(route).toMatch(/requireAdmin\(\)/);
    expect(route).toMatch(/GITHUB_AGENTS_TOKEN/);
    expect(route).toMatch(/const CHAT_WORKFLOW = "agent-chat\.yml"/);
    expect(route).toMatch(/inputs: \{ agent: responder, trigger: "chat" \}/);
    expect(route).toMatch(/agent_chat_orders/);
    expect(route).toMatch(/kind: "owner_in"/);
    expect(route).toMatch(/run supabase\/agent-chat\.sql/);
    // Only the owner's side is written by the route; replies come from the runner.
    expect(route).toMatch(/from_id: "owner", kind: "message"/);
    expect(route).not.toMatch(/kind: "reply"/);
  });

  it("the workflow is dispatchable, serialised per responder, and can only wake colleagues", () => {
    expect(workflow).toMatch(/workflow_dispatch/);
    expect(workflow).toMatch(/group: agent-chat-\$\{\{ github\.event\.inputs\.agent \}\}/);
    expect(workflow).toMatch(/cancel-in-progress: false/);
    expect(workflow).toMatch(/actions: write/);
    expect(workflow).toMatch(/CHAT_RESPONDER: \$\{\{ github\.event\.inputs\.agent \}\}/);
    expect(workflow).toMatch(/run: node marketing-agents\/chat-turn\.mjs "\$CHAT_RESPONDER"/);
    expect(workflow).not.toMatch(/run:.*\$\{\{ github\.event\.inputs/);
  });

  it("the schema exists and is service-role only", () => {
    expect(sql).toMatch(/create table if not exists public\.agent_chat\b/);
    expect(sql).toMatch(/create table if not exists public\.agent_chat_orders/);
    expect(sql).toMatch(/check \(kind in \('message', ?'reply', ?'system'\)\)/);
    expect(sql).toMatch(/check \(status in \('waiting', ?'working', ?'done', ?'failed'\)\)/);
    expect(sql).toMatch(/unique ?\(message_id, responder\)/);
    expect((sql.match(/enable row level security/g) ?? []).length).toBe(2);
    expect(sql).not.toMatch(/create policy/);
  });

  it("orders that never start are retried by the watchdog, and chat runs don't count as scheduled runs", () => {
    expect(watchdog).toMatch(/async function sweepChatOrders/);
    expect(watchdog).toMatch(/await sweepChatOrders\(\)/);
    expect(watchdog).toMatch(/trigger=neq\.chat/);
    expect(read("marketing-agents/scheduler.mjs")).toMatch(/trigger=neq\.chat/);
  });

  it("what the owner said in chat follows every agent into its scheduled runs", () => {
    expect(read("marketing-agents/lib/brain.mjs")).toMatch(/export async function ownerChatBlock/);
    for (const f of ["marketing-agents/run-agent.mjs", "marketing-agents/agent-blog.mjs", "marketing-agents/agent-competitors.mjs"])
      expect(read(f), `${f} must read the chat`).toMatch(/await ownerChatBlock\(/);
  });

  it("the Chat tab is wired: tab, thread, composer with @ autocomplete, unread badge, tour step", () => {
    expect(lib).toMatch(/export function mentionables/);
    expect(client).toMatch(/import \{ mentionables, partyOfResponder \} from "@\/lib\/agent-chat"/);
    expect(client).toMatch(/\["chat", "💬 Chat"\]/);
    expect(client).toMatch(/type View = "agents" \| "chat" \|/);
    expect(client).toMatch(/view: "chat", target: "chat"/);
    expect(client).toMatch(/fetch\("\/api\/admin\/agents\/chat"\)/);
    expect(client).toMatch(/method: "POST", headers: \{ "Content-Type": "application\/json" \}, body: JSON\.stringify\(\{ body: text \}\)/);
    expect(client).toMatch(/af_chat_seen/);
    expect(client).toMatch(/chatUnread > 0/);
    expect(client).toMatch(/const suggestions = /);
    expect(client).toMatch(/Shift\+Enter/);
    expect(client).toMatch(/supabase\/agent-chat\.sql/);
    expect(client).toMatch(/@everyone wakes all/);
  });
});
