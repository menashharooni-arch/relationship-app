#!/usr/bin/env node
// ── One-command Agent Flow bootstrap ─────────────────────────────────────────
// Run by the OWNER, once:   node scripts/agent-flow-setup.mjs
//
// Does everything the Agent Flow system needs so nothing else has to be
// touched by hand — no Supabase dashboard, no GitHub settings pages:
//   1. Applies supabase/agent-flow.sql via the Supabase Management API
//      (token: ~/.swiftcard/supabase-token, same as supabase-enable-apple.mjs)
//   2. Verifies the tables + seeded settings rows
//   3. Sets the GitHub Actions secrets the agents need (gh CLI)
//   4. Adds the Vercel env vars the tab's Run buttons + email relay need
//   5. Triggers a production redeploy so those env vars go live
// Idempotent: safe to re-run (schema is IF NOT EXISTS; secrets just overwrite).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

const ok = (m) => console.log(`  ✓ ${m}`);
const step = (m) => console.log(`\n${m}`);
const sh = (cmd, args, input) => execFileSync(cmd, args, { encoding: "utf8", input, stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"] }).trim();

// ── env sources ──────────────────────────────────────────────────────────────
const envLocal = readFileSync(".env.local", "utf8");
const env = (k) => envLocal.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.replace(/^"|"$/g, "");
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const SBP = readFileSync(join(homedir(), ".swiftcard", "supabase-token"), "utf8").trim();
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error(".env.local missing supabase vars");

// ── 1. schema ────────────────────────────────────────────────────────────────
step("1/5 Applying supabase/agent-flow.sql (Supabase Management API)…");
const sql = readFileSync("supabase/agent-flow.sql", "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SBP}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) throw new Error(`schema apply failed: ${res.status} ${(await res.text()).slice(0, 400)}`);
ok("schema applied (idempotent — safe on re-runs)");

// ── 2. verify ────────────────────────────────────────────────────────────────
step("2/5 Verifying tables…");
// PostgREST caches the schema; brand-new tables 404 (PGRST205) for up to a
// minute after DDL. Nudge the cache, then retry until the tables answer.
await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SBP}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
}).catch(() => {});
let rows = null;
for (let i = 0; i < 12; i++) {
  rows = await fetch(`${SUPABASE_URL}/rest/v1/agent_settings?select=agent_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).then((r) => r.json()).catch(() => null);
  if (Array.isArray(rows) && rows.length >= 10) break;
  await new Promise((r) => setTimeout(r, 5000));
}
if (!Array.isArray(rows) || rows.length < 10) throw new Error(`agent_settings still not visible after 60s: ${JSON.stringify(rows).slice(0, 200)}`);
ok(`agent tables live — ${rows.length} agents seeded`);

// ── 3. GitHub Actions secrets ────────────────────────────────────────────────
step("3/5 Setting GitHub Actions secrets…");
const relaySecret = crypto.randomBytes(24).toString("hex");
for (const [name, value] of [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
  ["AGENT_RELAY_SECRET", relaySecret],
]) { sh("gh", ["secret", "set", name, "--body", value]); ok(`gh secret ${name}`); }
console.log("    (LLM key: set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN when you want the research agents — `claude setup-token` for Max)");

// ── 4. Vercel env ────────────────────────────────────────────────────────────
step("4/5 Adding Vercel production env vars…");
const ghToken = sh("gh", ["auth", "token"]);
for (const [name, value] of [
  ["AGENT_RELAY_SECRET", relaySecret],       // powers /api/agent-email
  ["GITHUB_AGENTS_TOKEN", ghToken],           // powers the tab's Run buttons
]) {
  try { sh("npx", ["vercel", "env", "rm", name, "production", "--yes"]); } catch { /* didn't exist */ }
  sh("npx", ["vercel", "env", "add", name, "production"], value);
  ok(`vercel env ${name}`);
}
console.log("    NOTE: GITHUB_AGENTS_TOKEN is your gh CLI token (repo+workflow). Swap it for a fine-grained PAT (Actions: read/write) whenever you like.");

// ── 5. redeploy so the env vars go live ──────────────────────────────────────
step("5/5 Redeploying production…");
try {
  const list = sh("npx", ["vercel", "ls", "--yes"]);
  const url = list.match(/https:\/\/\S+vercel\.app/)?.[0];
  console.log(sh("npx", ["vercel", "redeploy", url, "--yes"]).split("\n").slice(-2).join("\n"));
  ok("redeploy triggered");
} catch (e) {
  console.log(`  ⚠ auto-redeploy failed (${String(e).slice(0, 120)}) — push any commit and it deploys with the new env.`);
}

console.log("\nDONE. Open swiftcard.me/admin/agent-flow — the setup card is gone; Start All / Run now are live.");
