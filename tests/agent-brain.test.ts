import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

// ── The Agent Flow BRAIN, pinned (owner order 2026-09-08) ────────────────────
// "All my agents should have a brain like that": every agent researches its
// role (a playbook, with its own working rhythm), researches what to make
// today, hands the owner TWO finished options, and the one he picks goes out.
// These tests make that contract a build failure to break.

const config = JSON.parse(read("marketing-agents/config.json")) as {
  agents: Record<string, { workflow?: string; default_schedule?: string; continuous?: boolean; mode?: string }>;
};
const orgJson = JSON.parse(read("marketing-agents/org.json")) as { parties: Record<string, { kind: string; reports_to?: string; agent_id?: string }> };
const parties = Object.entries(orgJson.parties).map(([id, p]) => ({ id, ...p }));
const brain = read("marketing-agents/lib/brain.mjs");
const runner = read("marketing-agents/run-agent.mjs");
const itemsRoute = read("src/app/api/admin/agents/items/route.ts");
const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");

// Agents whose runs are LLM-driven (the code-only watchdogs and the Fixer are
// wired differently and carry no playbook).
const LLM_AGENTS = Object.entries(config.agents)
  .filter(([id, a]) => !a.continuous && id !== "fixer" && id !== "manager")
  .map(([id]) => id);

