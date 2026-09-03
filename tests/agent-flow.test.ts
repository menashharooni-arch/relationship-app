import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

// ── The Agent Flow safety contract, pinned ───────────────────────────────────
// The marketing agents' core promise is STRUCTURAL draft-only behavior on
// third-party platforms. These tests make that promise a build failure to
// break, not a code-review hope.
describe("agent flow: draft-only agents are structurally unable to post", () => {
  const runner = read("marketing-agents/run-agent.mjs");

  it("the LLM runner allows research tools only — no Bash, no git, no gh", () => {
    expect(runner).toMatch(/"--allowedTools", "WebSearch,WebFetch"/);
    expect(runner).not.toMatch(/allowedTools[^\n]*Bash/);
  });

  it("no agent code path contains a posting/DM API", () => {
    const forbidden = /api\.twitter\.com|graph\.facebook\.com|graph\.instagram\.com|api\.linkedin\.com|oauth\.reddit\.com|reddit\.com\/api\/submit|\/comments\/submit|chat\.postMessage/i;
    for (const f of readdirSync("marketing-agents").filter((f) => f.endsWith(".mjs")))
      expect(read(`marketing-agents/${f}`), `${f} contains a platform API`).not.toMatch(forbidden);
    expect(read("marketing-agents/lib/agentkit.mjs")).not.toMatch(forbidden);
  });

  it("agent workflows cannot push, merge, or deploy", () => {
    for (const f of readdirSync(".github/workflows").filter((f) => f.startsWith("agent-"))) {
      const src = read(`.github/workflows/${f}`);
      expect(src, `${f} must never merge a PR`).not.toMatch(/gh pr merge/);
      expect(src, `${f} must be manually triggerable`).toMatch(/workflow_dispatch/);
      if (f === "agent-fixer.yml") continue; // its own contract is pinned below
      expect(src, `${f} must not push`).not.toMatch(/git push/);
      if (f !== "agent-scheduler.yml") expect(src, `${f} should be contents: read`).toMatch(/contents: read/);
    }
  });

  it("the Fixer drafts on branches and can never touch main", () => {
    const src = read(".github/workflows/agent-fixer.yml");
    expect(src).toMatch(/--draft/);
    expect(src).not.toMatch(/gh pr merge/);
    // Both the branch-create and the push step refuse to operate on main.
    expect((src.match(/Refusing to (operate on|push from)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Deterministic branch name → a re-run dedupes instead of duplicating.
    expect(src).toMatch(/agent-fix\//);
    // The secret-holding step is SHA-pinned, mirroring sentry-triage.
    expect(src).toMatch(/claude-code-action@be7b93b1907a4abad570368f3c74b6fe3807510b/);
    // No eslint in the agent allowlist: `npx eslint *` is a wildcard and
    // eslint can execute arbitrary JS via --rulesdir/config — an escape hatch
    // in a secret-holding step. CI lints the PR branch instead.
    expect(src).not.toMatch(/Bash\(npx eslint/);
    expect(read(".github/workflows/sentry-triage.yml")).not.toMatch(/Bash\(npx eslint/);
    // finding.md is declared untrusted inside the prompt itself.
    expect(src).toMatch(/UNTRUSTED DATA/);
  });

  it("the loop closes: clean reports self-file, findings dispatch the Fixer", () => {
    for (const a of ["marketing-agents/agent-seo.mjs", "marketing-agents/agent-perf.mjs", "marketing-agents/agent-flowcheck.mjs"])
      expect(read(a), `${a} must self-file clean reports`).toMatch(/status: findings\.length \? "pending" : "acknowledged"/);
    for (const w of [".github/workflows/agent-seo.yml", ".github/workflows/agent-perf.yml", ".github/workflows/agent-flowcheck.yml"])
      expect(read(w), `${w} must hand findings to the Fixer`).toMatch(/agent-fixer\.yml -f item_id/);
    expect(read("marketing-agents/lib/agentkit.mjs")).toMatch(/return \{ result: "added", id:/);
  });

  it("Flow Check is strictly read-only against the live site", () => {
    const src = read("marketing-agents/agent-flowcheck.mjs");
    // Every probe is a GET; the agent never signs up, posts, or mutates.
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/i);
    expect(src).toMatch(/READ-ONLY/);
    // It watches the exact leg of the 2026-09-02 LinkedIn headshot bug.
    expect(src).toMatch(/integrations\/linkedin\/connect\?guest=1/);
    expect(src).toMatch(/redirect_uri/);
    // No LLM: immune to Claude usage limits by construction.
    expect(src).not.toMatch(/standDownIfUsageExhausted|execFileSync/);
  });
});

describe("agent flow: schema and config integrity", () => {
  const schema = read("supabase/agent-flow.sql");
  const config = JSON.parse(read("marketing-agents/config.json"));

  it("every agent table has RLS enabled (service-role only)", () => {
    for (const t of ["agent_settings", "agent_system", "agent_runs", "agent_queue_items", "agent_action_history", "agent_blog_topics", "agent_blog_posts", "agent_messages"]) {
      expect(schema).toContain(`create table if not exists ${t}`);
      expect(schema, `${t} missing RLS`).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`));
    }
  });

  it("every configured agent's workflow file exists", () => {
    for (const [id, a] of Object.entries(config.agents as Record<string, { workflow: string }>))
      expect(existsSync(`.github/workflows/${a.workflow}`), `${id} → ${a.workflow}`).toBe(true);
  });

  it("the work-hours auto-stop is enforced everywhere it must be", () => {
    // Reached auto_pause_at behaves exactly like Pause All: agents refuse to
    // start, checkpoint out mid-run, and the scheduler dispatches nothing.
    expect(read("supabase/agent-flow.sql")).toMatch(/auto_pause_at timestamptz/);
    const kit = read("marketing-agents/lib/agentkit.mjs");
    expect(kit).toMatch(/function autoStopped/);
    expect(kit).toMatch(/system\.paused \|\| autoStopped\(system\)/);
    expect(read("marketing-agents/scheduler.mjs")).toMatch(/auto_pause_at/);
  });

  it("the MONTHLY cap is re-checked mid-run, not just at start", () => {
    // A parallel agent can cross the cap while another is running — the
    // pre-start gate alone cannot catch that.
    const kit = read("marketing-agents/lib/agentkit.mjs");
    const checkpoint = kit.slice(kit.indexOf("async checkpoint()"), kit.indexOf("addUsage"));
    // Caps are TOKENS (owner order 2026-09-02: the system runs on the Claude
    // plan — usage and tokens, never dollars). No gate may read a $ column.
    expect(checkpoint).toMatch(/monthTokensUsed\(\)/);
    expect(checkpoint).toMatch(/monthly_usage_cap_tokens/);
    expect(checkpoint).toMatch(/usage_cap_tokens/);
    expect(kit).not.toMatch(/monthly_usage_cap_usd/);
    // Migration + code fallbacks agree.
    const mig = read("supabase/agent-flow-tokens.sql");
    expect(mig).toMatch(/usage_cap_tokens bigint not null default 500000/);
    expect(mig).toMatch(/monthly_usage_cap_tokens bigint not null default 6000000/);
    expect(kit).toMatch(/DEFAULT_RUN_CAP_TOKENS = 500_000/);
    expect(kit).toMatch(/DEFAULT_MONTHLY_CAP_TOKENS = 6_000_000/);
  });

  it("schedules support the owner's ET times, DST-correct", () => {
    const sched = read("marketing-agents/scheduler.mjs");
    expect(sched).toMatch(/daily@\(\\d\{1,2\}\):\(\\d\{2\}\)/);
    expect(sched).toMatch(/America\/New_York/);
  });

  it("the system is inert by default — via the master pause, not empty schedules", () => {
    // Since the default-rhythm order (2026-09-02) every agent HAS a schedule
    // (config default when the DB's is NULL), so inertness comes from the
    // ship-state master pause + Start resting every team: the scheduler
    // hard-exits on a paused system, and the DB seeds no schedule values of
    // its own for the config defaults to fight with.
    expect(schema).not.toMatch(/schedule.*default\s+'[^n]/i);
    const sched = read("marketing-agents/scheduler.mjs");
    expect(sched).toMatch(/System paused — dispatching nothing/);
    expect(sched).toMatch(/No awake, active agents/);
  });
});

describe("agent flow: the org chart and comms log stay coherent", () => {
  const org = JSON.parse(read("marketing-agents/org.json"));
  const config = JSON.parse(read("marketing-agents/config.json"));

  it("every runnable agent has exactly one persona, and vice versa", () => {
    const personaAgents = Object.values(org.parties as Record<string, { agent_id?: string }>).map((p) => p.agent_id).filter(Boolean).sort();
    expect(personaAgents).toEqual(Object.keys(config.agents).sort());
    expect(new Set(personaAgents).size).toBe(personaAgents.length);
  });

  it("every reporting line points at a real party, up to the owner", () => {
    const parties = org.parties as Record<string, { kind: string; reports_to?: string }>;
    for (const [pid, p] of Object.entries(parties)) {
      if (p.kind === "human") continue;
      expect(p.reports_to, `${pid} has no reports_to`).toBeTruthy();
      expect(parties[p.reports_to!], `${pid} reports to unknown '${p.reports_to}'`).toBeTruthy();
    }
    // Workers report to leads, leads to the chief, the chief to the owner.
    for (const [pid, p] of Object.entries(parties)) {
      if (p.kind === "worker") expect(["lead", "chief"], `${pid}'s boss kind`).toContain(parties[p.reports_to!].kind);
      if (p.kind === "lead") expect(parties[p.reports_to!].kind).toBe("chief");
      if (p.kind === "chief") expect(parties[p.reports_to!].kind).toBe("human");
    }
  });

  it("comms writes are best-effort and only ever touch agent_messages", () => {
    const kit = read("marketing-agents/lib/agentkit.mjs");
    const sayFn = kit.slice(kit.indexOf("export async function say"), kit.indexOf("export async function getSettings"));
    expect(sayFn).toMatch(/agent_messages/);
    expect(sayFn).toMatch(/catch/); // a comms hiccup must never fail a run
    expect(sayFn).not.toMatch(/agent_queue_items|agent_runs|agent_settings/);
  });

  it("LLM agents stand down gracefully at the usage limit; watchers are untouched", () => {
    const kit = read("marketing-agents/lib/agentkit.mjs");
    expect(kit).toMatch(/export async function standDownIfUsageExhausted/);
    expect(kit).toMatch(/skipped_usage/);
    // Only the two LLM runners consult it — no-LLM watchers never should.
    expect(read("marketing-agents/run-agent.mjs")).toMatch(/standDownIfUsageExhausted\(run\)/);
    expect(read("marketing-agents/agent-blog.mjs")).toMatch(/standDownIfUsageExhausted\(run\)/);
    for (const f of ["agent-seo.mjs", "agent-perf.mjs", "agent-security.mjs", "agent-manager.mjs"])
      expect(read(`marketing-agents/${f}`), `${f} needs no usage gate (no LLM)`).not.toMatch(/standDownIfUsageExhausted/);
  });

  it("team switches pause exactly the lead's reports and the scheduler honors it", () => {
    const route = read("src/app/api/admin/agents/control/route.ts");
    expect(route).toMatch(/op === "pause_team" \|\| op === "resume_team"/);
    expect(route).toMatch(/kind === "lead"/);
    expect(read("marketing-agents/scheduler.mjs")).toMatch(/paused=is\.false/);
  });

  it("the Claude-plan usage meter is admin-gated and best-effort", () => {
    const route = read("src/app/api/admin/agents/usage/route.ts");
    expect(route).toMatch(/requireAdmin/);
    expect(route).toMatch(/api\.anthropic\.com\/api\/oauth\/usage/);
    const kit = read("marketing-agents/lib/agentkit.mjs");
    const snap = kit.slice(kit.indexOf("export async function snapshotClaudeUsage"), kit.indexOf("export async function safeMain"));
    expect(snap).toMatch(/catch/); // a usage hiccup must never fail a run
    expect(snap).toMatch(/agent_system/);
    expect(snap).not.toMatch(/agent_queue_items|agent_runs/);
  });

  it("run lifecycle emits real events: dispatch, ack, report-back, escalation", () => {
    const kit = read("marketing-agents/lib/agentkit.mjs");
    expect(kit).toMatch(/GO — start your run now/);
    expect(kit).toMatch(/On it — starting now/);
    expect(kit).toMatch(/Done — \$\{this\.outputCount\} item\(s\) queued/);
    expect(kit).toMatch(/Escalating: /);
  });
});

describe("agent flow: person-facing copy is guarded against sounding like AI", () => {
  const runner = read("marketing-agents/run-agent.mjs");

  it("the human-voice doctrine exists and ends with the self-check", () => {
    const doc = read("marketing-agents/HUMAN_VOICE.md");
    expect(doc).toMatch(/Never write these/);
    expect(doc).toMatch(/Final self-check/);
    expect(doc).toMatch(/Could this exact text go to anyone else/);
  });

  it("the runner injects it for every person-facing agent", () => {
    expect(runner).toMatch(/PERSON_FACING = new Set\(\["outreach", "mentions", "influencer", "social"\]\)/);
    expect(runner).toMatch(/HUMAN_VOICE\.md/);
  });

  it("drafts with AI tells are DISCARDED, never queued", () => {
    // The filter is a hard gate the model cannot argue with — sentinel tells:
    for (const tell of ["finds you well", "came across your", "game.?changer", "delve"])
      expect(runner, `filter lost the "${tell}" tell`).toContain(tell);
    expect(runner).toMatch(/robotic\+\+/);
    expect(runner).toMatch(/DISCARDED for AI-sounding language/);
  });

  it("each person-facing agent carries the mandatory final pass", () => {
    for (const a of ["outreach", "mentions", "influencer", "social"])
      expect(read(`marketing-agents/agents/${a}.md`), `${a}.md missing its final pass`).toMatch(/HUMAN_VOICE/);
  });
});

describe("agent flow: approve-to-execute stays owner-gated", () => {
  const exec = read("src/lib/agent-execute.ts");
  const itemsRoute = read("src/app/api/admin/agents/items/route.ts");

  it("posting hosts live ONLY in agent-execute.ts, nowhere else in src or agents", () => {
    const hosts = /ugcPosts|api\.higgsfield\.ai|oauth\.reddit\.com/;
    expect(exec).toMatch(hosts);
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(ts|tsx|mjs)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    for (const f of [...walk("src"), ...walk("marketing-agents")]) {
      if (f === "src/lib/agent-execute.ts") continue;
      expect(read(f), `${f} contains a posting host — only agent-execute.ts may`).not.toMatch(hosts);
    }
  });

  it("executeItem is called only from the admin items route, only on the owner's Approve of a pending item", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    for (const f of walk("src")) {
      if (f.endsWith("agent-execute.ts") || f === "src/app/api/admin/agents/items/route.ts") continue;
      expect(read(f), `${f} must not import executeItem`).not.toMatch(/executeItem/);
    }
    expect(itemsRoute).toMatch(/action === "approved" && item\.status === "pending"/);
    expect(itemsRoute).toMatch(/requireAdmin/);
  });

  it("every connector is env-gated and the client mirror lists the same connectors", () => {
    const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");
    for (const id of ["linkedin", "higgsfield", "reddit"]) {
      expect(exec).toContain(`id: "${id}"`);
      expect(client).toContain(`id: "${id}"`);
    }
    // ready() must consult env, never a hardcoded true.
    expect(exec).not.toMatch(/ready: \(\) => true/);
  });
});

describe("agent flow: blog publishes only reviewed content", () => {
  it("public pages read published rows only", () => {
    expect(read("src/app/blog/page.tsx")).toMatch(/eq\("status", "published"\)/);
    expect(read("src/app/blog/[slug]/page.tsx")).toMatch(/eq\("status", "published"\)/);
  });
  it("blog agent defaults to draft mode", () => {
    const config = JSON.parse(read("marketing-agents/config.json"));
    expect(config.blog.publish_mode).toBe("draft");
  });
  it("a markdown link can never break out of the href attribute", () => {
    // The post author is an LLM reading the open web — markdown is a
    // prompt-injection surface even with human review before publish.
    const src = read("src/lib/blog-md.ts");
    expect(src).toContain(String.raw`[^)\s"'<>]`);
  });
  it("dynamic JSON-LD goes through the escaping serializer", () => {
    expect(read("src/app/blog/[slug]/page.tsx")).toMatch(/jsonLdScript\(jsonLd\)/);
    expect(read("src/lib/brand.ts")).toMatch(/u003c/);
  });
  it("the markdown renderer escapes HTML before anything else", () => {
    const src = read("src/lib/blog-md.ts");
    expect(src).toMatch(/replace\(\/</);
    expect(src.indexOf("esc(")).toBeLessThan(src.indexOf("inline("));
  });
});

// ── Start opens, Wake runs (owner order 2026-09-02) ──────────────────────────
// Start All = the office is OPEN and every team is at rest — deterministically,
// whatever state came before. NOTHING dispatches on Start. Waking a team is the
// go signal: its enabled agents dispatch immediately (office open only), then
// keep their rhythms. The runner refuses paused agents regardless, so a stray
// dispatch can never run a resting team.
describe("start opens, wake runs", () => {
  const route = read("src/app/api/admin/agents/control/route.ts");
  const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");

  it("start_all rests every worker team (manager + the watch excepted) and dispatches no worker", () => {
    const block = route.slice(route.indexOf('op === "start_all"'), route.indexOf('if (!process.env.GITHUB_AGENTS_TOKEN)'));
    expect(block).toMatch(/paused: true/);
    // The rest-on-open exception list is manager + every continuous watchdog:
    // opening the office is the watch's go signal (owner order 2026-09-03).
    expect(block).toMatch(/\["manager", \.\.\.CONTINUOUS_AGENTS\]/);
    expect(block).toMatch(/not\("agent_id", "in"/);
    expect(block).toMatch(/armWatchdogLoop\("start_all"\)/);
    // Still no one-shot fan-out of worker agents (owner order 2026-09-02).
    expect(block).not.toMatch(/\bdispatch\(agents\[/);
  });

  it("start_all works without the dispatch PAT — it sits BEFORE the token guard", () => {
    expect(route.indexOf('op === "start_all"')).toBeLessThan(route.indexOf("GITHUB_AGENTS_TOKEN is not set"));
  });

  it("waking a team dispatches its enabled agents immediately — only while open", () => {
    const block = route.slice(route.indexOf('op === "pause_team"'), route.indexOf('op === "pause" ||'));
    expect(block).toMatch(/team_wake/);
    expect(block).toMatch(/openNow && process\.env\.GITHUB_AGENTS_TOKEN/);
    expect(block).toMatch(/enabled\.has\(id\)/);
  });

  it("the banner distinguishes OPEN (all resting) from RUNNING (some awake)", () => {
    expect(client).toMatch(/allTeamsResting \? \(/);
    expect(client).toMatch(/OPEN — all teams resting/);
    expect(client).toMatch(/RUNNING — awake teams work their own rhythms/);
  });

  it("the tour and toasts tell the same story — no 'Start runs everyone' copy survives", () => {
    expect(client).toMatch(/Press Start to OPEN the office/);
    expect(client).not.toMatch(/Every agent runs now/);
    expect(client).not.toMatch(/press Start and every agent works/);
  });
});

// ── Every agent always has a rhythm (owner order 2026-09-02) ─────────────────
// "Manual only" is not a state: an awake, Active agent works its schedule, and
// an empty schedule means the default_schedule from config.json. The scheduler
// and the UI read the SAME defaults, pinned against each other here.
describe("default rhythms — no schedule-less agents", () => {
  const cfg = JSON.parse(read("marketing-agents/config.json")) as { agents: Record<string, { default_schedule?: string }> };

  it("config carries a default_schedule for every scheduled agent — the watch excepted", () => {
    for (const [id, a] of Object.entries(cfg.agents as Record<string, { default_schedule?: string; continuous?: boolean }>)) {
      // The four watchdogs have no rhythm by owner order (2026-09-03) — they
      // watch continuously. Everyone else must carry one.
      if (a.continuous) { expect(a.default_schedule, `${id} is a watchdog — no cadence`).toBeUndefined(); continue; }
      expect(a.default_schedule, `${id} needs a default_schedule`).toMatch(/^(every@\d{1,2}h|daily@\d{1,2}:\d{2})$/);
    }
  });

  it("the scheduler falls back to the config default for empty schedules", () => {
    const sched = read("marketing-agents/scheduler.mjs");
    expect(sched).toMatch(/r\.schedule \|\| config\.agents\[r\.agent_id\]\?\.default_schedule/);
    // And it no longer filters empty schedules out of the query.
    expect(sched).not.toMatch(/schedule=not\.is\.null/);
  });

  it("the UI's DEFAULT_SCHEDULES map matches config exactly — no drift", () => {
    const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");
    for (const [id, a] of Object.entries(cfg.agents)) {
      if (!a.default_schedule) continue;
      expect(client, `client default for ${id}`).toContain(`${id}: "${a.default_schedule}"`);
    }
    expect(client).not.toMatch(/off — only when run by hand/);
    expect(client).not.toMatch(/"Manual only"/);
  });

  it("ticking Active ON starts the agent immediately (office open, team awake)", () => {
    const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");
    expect(client).toMatch(/if \(on && open && !s\.paused\) control\("run", id\);/);
  });
});

// ── Email policy (owner order 2026-09-02): reports + 🔴 criticals ONLY ───────
// hello@swiftcard.me gets Atlas's daily digest and the three critical alarms
// (site health, broken user journey, security). Nothing else — cap events and
// other little things live in the comms log, run history, and the digest.
describe("agent emails: digest and criticals only", () => {
  it("exactly these four files may email, and agentkit itself sends none", () => {
    expect(read("marketing-agents/lib/agentkit.mjs")).not.toMatch(/await email\(/);
    for (const f of ["agent-manager.mjs", "agent-perf.mjs", "agent-security.mjs", "agent-flowcheck.mjs"])
      expect((read(`marketing-agents/${f}`).match(/await email\(/g) ?? []).length, f).toBe(1);
    for (const f of readdirSync("marketing-agents").filter((x) => x.endsWith(".mjs") && !["agent-manager.mjs", "agent-perf.mjs", "agent-security.mjs", "agent-flowcheck.mjs"].includes(x)))
      expect(read(`marketing-agents/${f}`), `${f} must not email`).not.toMatch(/await email\(/);
  });

  it("the three non-digest emails fire only on CRITICAL findings", () => {
    for (const f of ["agent-perf.mjs", "agent-security.mjs", "agent-flowcheck.mjs"]) {
      const src = read(`marketing-agents/${f}`);
      const at = src.indexOf("await email(");
      expect(src.slice(Math.max(0, at - 400), at), `${f} email must be critical-gated`).toMatch(/critical/i);
    }
  });
});

describe("agent flow: Approve & Ship fix merges only the Fixer's tested work", () => {
  const route = read("src/app/api/admin/agents/ship-fix/route.ts");

  it("is admin-gated and merges nothing outside agent-fix/* → main in our repo", () => {
    expect(route).toMatch(/requireAdmin/);
    expect(route).toMatch(/head\.ref\.startsWith\("agent-fix\/"\)/);
    expect(route).toMatch(/base\.ref !== "main"/);
    expect(route).toMatch(/m\[1\] !== REPO/);
  });

  it("never ships red or unfinished tests", () => {
    expect(route).toMatch(/status !== "completed"/);
    expect(route).toMatch(/"success", "neutral", "skipped"/);
    expect(route).toMatch(/red tests never ships/);
  });

  it("the PR must come from a real queue item's payload, not caller input", () => {
    // The caller sends only item_id; the PR URL is read from the DB row the
    // Fixer stamped — an attacker-supplied URL has no path in.
    expect(route).toMatch(/payload as Record<string, unknown> \| null\)\?\.pr_url/);
    expect(route).not.toMatch(/body\.pr_url|pr_url.*req\.json/);
  });
});

// ── The watch: Finn, Bo, Vera, Dash ─────────────────────────────────────────
// Owner order 2026-09-03, and he has given it more than once: these four are
// WATCHDOGS. No schedules, no "next check-in" — they watch continuously while
// the office is open and their Active box is ticked, and only he stops them.
// Every pin below exists so no future change can quietly put them back on a
// cadence.
describe("continuous watchdogs have no schedule", () => {
  const config = JSON.parse(read("marketing-agents/config.json"));
  const route = read("src/app/api/admin/agents/control/route.ts");
  const client = read("src/app/admin/agent-flow/AgentFlowClient.tsx");
  const WATCH = ["flowcheck", "bugwatch", "security", "perf"];

  it("all four are marked continuous and carry NO default_schedule", () => {
    for (const id of WATCH) {
      expect(config.agents[id].continuous, `${id} must be continuous`).toBe(true);
      expect(config.agents[id].default_schedule, `${id} must have no cadence`).toBeUndefined();
    }
  });

  it("no other agent is marked continuous — Maya's team and Atlas keep their rhythms", () => {
    for (const [id, a] of Object.entries(config.agents as Record<string, { continuous?: boolean }>))
      if (!WATCH.includes(id)) expect(a.continuous, `${id} must not be continuous`).toBeFalsy();
  });

  it("the clock skips them — the scheduler must never dispatch a watchdog", () => {
    const s = read("marketing-agents/scheduler.mjs");
    expect(s).toMatch(/if \(config\.agents\[r\.agent_id\]\?\.continuous\) continue;/);
    // and the skip must come BEFORE the dispatch call itself
    expect(s.indexOf("continuous) continue")).toBeLessThan(s.indexOf("await fetch("));
  });

  it("the loop stands down ONLY on the owner's switches, and does not re-arm when it does", () => {
    const w = read("marketing-agents/watchdog.mjs");
    expect(w).toMatch(/sys\.paused/);           // Pause All
    expect(w).toMatch(/auto_pause_at/);          // auto-stop
    expect(w).toMatch(/r\.enabled && !r\.paused/); // Active box
    expect(w).toMatch(/WATCHDOG_REARM=/);
    // No cadence logic anywhere in the loop.
    expect(w).not.toMatch(/every@|daily@/);
  });

  it("detection is code-only — the loop spends no tokens to watch", () => {
    const d = read("marketing-agents/lib/detectors.mjs");
    for (const forbidden of ["claude", "anthropic", "openai", "gemini"])
      expect(d.toLowerCase(), `detectors must not call an LLM (${forbidden})`).not.toContain(forbidden);
  });

  it("findings dedupe, so a long outage reports once rather than every tick", () => {
    const w = read("marketing-agents/watchdog.mjs");
    expect(w).toMatch(/dedupe_key/);
    expect(w).toMatch(/if \(open\.has\(key\)\) continue;/);
  });

  it("the board says 'Watching · live' and offers no rhythm picker for them", () => {
    expect(client).toMatch(/CONTINUOUS\.has\(id\).*Watching · live/s);
    expect(client).toMatch(/if \(CONTINUOUS\.has\(agentId\)\) return null;/);
    expect(client).toMatch(/on watch continuously/);
  });

  it("the UI's watchdog set matches config.json exactly", () => {
    const inClient = client.match(/const CONTINUOUS = new Set\(\[([^\]]+)\]\)/)?.[1] ?? "";
    const ids = [...inClient.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual([...WATCH].sort());
  });

  it("the watch is armed the moment the owner turns it on", () => {
    const settings = read("src/app/api/admin/agents/settings/route.ts");
    expect(settings).toMatch(/enabled === true && isContinuous/);
    // …and a cadence aimed at a watchdog is ignored rather than stored.
    expect(settings).toMatch(/!isContinuous\(body\.agent_id\)\) patch\.schedule/);
    expect(route).toMatch(/armWatchdogLoop\("unbench"\)/);
    expect(route).toMatch(/armWatchdogLoop\("team_wake"\)/);
  });

  it("waking a team never one-shot-dispatches a watchdog", () => {
    expect(route).toMatch(/if \(isContinuous\(id\)\) continue;/);
  });
});

// ── A blind watchdog must say so ─────────────────────────────────────────────
// Bo was Active, shown "on watch", and had NEVER run — his detector returned
// [] because VERCEL_TOKEN was absent, which is indistinguishable from "nothing
// is wrong". These pins make a missing credential a REPORTED finding, so the
// board can never again imply a watch that isn't happening.
describe("watchdogs report their own blindness", () => {
  it("a missing credential is a finding, not a silent all-clear", async () => {
    const d = await import("../marketing-agents/lib/detectors.mjs");
    const before = { ...process.env };
    delete process.env.VERCEL_TOKEN; delete process.env.VERCEL_PROJECT_ID;
    const blind = await d.blindnessFindings("bugwatch");
    expect(blind).toHaveLength(1);
    expect(blind[0].title).toMatch(/cannot see/i);
    // The fix must be IN the report — a finding you can't act on wastes the alert.
    expect(blind[0].detail).toMatch(/error-events\.sql/);
    expect(blind[0].detail).toMatch(/CONFIGURATION gap/);
    process.env.VERCEL_TOKEN = "x"; process.env.VERCEL_PROJECT_ID = "y";
    expect(await d.blindnessFindings("bugwatch")).toHaveLength(0);
    Object.assign(process.env, before);
  });

  it("the loop checks blindness BEFORE trusting a detector's all-clear", () => {
    const w = read("marketing-agents/watchdog.mjs");
    expect(w).toMatch(/await blindnessFindings\(agentId\)\), \.\.\.\(await DETECTORS\[agentId\]\(\)\)/);
  });

  it("a used-up Claude window stands the agent down instead of failing it red", () => {
    const r = read("marketing-agents/run-agent.mjs");
    // The CLI call must be guarded, and a limit reply must not throw.
    expect(r).toMatch(/catch \(e\)/);
    expect(r).toMatch(/hit your \(\?:session\|usage\) limit/);
    expect(r).toMatch(/standDownForUsage\(run, limit\)/);
    const kit = read("marketing-agents/lib/agentkit.mjs");
    expect(kit).toMatch(/export async function standDownForUsage/);
    // Recorded as capacity, never as a breakage.
    expect(kit).toMatch(/run\.finish\("skipped_usage"/);
  });
});
