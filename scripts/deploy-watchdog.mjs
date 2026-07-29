#!/usr/bin/env node
// ── Auto-rollback watchdog ───────────────────────────────────────────────────
//
// The ONE automation here allowed to act without a human. It watches a fresh
// production deploy and, if that deploy is visibly breaking the site, points
// production traffic back at the last known-good build.
//
// Vercel has NO built-in "roll back when errors spike". Rolling releases advance
// on a timer or on manual approval, and `vercel rollback` / `abort` are manual.
// So the trigger has to be built, which is what this file is.
//
// WHY THIS IS SAFE TO AUTOMATE, unlike the triage job:
//   • A rollback re-points traffic at a build that was already live and healthy.
//     It deletes nothing, rewrites no history, and touches no git branch.
//   • It is reversible in one click — redeploy or promote the newer build.
//   • The failure mode is "the site is running yesterday's code", which is
//     strictly better than "the site is down".
//
// WHAT IT WILL NOT DO: revert a commit, push, force-deploy, or resolve the
// Sentry issue. The bad code stays on main for a human to look at, and the
// workflow opens an issue so nobody discovers the rollback by accident.
//
// Run manually (safe — reports without acting):
//   ROLLBACK_DRY_RUN=1 DEPLOY_SHA=<sha> SENTRY_… VERCEL_… node scripts/deploy-watchdog.mjs

const SENTRY_HOST = process.env.SENTRY_HOST || "https://sentry.io";
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
/** Overridable so the decision logic can be tested against a local stub. */
const VERCEL_API = process.env.VERCEL_API_HOST || "https://api.vercel.com";

/** The commit that just went live. Sentry's release name — see sentry-options.ts. */
const DEPLOY_SHA = process.env.DEPLOY_SHA;

/**
 * Soak time before judging, in minutes.
 *
 * Rolling back instantly on the first error would fire on a single cold-start
 * blip. Five minutes is long enough for real traffic to hit the new build and
 * for Sentry to have ingested it, short enough that a genuinely broken deploy
 * isn't live for long.
 */
const SOAK_MINUTES = Number(process.env.ROLLBACK_SOAK_MINUTES || 5);

/**
 * The spike thresholds. BOTH must be crossed.
 *
 * Requiring events AND distinct users is the whole trick. Either alone
 * misfires: one user in a retry loop can generate 200 events (not an outage),
 * and a slow trickle of 3 errors across 3 users is normal internet background
 * noise (also not an outage). Together they describe the thing we actually care
 * about — lots of errors hitting lots of different people, right after a deploy.
 */
const MIN_EVENTS = Number(process.env.ROLLBACK_MIN_EVENTS || 25);
const MIN_USERS = Number(process.env.ROLLBACK_MIN_USERS || 5);

/** Observe-only mode. Recommended for the first week — see MONITORING.md. */
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.ROLLBACK_DRY_RUN || "");

function log(...args) {
  console.error("[watchdog]", ...args);
}

/** Machine-readable verdict on stdout for the workflow to act on. */
function emit(result) {
  process.stdout.write(JSON.stringify(result));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function configured() {
  const missing = [];
  if (!SENTRY_ORG || !SENTRY_PROJECT || !SENTRY_TOKEN) missing.push("Sentry");
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) missing.push("Vercel");
  if (!DEPLOY_SHA) missing.push("DEPLOY_SHA");
  return missing;
}

/** Raw issue search. Returns the parsed array, or throws — never a partial answer. */
async function searchIssues(query) {
  const params = new URLSearchParams({ query, statsPeriod: "1h", limit: "100" });
  const url = `${SENTRY_HOST}/api/0/projects/${encodeURIComponent(SENTRY_ORG)}/${encodeURIComponent(SENTRY_PROJECT)}/issues/?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SENTRY_TOKEN}`, Accept: "application/json" },
  });

  // A 400 here means Sentry rejected the query — which for the canary below is
  // the GOOD outcome, so the caller decides what a rejection means.
  if (res.status === 400) return { rejected: true, issues: [] };

  if (!res.ok) {
    // Cannot measure → must not act. An unreadable Sentry is not evidence of a
    // healthy deploy, but it is definitely not evidence of a broken one either.
    throw new Error(`Sentry API returned ${res.status}`);
  }

  const issues = await res.json();
  if (!Array.isArray(issues)) throw new Error("Unexpected Sentry response shape");
  return { rejected: false, issues };
}

/**
 * Prove the `firstRelease:` filter is actually being applied before we trust it.
 *
 * This guards the one failure mode that could roll back a HEALTHY deploy: if a
 * future Sentry change made the filter a no-op, our query would silently return
 * every unresolved issue in the project, the totals would sail past the
 * thresholds, and production would revert for no reason. So we ask for a release
 * that cannot exist. Empty or rejected means the filter works; results coming
 * back means it does not, and we refuse to act on any of its numbers.
 */
async function filterIsTrustworthy() {
  const { rejected, issues } = await searchIssues("firstRelease:swiftcard-watchdog-canary-no-such-release");
  if (rejected) return true;
  return issues.length === 0;
}

/**
 * Count errors that THIS deploy introduced.
 *
 * `firstRelease:<sha>` is the important part: it matches only issues whose
 * first-ever occurrence is this release. That excludes the app's pre-existing
 * background errors without needing to model a baseline — if a bug was already
 * there yesterday, this deploy is not what broke it, and rolling back would not
 * fix it. A regression that reopens an old issue is deliberately NOT counted;
 * that is a judgement call for a human, not grounds for automatic traffic
 * changes.
 *
 * Level is filtered here rather than in the query: Sentry does not document an
 * `IN` syntax for it, and a silently-ignored query term is exactly what we're
 * trying to avoid. Filtering on the returned objects is verifiable.
 */
