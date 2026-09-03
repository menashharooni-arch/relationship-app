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
/** Noise that is not a bug: every real user eventually hits an expired session. */
const NOT_A_BUG = /refresh.?token|AuthApiError|AbortError|NEXT_REDIRECT|NEXT_NOT_FOUND/i;

/**
 * Bo's primary source: the app's OWN error table, read with the Supabase key
 * every agent already holds.
 *
 * This exists because Bo used to need a Vercel API token just to see what the
 * app already knew about itself — reportError only wrote to an ephemeral
 * console stream. Now production errors land in error_events, so Bo watches
 * crashes with zero extra credentials, and the history is queryable instead of
 * scrolling away. Returns null (not []) when the table isn't reachable, so the
 * caller can tell "nothing broken" from "cannot see".
 */
async function errorsFromDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    const res = await fetch(
      `${url}/rest/v1/error_events?select=fingerprint,context,message,env,created_at` +
        `&created_at=gte.${since}&env=eq.production&order=created_at.desc&limit=500`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null; // table missing (migration pending) or REST error
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    // Group by fingerprint — N occurrences of one bug is ONE finding.
    const groups = new Map();
    for (const r of rows) {
      if (NOT_A_BUG.test(r.message ?? "") || NOT_A_BUG.test(r.context ?? "")) continue;
      const g = groups.get(r.fingerprint) ?? { count: 0, sample: r };
      g.count++;
      groups.set(r.fingerprint, g);
    }

    const findings = [];
    for (const [fp, g] of groups) {
      // One-off blips are not incidents; three in fifteen minutes is a pattern.
      if (g.count < 3) continue;
      findings.push({
        key: `bug:${fp}`,
        title: `${g.sample.context} — ${String(g.sample.message).slice(0, 90)} (${g.count}× in 15 min)`,
        detail:
          `${g.count} production errors sharing one fingerprint in the last 15 minutes.\n` +
          `Context: ${g.sample.context}\nMessage: ${String(g.sample.message).slice(0, 500)}\n` +
          `First seen in this window: ${g.sample.created_at}`,
        severity: g.count >= 25 ? "critical" : "warn",
      });
    }
    return findings;
  } catch {
    return null;
  }
}

export async function boBugCheck() {
  // Primary: the app's own error table (no extra credential needed).
  const fromDb = await errorsFromDb();

  // Secondary: Vercel's runtime-error API, when a token happens to be set. It
  // adds nothing the table doesn't already have, so it is a bonus, not a
  // requirement — Bo is fully operational on the table alone.
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return fromDb ?? [];

  const since = Date.now() - 15 * 60 * 1000;
  const url = `https://api.vercel.com/v1/observability/runtime-errors?projectId=${projectId}&since=${since}${teamId ? `&teamId=${teamId}` : ""}`;
  let groups = [];
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return fromDb ?? [];
    const d = await res.json();
    groups = d?.errors ?? d?.groups ?? [];
  } catch {
    return fromDb ?? [];
  }

  const findings = [];
  for (const g of groups) {
    const count = Number(g.count ?? g.occurrences ?? 0);
    const name = g.name ?? g.errorName ?? "Error";
    const route = g.route ?? g.routes?.[0] ?? "unknown route";
    // Expired-session noise is not a bug; every real user hits it eventually.
    if (NOT_A_BUG.test(name)) continue;
    if (count < 5) continue;
    findings.push({
      key: `bug:${name}:${route}`,
      title: `${name} on ${route} — ${count} occurrences in 15 minutes`,
      detail: `Vercel runtime errors show ${count} occurrences of ${name} affecting ${route} in the last 15 minutes. Sample: ${String(g.message ?? g.sample ?? "").slice(0, 300)}`,
      severity: count >= 25 ? "critical" : "warn",
    });
  }
  // Both sources, deduped by key — the table is authoritative, Vercel adds
  // anything it saw that never reached reportError.
  const merged = new Map();
  for (const f of [...(fromDb ?? []), ...findings]) merged.set(f.key, f);
  return [...merged.values()];
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
  bugwatch: async () => {
    // Bo's primary source needs no special credential — just the Supabase key
    // every agent holds. He is blind only if that table is unreachable AND no
    // Vercel token is set, i.e. he genuinely has nothing to read.
    if (await errorsFromDb() !== null) return null;
    const hasVercel = !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
    if (hasVercel) return null;
    return {
      key: "blind:bugwatch:no-source",
      title: "Bo cannot see crashes — no readable error source",
      detail:
        "Bo reads production errors from the error_events table using the Supabase key the agents already hold, " +
        "and that table is not reachable — most likely supabase/error-events.sql has not been applied yet. " +
        "This is a CONFIGURATION gap, not a healthy silence: until it is fixed nobody is watching for crashes. " +
        "Fix: run supabase/error-events.sql in the Supabase SQL editor. " +
        "(Optional second source: set VERCEL_TOKEN from vercel.com/account/tokens — not required.)",
      severity: "warn",
    };
  },
};

/**
 * Findings that describe the WATCH ITSELF being broken, per agent.
 * Runs alongside the real probes on every tick; deduped like any finding, so it
 * reports once and closes itself the moment the credential appears.
 */
export async function blindnessFindings(agentId) {
  const check = BLINDNESS_CHECKS[agentId];
  const f = check ? await check() : null;
  return f ? [f] : [];
}
