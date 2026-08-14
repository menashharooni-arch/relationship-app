#!/usr/bin/env node
// ── "What has shipped since the assistants last learned anything?" ──────────
//
// The support assistants answer from src/lib/knowledge. Facts that live in a
// data structure (prices, limits, templates, CRM providers) flow in on their
// own via knowledge/derived.ts. Facts that live only as BEHAVIOUR — a new tab,
// a renamed button, a flow that gained a step — cannot, and that is exactly the
// kind of change that used to leave the chatbot confidently describing a UI
// that no longer existed.
//
// This script names those changes: every user-facing file touched since the
// knowledge base was last updated, newest first, with the commits that did it.
// Run it before a release, or when the assistant starts sounding out of date:
//
//   npm run kb:check            → report (exit 0)
//   npm run kb:check -- --strict → exit 1 if anything is unreviewed (for CI)
//
// It is deliberately a REPORT, not a gate: not every component edit changes
// what a user should be told. The hard guarantees are in
// tests/knowledge-truth.test.ts, which fails the build outright.

import { execFileSync } from "node:child_process";

const strict = process.argv.includes("--strict");

// execFile, not exec: file paths from `git diff` land in these argument lists,
// and a filename containing a quote or a semicolon must stay one argument
// rather than becoming shell syntax.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

// Paths whose changes can alter what a user must be told.
const USER_FACING = [
  "src/app",
  "src/components",
  "src/lib/plan.ts",
  "src/lib/plan-content.ts",
  "src/lib/email-templates.ts",
  "src/lib/template-style-presets.ts",
];

// …minus the ones that never change an answer.
const IGNORE = [
  /^src\/app\/api\/(?!ai\/)/, // server routes, except the assistants themselves
  /^src\/app\/admin\//,       // internal staff console — never described to customers
  /\.test\.tsx?$/,
  /^src\/lib\/knowledge\//,
  /layout\.tsx$/,
  /loading\.tsx$/,
  /^src\/app\/(sitemap|robots|opengraph-image|icon|apple-icon)/,
];

const KB = "src/lib/knowledge";

let since;
try {
  since = git("log", "-1", "--format=%H", "--", KB);
} catch {
  console.error("Not a git repository — nothing to compare.");
  process.exit(0);
}

if (!since) {
  console.log(`No commit has touched ${KB} yet — the knowledge base is brand new.`);
  process.exit(0);
}

const [date, subject] = git("log", "-1", "--format=%cs%n%s", since).split("\n");
console.log(`Knowledge base last updated ${date} — "${subject}" (${since.slice(0, 8)})\n`);

const changed = git("diff", "--name-only", `${since}..HEAD`, "--", ...USER_FACING)
  .split("\n")
  .filter(Boolean)
  .filter((f) => !IGNORE.some((re) => re.test(f)));

if (!changed.length) {
  console.log("✓ No user-facing changes since then. The assistants are current.");
  process.exit(0);
}

console.log(`${changed.length} user-facing file(s) changed since the knowledge base was last updated:\n`);
for (const f of changed) {
  console.log(`  ${f}\n      ↳ ${git("log", "-1", "--format=%s", `${since}..HEAD`, "--", f)}`);
}

console.log(`\nCommits in that range:`);
console.log(git("log", "--oneline", `${since}..HEAD`).split("\n").map((l) => `  ${l}`).join("\n"));

console.log(`
Next: decide which of these changed what a user should be TOLD, then update the
matching doc in ${KB}/docs/ and re-run. Prices, limits, templates and CRM
providers need no action — knowledge/derived.ts reads those from the code.`);

process.exit(strict ? 1 : 0);
