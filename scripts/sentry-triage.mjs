#!/usr/bin/env node
// ── Sentry triage: discover which issues need a draft fix ────────────────────
//
// Read-only. Fetches unresolved issues seen in the last 24h and prints a JSON
// array to stdout for the workflow to fan out over. It NEVER writes to Sentry,
// never touches git, and never opens anything — the workflow does that, so the
// dangerous half stays in one reviewable place.
//
// Run manually:
//   SENTRY_ORG=… SENTRY_PROJECT=… SENTRY_AUTH_TOKEN=… node scripts/sentry-triage.mjs
//
// Exits 0 with `[]` when unconfigured, so a repo without Sentry secrets gets a
// green no-op rather than a daily red X.

const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;
const TOKEN = process.env.SENTRY_AUTH_TOKEN;
const HOST = process.env.SENTRY_HOST || "https://sentry.io";

/**
 * Hard cap on issues per run.
 *
 * Two reasons, both learned the hard way by people who skipped it: a bad deploy
 * can produce dozens of distinct issues, and without a cap this opens dozens of
 * PRs and burns a matching amount of API budget in one night. Five is a reviewable
 * morning's worth; the rest are still in Sentry and get picked up tomorrow.
 */
const MAX_ISSUES = Number(process.env.TRIAGE_MAX_ISSUES || 5);

/** Ignore anything trivial — noise crowds out the real regression. */
const MIN_EVENTS = Number(process.env.TRIAGE_MIN_EVENTS || 2);

function out(value) {
  process.stdout.write(JSON.stringify(value));
}

if (!ORG || !PROJECT || !TOKEN) {
  console.error("[triage] SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN not set — nothing to do.");
  out([]);
  process.exit(0);
}

/**
 * Stable, filesystem- and git-safe slug derived from the Sentry issue id.
 *
 * Deterministic on purpose: the workflow uses it as the branch name, so a
 * re-run finds the branch already exists and skips instead of opening a second
 * PR for the same issue. That is the dedupe mechanism.
 */
function branchSlug(issue) {
  const title = (issue.title || "issue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `sentry-${issue.id}-${title || "issue"}`;
}

/**
 * Severity for the PR body, so a human can sort the morning's queue without
 * opening each one. Users-affected outranks raw event count: 200 errors from one
 * bot matters less than 12 real people who couldn't share a card.
 */
function severity(issue) {
  const users = Number(issue.userCount || 0);
  const events = Number(issue.count || 0);
  if (issue.level === "fatal" || users >= 10) return "critical";
  if (users >= 3 || events >= 50) return "high";
  if (users >= 1 || events >= 10) return "medium";
  return "low";
}

async function main() {
  // lastSeen:-24h catches BOTH new issues and old ones that started happening
  // again (a regression an existing group reopens into) — "new or recurring".
  const params = new URLSearchParams({
    query: "is:unresolved lastSeen:-24h",
    statsPeriod: "24h",
    sort: "freq",
    limit: "25",
  });
  const url = `${HOST}/api/0/projects/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/issues/?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });

  if (!res.ok) {
    // Never print the body raw — a Sentry error response can echo request
    // context. Status alone is enough to diagnose auth vs project-not-found.
    console.error(`[triage] Sentry API returned ${res.status}. Check SENTRY_ORG/PROJECT and the token's project:read scope.`);
    out([]);
    process.exit(0);
  }

  const issues = await res.json();
  if (!Array.isArray(issues)) {
    console.error("[triage] Unexpected Sentry response shape — expected an array.");
    out([]);
    process.exit(0);
  }

  const selected = issues
    .filter((i) => Number(i.count || 0) >= MIN_EVENTS)
    .slice(0, MAX_ISSUES)
    .map((i) => ({
      id: String(i.id),
      shortId: String(i.shortId || i.id),
      title: String(i.title || "Untitled issue"),
      culprit: String(i.culprit || ""),
      level: String(i.level || "error"),
      events: Number(i.count || 0),
      users: Number(i.userCount || 0),
      firstSeen: String(i.firstSeen || ""),
      lastSeen: String(i.lastSeen || ""),
      permalink: String(i.permalink || ""),
      severity: severity(i),
      branch: branchSlug(i),
    }));

  console.error(`[triage] ${issues.length} issue(s) in window, ${selected.length} selected (cap ${MAX_ISSUES}).`);
  out(selected);
}

main().catch((err) => {
  // Fail SOFT: a triage outage must never look like a broken build, or the daily
  // red X trains everyone to ignore this workflow.
  console.error("[triage] failed:", err instanceof Error ? err.message : String(err));
  out([]);
  process.exit(0);
});
