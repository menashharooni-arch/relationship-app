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
      expect(src, `${f} must not merge PRs`).not.toMatch(/pr merge|git push/);
      if (f !== "agent-scheduler.yml") expect(src, `${f} should be contents: read`).toMatch(/contents: read/);
      expect(src, `${f} must be manually triggerable`).toMatch(/workflow_dispatch/);
    }
  });
});

describe("agent flow: schema and config integrity", () => {
  const schema = read("supabase/agent-flow.sql");
  const config = JSON.parse(read("marketing-agents/config.json"));

  it("every agent table has RLS enabled (service-role only)", () => {
    for (const t of ["agent_settings", "agent_system", "agent_runs", "agent_queue_items", "agent_action_history", "agent_blog_topics", "agent_blog_posts"]) {
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
    expect(checkpoint).toMatch(/monthSpendUsd\(\)/);
    expect(checkpoint).toMatch(/monthly_usage_cap_usd/);
  });

  it("schedules support the owner's ET times, DST-correct", () => {
    const sched = read("marketing-agents/scheduler.mjs");
    expect(sched).toMatch(/daily@\(\\d\{1,2\}\):\(\\d\{2\}\)/);
    expect(sched).toMatch(/America\/New_York/);
  });

  it("the scheduler is inert by default (no seeded schedules)", () => {
    expect(schema).not.toMatch(/schedule.*default\s+'[^n]/i);
    expect(read("marketing-agents/scheduler.mjs")).toContain("No schedules set");
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
