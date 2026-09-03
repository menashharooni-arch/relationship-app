// ── The watchdogs' eyes: code-only probes, zero LLM tokens ───────────────────
//
// Owner order: Finn, Bo, Vera and Dash are WATCHDOGS. They do not have
// schedules — they watch continuously while the office is open and their Active
// box is ticked, and only Menash decides when they stop.
//
// "Continuously" and "constantly burning tokens" are different things, and the
// difference is this file. Every tick of watchdog.mjs runs these probes, which
// are plain fetches and comparisons — no model, no cost. They answer one
// question each: "is the thing I watch broken right now?" Only when the answer
// changes to yes does the loop wake the actual LLM agent to investigate and
// write it up for the owner.
//
// So the watching is continuous and free; the thinking is on-demand and paid.
// A quiet week costs nothing but HTTP requests.
//
// Each detector returns an array of findings:
//   { key, title, detail, severity }   severity: "critical" | "warn"
// `key` must be STABLE for the same underlying problem — it becomes the queue
// item's dedupe_key, which is what stops a two-day outage from opening 2,880
// duplicate reports. A finding that disappears from the array is treated as
// resolved by the caller.

const BASE = process.env.HEALTH_BASE_URL || "https://swiftcard.me";

/** Fetch with a hard timeout; never throws. Returns {ok,status,ms,body,headers}. */
async function probe(path, { method = "GET", timeoutMs = 15000, wantBody = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, { method, signal: ctrl.signal, redirect: "follow" });
    const body = wantBody ? await res.text() : "";
    return { ok: res.ok, status: res.status, ms: Date.now() - t0, body, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, body: "", headers: new Headers(), err: String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Transient blips are not incidents. Three tries before a probe counts as failed. */
async function stable(fn, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    last = await fn();
    if (last.ok) return last;
    if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
  }
  return last;
}

// ── Finn · Flow Check ────────────────────────────────────────────────────────
// The paths a real person walks. A 200 that renders an empty card page is still
// an outage to the human holding the phone, so these assert on CONTENT where
// content is what matters.
const FLOWS = [
  { key: "home", path: "/", must: "SwiftCard" },
  { key: "pricing", path: "/pricing", must: "Pro" },
  { key: "login", path: "/login", must: "" },
  { key: "signup", path: "/signup", must: "" },
  // The vCard endpoint is the only honest test of a card: the card PAGE
  // soft-404s (200 + generic shell) for a slug that no longer exists.
  { key: "vcard", path: "/api/card/aaronlavi-malvecapital/vcard", must: "BEGIN:VCARD" },
];

export async function finnFlowCheck() {
  const findings = [];
  for (const f of FLOWS) {
    const r = await stable(() => probe(f.path, { wantBody: !!f.must }));
    if (!r.ok) {
      findings.push({
        key: `flow:${f.key}:down`,
        title: `${f.path} is failing (HTTP ${r.status || "no response"})`,
        detail: `Three consecutive probes of ${BASE}${f.path} failed. Last status ${r.status || "none"}${r.err ? `, error: ${r.err}` : ""}.`,
        severity: "critical",
      });
      continue;
    }
    if (f.must && !r.body.includes(f.must)) {
      findings.push({
        key: `flow:${f.key}:empty`,
        title: `${f.path} loads but is missing expected content`,
        detail: `HTTP ${r.status} in ${r.ms}ms, but the response did not contain "${f.must}". The page may be rendering an error or empty shell.`,
        severity: "critical",
      });
    }
  }
  return findings;
}

// ── Dash · Performance ───────────────────────────────────────────────────────
// Thresholds are deliberately generous: a watchdog that cries wolf gets
// ignored, which is worse than no watchdog. These fire on "a user would notice
// and leave", not on "a percentile moved".
const PERF_BUDGET_MS = Number(process.env.WATCHDOG_PERF_BUDGET_MS || 4000);
const PERF_PAGES = ["/", "/pricing"];

export async function dashPerfCheck() {
  const findings = [];
  for (const path of PERF_PAGES) {
    // Two samples; report only if BOTH are slow, so one cold start is not an alarm.
    const a = await probe(path);
    const b = await probe(path);
    const slowest = Math.max(a.ms, b.ms);
    if (a.ok && b.ok && Math.min(a.ms, b.ms) > PERF_BUDGET_MS) {
      findings.push({
        key: `perf:${path}:slow`,
        title: `${path} is responding slowly (${slowest}ms)`,
        detail: `Two consecutive loads of ${BASE}${path} took ${a.ms}ms and ${b.ms}ms, both over the ${PERF_BUDGET_MS}ms budget. Visitors on cellular will feel this.`,
        severity: "warn",
      });
    }
  }
  return findings;
}

// ── Vera · Security ──────────────────────────────────────────────────────────
// Cheap, high-signal invariants that must never regress: the headers that stop
// clickjacking and MIME sniffing, and the rule that money and admin endpoints
// refuse anonymous callers. A regression here is how a launch turns into an
// incident, and it is exactly the kind of thing a deploy can silently undo.
const MUST_REFUSE = [
  { path: "/api/iap/sync", method: "POST", label: "IAP entitlement sync" },
  { path: "/api/admin/agents/control", method: "POST", label: "agent control" },
];

export async function veraSecurityCheck() {
  const findings = [];

  const home = await stable(() => probe("/", { wantBody: false }));
  if (home.ok) {
    const want = { "x-content-type-options": "nosniff", "x-frame-options": null };
    for (const [h, expected] of Object.entries(want)) {
      const got = home.headers.get(h);
      if (!got || (expected && got.toLowerCase() !== expected)) {
        findings.push({
          key: `sec:header:${h}`,
          title: `Security header ${h} is missing or wrong`,
          detail: `${BASE}/ returned ${h}: ${got ?? "(absent)"}. This protects against ${h === "x-frame-options" ? "clickjacking" : "MIME-type sniffing"} and was present before.`,
          severity: "warn",
        });
      }
    }
  }

  // Anonymous callers must be refused (401/403). A 200 here means an endpoint
  // that moves money or controls agents just became world-writable.
  for (const ep of MUST_REFUSE) {
    const r = await probe(ep.path, { method: ep.method });
    if (r.status === 200) {
      findings.push({
        key: `sec:open:${ep.path}`,
        title: `${ep.label} (${ep.path}) answers anonymous callers with 200`,
        detail: `An unauthenticated ${ep.method} to ${ep.path} returned 200. It must return 401 or 403. Treat as urgent.`,
        severity: "critical",
      });
    }
  }
  return findings;
}

// ── Bo · Bug Watch ───────────────────────────────────────────────────────────
// Bo reads real user-facing errors. Sentry is the eventual source (needs the
// owner's account); until it is armed, Vercel's runtime-error API is the honest
// substitute, and if neither is reachable Bo simply reports nothing rather than
// inventing calm.
export async function boBugCheck() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  // A blind watchdog must SAY it is blind. Returning [] here read as "all
  // clear" for Bo's entire existence — he has never once run — and the board
  // showed him on watch the whole time. Never let a missing credential look
  // like good news; see BLINDNESS_CHECKS below, which turns this into a
  // standing report instead of silence.
  if (!token || !projectId) return [];

  const since = Date.now() - 15 * 60 * 1000;
  const url = `https://api.vercel.com/v1/observability/runtime-errors?projectId=${projectId}&since=${since}${teamId ? `&teamId=${teamId}` : ""}`;
  let groups = [];
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const d = await res.json();
    groups = d?.errors ?? d?.groups ?? [];
  } catch {
    return [];
  }

  const findings = [];
  for (const g of groups) {
    const count = Number(g.count ?? g.occurrences ?? 0);
    const name = g.name ?? g.errorName ?? "Error";
    const route = g.route ?? g.routes?.[0] ?? "unknown route";
    // Expired-session noise is not a bug; every real user hits it eventually.
    if (/refresh.?token|AuthApiError/i.test(name)) continue;
    if (count < 5) continue;
    findings.push({
      key: `bug:${name}:${route}`,
      title: `${name} on ${route} — ${count} occurrences in 15 minutes`,
      detail: `Vercel runtime errors show ${count} occurrences of ${name} affecting ${route} in the last 15 minutes. Sample: ${String(g.message ?? g.sample ?? "").slice(0, 300)}`,
      severity: count >= 25 ? "critical" : "warn",
    });
  }
  return findings;
}

