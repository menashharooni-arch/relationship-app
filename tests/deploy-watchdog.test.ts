import { describe, it, expect } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

// The watchdog is the ONE thing in this repo allowed to change production without
// a human. Two failure directions matter, and they are not equally bad:
//
//   • Missing a real outage  → the site stays broken until someone notices.
//   • Rolling back a HEALTHY deploy → we broke working software by ourselves.
//
// The second is worse, so most of these tests are about NOT acting. Reading the
// thresholds and agreeing they look sensible proves nothing; these run the real
// script against a stubbed Sentry and Vercel and assert what it actually does.

type Issue = { title: string; count: number; userCount: number; level?: string };
type Deployment = { uid: string; url?: string; meta?: Record<string, string> };

type Scenario = {
  issues: Issue[];
  /** What the "does firstRelease actually filter?" canary query returns. */
  canary?: Issue[];
  deployments?: Deployment[];
  env?: Record<string, string>;
};

type Outcome = {
  result: Record<string, unknown>;
  /** Every request the script made, so we can assert on what it did NOT call. */
  requests: string[];
  exitCode: number | null;
  stderr: string;
};

const BAD_SHA = "bad0000000000000000000000000000000000000";
const GOOD_SHA = "9999999999999999999999999999999999999999";

const DEFAULT_DEPLOYMENTS: Deployment[] = [
  { uid: "dpl_known_good", url: "prev.vercel.app", meta: { githubCommitSha: GOOD_SHA } },
];