describe("brain: every LLM agent researches its role and works from a playbook", () => {
  it("the shared brain owns playbooks, two-option queuing and the tell filter", () => {
    expect(brain).toMatch(/export async function ensurePlaybook/);
    expect(brain).toMatch(/export async function queueChoice/);
    expect(brain).toMatch(/export const TWO_OPTIONS_RULES/);
    expect(brain).toMatch(/const AI_TELLS = \[/);
    expect(brain).toMatch(/agent_playbooks/);
  });

  it("the generic runner, the blog writer and the competitor watch all run on the brain", () => {
    for (const f of ["marketing-agents/run-agent.mjs", "marketing-agents/agent-blog.mjs", "marketing-agents/agent-competitors.mjs"]) {
      const src = read(f);
      expect(src, `${f} must import the brain`).toMatch(/from "\.\/lib\/brain\.mjs"/);
      expect(src, `${f} must build its playbook`).toMatch(/ensurePlaybook\(/);
      expect(src, `${f} must queue two options`).toMatch(/queueChoice\(/);
    }
  });

  it("every LLM agent has a brief, a workflow, a config entry, an org party and a seed", () => {
    const seed = read("supabase/agent-flow.sql");
    for (const id of LLM_AGENTS) {
      const a = config.agents[id];
      expect(existsSync(`marketing-agents/agents/${id}.md`), `${id} needs a brief`).toBe(true);
      expect(a.workflow, `${id} needs a workflow`).toBeTruthy();
      expect(existsSync(`.github/workflows/${a.workflow}`), `${id}'s workflow file ${a.workflow} is missing`).toBe(true);
      expect(parties.some((p) => p.agent_id === id), `${id} needs an org party`).toBe(true);
      expect(seed, `${id} needs an agent_settings seed`).toContain(`('${id}'`);
      expect(client, `${id} needs a role in the UI`).toMatch(new RegExp(`(^|[\\s{,])${id}: "`, "m"));
    }
  });

  it("every LLM agent's brief tells it to research first and to hand over TWO options", () => {
    for (const id of LLM_AGENTS) {
      const brief = read(`marketing-agents/agents/${id}.md`);
      expect(brief, `${id}.md must research before writing`).toMatch(/research/i);
      expect(brief, `${id}.md must produce two options`).toMatch(/TWO (options|complete)|two options|OPTION A|A and B/);
    }
  });

  it("the playbook writes a rhythm the clock understands — and never overrides the owner's", () => {
    // The owner's hand outranks research: 'owner' source is never touched.
    expect(brain).toMatch(/schedule_source === "owner"\) return/);
    expect(brain).toMatch(/schedule_source: "playbook"/);
    expect(brain).toMatch(/isValidSchedule\(/);
    const settings = read("src/app/api/admin/agents/settings/route.ts");
    expect(settings).toMatch(/schedule_source = patch\.schedule \? "owner" : "default"/);
    // The weekly grammar the playbook uses ("a few times a week") is real.
    const sched = read("marketing-agents/lib/schedule.mjs");
    expect(sched).toMatch(/weekly@\(sun\|mon\|tue\|wed\|thu\|fri\|sat\)/);
    expect(client).toMatch(/weekly@/);
  });
});

describe("brain: two options in, one picked, and it goes out", () => {
  it("a choice item carries exactly two finished options, A and B", () => {
    expect(brain).toMatch(/if \(options\.length < 2\) return/);
    expect(brain).toMatch(/options\.slice\(0, 2\)/);
    expect(brain).toMatch(/label: i === 0 \? "A" : "B"/);
    expect(brain).toMatch(/item_type: "choice"/);
  });

  it("person-facing options pass the AI-tell filter before they are queued", () => {
    expect(brain).toMatch(/if \(personFacing\)/);
    expect(runner).toMatch(/queueChoice\(run, it, \{ personFacing: PERSON_FACING\.has\(agentId\) \}\)/);
  });

  it("choose is admin-gated, one item at a time, and takes the same road as Approve", () => {
    expect(itemsRoute).toMatch(/requireAdmin/);
    expect(itemsRoute).toMatch(/requested === "choose" && \(ids\.length !== 1 \|\| !\(optionIndex === 0 \|\| optionIndex === 1\)\)/);
    expect(itemsRoute).toMatch(/function resolveChoice/);
    // Once resolved the item is approved — the connector posts it or it is
    // saved for the copy flow; a chosen blog post goes live in the same step.
    expect(itemsRoute).toMatch(/const action = chosen \? "approved" : requested/);
    expect(itemsRoute).toMatch(/\(chosen && item\.item_type === "blog_post"\)/);
    // A two-option item can never be bulk-approved past the owner's pick.
    expect(itemsRoute).toMatch(/item\.item_type === "choice" && \(requested === "approved"/);
    expect(client).toMatch(/i\.status === "pending" && i\.item_type !== "choice"/);
  });

  it("the UI shows A and B side by side with a pick for each and a Neither", () => {
    expect(client).toMatch(/choice: "Pick A or B"/);
    expect(client).toMatch(/act\(\[it\.id\], "choose", undefined, idx\)/);
    expect(client).toMatch(/Neither/);
  });
});

describe("brain: the competitor watch spends nothing when nothing changed", () => {
  const src = read("marketing-agents/agent-competitors.mjs");
  it("hashes every tracked page and only wakes the model on a real change or the Monday sweep", () => {
    expect(src).toMatch(/agent_competitor_snapshots/);
    expect(src).toMatch(/if \(!changes\.length && !doSweep\)/);
    expect(src).toMatch(/No tokens spent/);
    expect(src.indexOf("No tokens spent")).toBeLessThan(src.indexOf("askClaude("));
    expect(src).toMatch(/nyWeekday\(\) === "mon"/);
  });

  it("starts with Blinq and HiHello seeded and lets the owner add more from a found item", () => {
    const sql = read("supabase/agent-brain.sql");
    expect(sql).toMatch(/agent_competitors/);
    expect(sql).toMatch(/'blinq'/);
    expect(sql).toMatch(/'hihello'/);
    expect(itemsRoute).toMatch(/item\.item_type === "competitor_found" && optionIndex === 0\) await addCompetitor/);
  });
});

describe("brain: the roster covers every free channel the owner named", () => {
  it("link-in-bio prospecting, industry outreach, Reddit, forums, partners, listings, reviews, support, retention, video, email, CRO, competitors", () => {
    for (const id of ["prospects", "industry", "mentions", "forums", "partners", "listings", "reviews", "support", "retention", "video", "email", "cro", "competitors"])
      expect(config.agents[id], `${id} is missing from config`).toBeTruthy();
    const prospects = read("marketing-agents/agents/prospects.md");
    for (const tool of ["Linktree", "LinkMe", "HiHello"]) expect(prospects).toContain(tool);
    expect(read("marketing-agents/agents/industry.md")).toMatch(/realtor|real estate/i);
    expect(read("marketing-agents/agents/competitors.md")).toMatch(/Blinq/);
  });

  it("every worker reports to a lead and every lead to the chief", () => {
    const byId = new Map(parties.map((p) => [p.id, p]));
    for (const p of parties) {
      if (p.kind === "worker") expect(byId.get(p.reports_to ?? "")?.kind, `${p.id} must report to a lead`).toBe("lead");
      if (p.kind === "lead") expect(byId.get(p.reports_to ?? "")?.kind, `${p.id} must report to the chief`).toBe("chief");
    }
  });

  it("agents other than the four watchdogs run on a rhythm, never hot-looped", () => {
    for (const f of readdirSync(".github/workflows").filter((f) => f.startsWith("agent-"))) {
      const src = read(`.github/workflows/${f}`);
      expect(src, `${f} must be dispatchable`).toMatch(/workflow_dispatch/);
    }
    // Requests between agents are how the hand-offs work (e.g. Milo → Vince for a video).
    expect(brain).toMatch(/export async function fileRequest/);
    expect(brain).toMatch(/agent_requests/);
    expect(runner).toMatch(/CAN_REQUEST/);
  });
});