/** agent_id → its code-only detector. The set of continuous watchdogs. */
export const DETECTORS = {
  flowcheck: finnFlowCheck,
  perf: dashPerfCheck,
  security: veraSecurityCheck,
  bugwatch: boBugCheck,
};

// ── "Can this watchdog actually see?" ────────────────────────────────────────
//
// The bug this exists to prevent, stated plainly: Bo was configured, Active,
// and shown as on watch — while missing the credential his eyes need, so he
// silently reported nothing forever and looked identical to a healthy watchdog
// with nothing to report. Anyone reading the board would conclude the app was
// being watched for crashes. It wasn't.
//
// So blindness is now a FINDING, reported to the owner like any other problem,
// with the exact fix in the text. A watchdog that cannot see says so, once,
// and keeps saying so until it can. Add an entry here for every future
// credential any watchdog depends on — that is the guard against repeating it.
const BLINDNESS_CHECKS = {
  bugwatch: () => {
    const missing = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"].filter((v) => !process.env[v]);
    if (!missing.length) return null;
    return {
      key: `blind:bugwatch:${missing.join("+")}`,
      title: `Bo cannot see crashes — missing ${missing.join(" and ")}`,
      detail:
        `Bo watches real user-facing errors through Vercel's runtime-error API, and ${missing.join(" and ")} ` +
        `${missing.length > 1 ? "are" : "is"} not set as a repo secret, so he has nothing to read and reports nothing. ` +
        `This is a CONFIGURATION gap, not a healthy silence — until it is fixed, nobody is watching for crashes. ` +
        `Fix: create a Vercel token at vercel.com/account/tokens, then ` +
        `gh secret set VERCEL_TOKEN. VERCEL_PROJECT_ID and VERCEL_TEAM_ID come from .vercel/project.json.`,
      severity: "warn",
    };
  },
};

/**
 * Findings that describe the WATCH ITSELF being broken, per agent.
 * Runs alongside the real probes on every tick; deduped like any finding, so it
 * reports once and closes itself the moment the credential appears.
 */
export function blindnessFindings(agentId) {
  const check = BLINDNESS_CHECKS[agentId];
  const f = check?.();
  return f ? [f] : [];
}
