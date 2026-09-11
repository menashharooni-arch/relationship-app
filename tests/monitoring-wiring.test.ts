import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

// ── The guards that keep production honest must keep existing ────────────────
//
// The owner has had the same three things fixed more than once — a bug that
// came back, the site getting slow, analytics/notifications glitching — and
// asked for measures that are ALWAYS running. Those measures are files. A
// refactor that deletes a schedule, drops a check, or makes a QA script read
// only from .env.local again would switch a guard off in silence, and nobody
// would know until the next incident. This pins each one.

const read = (p: string) => readFileSync(p, "utf8");

describe("always-on production guards", () => {
  it("the 15-minute uptime probe still runs on a schedule and carries the speed budget", () => {
    const wf = read(".github/workflows/uptime.yml");
    expect(wf).toMatch(/schedule:\s*\n\s*(?:#[^\n]*\n\s*)*- cron: "\*\/15 \* \* \* \*"/);
    expect(wf).toContain("scripts/health-check.mjs");
    const hc = read("scripts/health-check.mjs");
    expect(hc).toContain("speed budget (median of 3, full response)");
    expect(hc).toContain("database answers quickly");
    // A budget that is quietly relaxed past 5s is a budget in name only.
    for (const m of hc.matchAll(/"\/[^"]*": (\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(5000);
  });

  it("the nightly real-browser run is scheduled AND fires after every production deploy", () => {
    const wf = read(".github/workflows/nightly-qa.yml");
    expect(wf).toMatch(/- cron: "0 9 \* \* \*"/);
    expect(wf).toContain("deployment_status:");
    for (const s of ["qa-prod-probe.mjs", "health-check.mjs", "qa-flows.mjs", "qa-office-links-brand.mjs", "qa-office-shell.mjs", "qa-sweep.mjs", "qa-nightly-summary.mjs"]) {
      expect(wf, s).toContain(`scripts/${s}`);
    }
    expect(wf).toContain("labels: 'nightly-qa'");
  });

  it("the production probe pins the pipelines that were fixed more than once", () => {
    const p = read("scripts/qa-prod-probe.mjs");
    expect(p).toContain("exactly ONE card_views row");
    expect(p).toContain("exactly ONE notification for the visit");
    expect(p).toContain("visit_key");
    expect(p).toContain("crawler's view is refused");
    // It must clean up after itself — a probe that leaves rows behind pollutes real analytics.
    expect(p).toMatch(/finally \{[\s\S]*\/rest\/v1\/notifications[\s\S]*\/rest\/v1\/card_views[\s\S]*auth\/v1\/admin\/users/);
  });

  it("every QA script can take its secrets from the environment, so CI can run it", () => {
    for (const s of ["qa-flows", "qa-sweep", "qa-office-shell", "qa-office-links-brand", "qa-a11y", "qa-mac", "qa-prod-probe"]) {
      const src = read(`scripts/${s}.mjs`);
      expect(src, s).toContain("process.env[k]");
      expect(src, s).not.toMatch(/const env = readFileSync\(`\$\{ROOT\}\/\.env\.local`/);
    }
  });

  it("the recurring-bug tripwires are still in the suite", () => {
    for (const t of ["one-notification-per-visit", "view-visit-window", "analytics-integrity", "analytics-accuracy", "trial-eligibility", "proxy-auth-hop"]) {
      expect(existsSync(`tests/${t}.test.ts`), t).toBe(true);
    }
  });
});