async function newErrorsInRelease(sha) {
  const { issues } = await searchIssues(`firstRelease:${sha} is:unresolved`);

  let events = 0;
  let users = 0;
  const worst = [];
  for (const issue of issues) {
    const level = String(issue.level || "error").toLowerCase();
    if (level !== "error" && level !== "fatal") continue;
    const issueEvents = Number(issue.count || 0);
    const issueUsers = Number(issue.userCount || 0);
    events += issueEvents;
    users += issueUsers;
    worst.push({
      title: String(issue.title || "Untitled"),
      events: issueEvents,
      users: issueUsers,
      permalink: String(issue.permalink || ""),
    });
  }
  worst.sort((a, b) => b.events - a.events);
  return { issueCount: worst.length, events, users, worst: worst.slice(0, 5) };
}

function vercelUrl(path, extra = {}) {
  const params = new URLSearchParams(extra);
  if (VERCEL_TEAM_ID) params.set("teamId", VERCEL_TEAM_ID);
  const qs = params.toString();
  return `${VERCEL_API}${path}${qs ? `?${qs}` : ""}`;
}

async function vercel(path, { method = "GET", extra = {} } = {}) {
  const res = await fetch(vercelUrl(path, extra), {
    method,
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Vercel ${method} ${path} returned ${res.status}`);
  }
  return res.json();
}

/**
 * The most recent healthy production build that is NOT the one we're rolling
 * back from.
 *
 * `rollbackCandidate=true` is Vercel's own filter for "instant rollback can
 * target this" — it excludes builds whose output has been pruned, which would
 * otherwise give us a target that 404s.
 */
async function lastKnownGood(badSha) {
  const data = await vercel("/v7/deployments", {
    extra: {
      projectId: VERCEL_PROJECT_ID,
      target: "production",
      state: "READY",
      rollbackCandidate: "true",
      limit: "10",
    },
  });

  const deployments = Array.isArray(data?.deployments) ? data.deployments : [];
  for (const d of deployments) {
    const sha = d?.meta?.githubCommitSha || d?.meta?.commitSha || "";
    // Skip the bad build itself, and any other build of the same commit.
    if (sha && badSha && sha.toLowerCase() === badSha.toLowerCase()) continue;
    return { id: d.uid || d.id, url: d.url, sha, createdAt: d.createdAt };
  }
  return null;
}

async function main() {
  const missing = configured();
  if (missing.length) {
    log(`not configured (${missing.join(", ")}) — standing down.`);
    emit({ action: "skipped", reason: `not configured: ${missing.join(", ")}` });
    return;
  }

  log(`watching release ${DEPLOY_SHA}; soaking ${SOAK_MINUTES}m before judging.`);
  log(`thresholds: >=${MIN_EVENTS} events AND >=${MIN_USERS} users affected.${DRY_RUN ? " DRY RUN — will not act." : ""}`);

  await sleep(SOAK_MINUTES * 60_000);

  if (!(await filterIsTrustworthy())) {
    log("firstRelease: filter returned results for a nonexistent release — refusing to trust its numbers.");
    emit({ action: "escalate", reason: "Sentry firstRelease filter appears to be a no-op; not acting on its counts", sha: DEPLOY_SHA });
    return;
  }

  const stats = await newErrorsInRelease(DEPLOY_SHA);
  log(`new-in-this-release: ${stats.issueCount} issue(s), ${stats.events} event(s), ${stats.users} user(s) affected.`);

  const spiking = stats.events >= MIN_EVENTS && stats.users >= MIN_USERS;

  if (!spiking) {
    log("below threshold — leaving production alone.");
    emit({ action: "none", healthy: true, sha: DEPLOY_SHA, ...stats });
    return;
  }

  log("THRESHOLD CROSSED — this deploy is breaking the site.");

  const target = await lastKnownGood(DEPLOY_SHA);
  if (!target) {
    // Nothing safe to fall back to. Do nothing rather than something creative.
    log("no eligible rollback candidate — escalating to a human instead.");
    emit({ action: "escalate", reason: "no rollback candidate available", sha: DEPLOY_SHA, ...stats });
    return;
  }

  if (DRY_RUN) {
    log(`DRY RUN: would roll back to ${target.id} (${target.sha || "unknown sha"}).`);
    emit({ action: "would-rollback", target, sha: DEPLOY_SHA, ...stats });
    return;
  }

  await vercel(`/v1/projects/${encodeURIComponent(VERCEL_PROJECT_ID)}/rollback/${encodeURIComponent(target.id)}`, {
    method: "POST",
    extra: { description: `Auto-rollback: ${stats.events} new errors across ${stats.users} users after deploying ${DEPLOY_SHA.slice(0, 7)}` },
  });

  log(`rolled back to ${target.id} (${target.sha || "unknown sha"}). The bad commit is still on main for review.`);
  emit({ action: "rolled-back", target, sha: DEPLOY_SHA, ...stats });
}

main().catch((err) => {
  // Fail SAFE, which here means "do not touch production". An error in the
  // watchdog must never be able to trigger a rollback, and must never be able
  // to mask one either — so it reports loudly and exits non-zero.
  log("failed:", err instanceof Error ? err.message : String(err));
  emit({ action: "error", reason: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