async function run(scenario: Scenario): Promise<Outcome> {
  const requests: string[] = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "";
    requests.push(`${req.method} ${url.split("?")[0]}`);
    res.setHeader("content-type", "application/json");

    if (url.includes("/issues/")) {
      const query = decodeURIComponent(new URL(url, "http://x").searchParams.get("query") || "");
      // The canary asks for a release that cannot exist. Answering it with the
      // real fixture is how we simulate "the filter silently stopped working".
      const body = query.includes("canary-no-such-release") ? (scenario.canary ?? []) : scenario.issues;
      res.end(JSON.stringify(body));
      return;
    }
    if (url.includes("/v7/deployments")) {
      res.end(JSON.stringify({ deployments: scenario.deployments ?? DEFAULT_DEPLOYMENTS }));
      return;
    }
    if (url.includes("/rollback/")) {
      res.end("{}");
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const host = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ["scripts/deploy-watchdog.mjs"], {
    env: {
      ...process.env,
      SENTRY_HOST: host,
      VERCEL_API_HOST: host,
      SENTRY_ORG: "swiftcard",
      SENTRY_PROJECT: "web",
      SENTRY_AUTH_TOKEN: "stub-token",
      VERCEL_TOKEN: "stub-token",
      VERCEL_PROJECT_ID: "prj_stub",
      DEPLOY_SHA: BAD_SHA,
      ROLLBACK_SOAK_MINUTES: "0", // don't actually wait five minutes
      ROLLBACK_DRY_RUN: "",
      ...scenario.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));
  const [exitCode] = (await once(child, "close")) as [number | null];

  server.close();
  await once(server, "close");

  return { result: JSON.parse(stdout || "{}"), requests, exitCode, stderr };
}

/** Did it actually touch production? The only question that really matters. */
const rolledBack = (o: Outcome) => o.requests.some((r) => r.startsWith("POST") && r.includes("/rollback/"));

describe("watchdog leaves healthy deploys alone", () => {
  it("does nothing when the deploy is quiet", async () => {
    const o = await run({ issues: [{ title: "Odd edge case", count: 4, userCount: 2 }] });
    expect(o.result.action).toBe("none");
    expect(o.result.healthy).toBe(true);
    expect(rolledBack(o)).toBe(false);
  });

  it("does NOT roll back for one user in a retry loop", async () => {
    // 300 events looks alarming and is not an outage. This is the single most
    // likely false positive, so it gets its own test.
    const o = await run({ issues: [{ title: "Retry storm", count: 300, userCount: 1 }] });
    expect(o.result.action).toBe("none");
    expect(rolledBack(o)).toBe(false);
  });

  it("does NOT roll back for a thin trickle across many users", async () => {
    // Background internet noise: extensions, bots, flaky networks.
    const o = await run({ issues: [{ title: "Sporadic", count: 8, userCount: 8 }] });
    expect(o.result.action).toBe("none");
    expect(rolledBack(o)).toBe(false);
  });

  it("ignores warning/info issues when deciding", async () => {
    // Only error and fatal describe something broken. A flood of warnings must
    // never move production.
    const o = await run({
      issues: [
        { title: "Deprecation notice", count: 900, userCount: 400, level: "warning" },
        { title: "Debug chatter", count: 900, userCount: 400, level: "info" },
      ],
    });
    expect(o.result.action).toBe("none");
    expect(o.result.events).toBe(0);
    expect(rolledBack(o)).toBe(false);
  });
});

describe("watchdog acts on a real spike", () => {
  it("rolls back when both events AND users are breached", async () => {
    const o = await run({
      issues: [
        { title: "TypeError: cannot read slug of undefined", count: 140, userCount: 35 },
        { title: "PostgresError", count: 20, userCount: 8, level: "fatal" },
      ],
    });
    expect(o.result.action).toBe("rolled-back");
    expect(o.result.events).toBe(160);
    expect(o.result.users).toBe(43);
    expect(rolledBack(o)).toBe(true);
    // It must target the last known-good build, by id.
    expect(o.requests.some((r) => r.includes("/rollback/dpl_known_good"))).toBe(true);
  });

  it("reports the worst offenders so the issue is actionable", async () => {
    const o = await run({
      issues: [
        { title: "Minor", count: 26, userCount: 6 },
        { title: "The actual outage", count: 400, userCount: 90 },
      ],
    });
    const worst = o.result.worst as Array<{ title: string }>;
    expect(worst[0].title).toBe("The actual outage");
  });

  it("dry run reports the decision but does not touch production", async () => {
    const o = await run({
      issues: [{ title: "Boom", count: 500, userCount: 99 }],
      env: { ROLLBACK_DRY_RUN: "1" },
    });
    expect(o.result.action).toBe("would-rollback");
    expect(rolledBack(o)).toBe(false);
  });
});

describe("watchdog refuses to act when it cannot trust itself", () => {
  it("stands down if the firstRelease filter is a no-op", async () => {
    // THE dangerous silent failure: if Sentry stopped honouring firstRelease, the
    // query would return every unresolved issue in the project and a perfectly
    // healthy deploy would get rolled back. The canary must catch this.
    const flood = [{ title: "Pre-existing bug from months ago", count: 5000, userCount: 900 }];
    const o = await run({ issues: flood, canary: flood });
    expect(o.result.action).toBe("escalate");
    expect(String(o.result.reason)).toContain("no-op");
    expect(rolledBack(o)).toBe(false);
  });

  it("escalates instead of guessing when there is no rollback candidate", async () => {
    const o = await run({
      issues: [{ title: "Boom", count: 200, userCount: 50 }],
      deployments: [],
    });
    expect(o.result.action).toBe("escalate");
    expect(rolledBack(o)).toBe(false);
  });

  it("never rolls back to another build of the same bad commit", async () => {
    // A retried deploy of the broken commit is not a known-good build.
    const o = await run({
      issues: [{ title: "Boom", count: 200, userCount: 50 }],
      deployments: [
        { uid: "dpl_same_bad_commit", meta: { githubCommitSha: BAD_SHA } },
        { uid: "dpl_actually_good", meta: { githubCommitSha: GOOD_SHA } },
      ],
    });
    expect(o.result.action).toBe("rolled-back");
    expect(o.requests.some((r) => r.includes("/rollback/dpl_actually_good"))).toBe(true);
    expect(o.requests.some((r) => r.includes("dpl_same_bad_commit"))).toBe(false);
  });

  it("stands down when unconfigured, without erroring", async () => {
    // Merging this must be a no-op until secrets are deliberately added.
    const o = await run({ issues: [], env: { VERCEL_TOKEN: "", SENTRY_AUTH_TOKEN: "" } });
    expect(o.result.action).toBe("skipped");
    expect(o.exitCode).toBe(0);
    expect(rolledBack(o)).toBe(false);
  });
});
