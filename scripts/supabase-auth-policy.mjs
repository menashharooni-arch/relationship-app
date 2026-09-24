#!/usr/bin/env node
// Keep the Supabase project's password rule equal to src/lib/password-policy.ts.
//
//   node scripts/supabase-auth-policy.mjs            # dry run: shows what would change
//   node scripts/supabase-auth-policy.mjs --apply    # writes it, then reads it back
//   node scripts/supabase-auth-policy.mjs --apply --hibp
//       also turns on leaked-password protection (HaveIBeenPwned). Supabase
//       offers that on the Pro plan and above; on the Free plan the API refuses
//       it, which this script reports without touching the length rule (the two
//       are sent as separate writes for exactly that reason).
//
// What it never does: change mailer_autoconfirm. Instant signup (no confirmation
// email) is an owner decision (2026-09-24), and this script refuses to run at
// all if it finds that setting off, so it can't be used against a project
// someone has quietly reconfigured.
//
// Token: SUPABASE_ACCESS_TOKEN, else ~/.swiftcard/supabase-token, else
// ~/.supabase/access-token (same sources as scripts/supabase-auth-emails.mjs).
// Create one at https://supabase.com/dashboard/account/tokens. Never pass it
// as an argument, where it would land in shell history.
//
// Before writing, the current values of every field it touches are saved to
// ~/.swiftcard/auth-policy-backup-<timestamp>.json, so a revert is one PATCH.
// Re-runnable: fields already equal are left out of the write.
//
// Order with a deploy: ship the form first. Until the site enforces 8 on the
// client, a 6-character signup would pass the browser and be refused here —
// with the friendly "Use at least 8 characters." message, so either order is
// safe; form-first just spares anyone the round-trip.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Mirrors MIN_LENGTH in src/lib/password-policy.ts. Plain JS on purpose (no
// TS import from a script); tests/password-policy.test.ts pins the two equal.
const MIN_LENGTH = 8;

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "grxmovpmlgmjncnyiyrt";
const API = "https://api.supabase.com/v1";
const APPLY = process.argv.includes("--apply");
const HIBP = process.argv.includes("--hibp");

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  for (const p of [join(homedir(), ".swiftcard", "supabase-token"), join(homedir(), ".supabase", "access-token")]) {
    if (existsSync(p)) {
      const t = readFileSync(p, "utf8").trim();
      if (t) return t;
    }
  }
  fail("no Supabase token — set SUPABASE_ACCESS_TOKEN or put it in ~/.swiftcard/supabase-token (https://supabase.com/dashboard/account/tokens)");
}

const headers = { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" };
const url = `${API}/projects/${PROJECT_REF}/config/auth`;

async function readConfig() {
  const res = await fetch(url, { headers });
  if (!res.ok) fail(`could not read auth config (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const config = await readConfig();

// 1. The settings this rule lives next to, printed so a run is a record.
console.log("current password settings:");
for (const k of ["password_min_length", "password_required_characters", "password_hibp_enabled", "mailer_autoconfirm"]) {
  console.log(`    ${k}: ${config[k] == null || config[k] === "" ? "(unset)" : config[k]}`);
}
if (config.mailer_autoconfirm !== true) {
  fail("mailer_autoconfirm is not true — instant signup has been switched off on this project. That is an owner decision; stop and check before changing anything else.");
}

// 2. What should be there.
const lengthWanted = { password_min_length: MIN_LENGTH };
const hibpWanted = HIBP ? { password_hibp_enabled: true } : {};
const writes = [lengthWanted, hibpWanted]
  .map((w) => Object.fromEntries(Object.entries(w).filter(([k, v]) => config[k] !== v)))
  .filter((w) => Object.keys(w).length);

if (!writes.length) {
  console.log(`\nnothing to change — password_min_length is already ${MIN_LENGTH}${HIBP ? " and leaked-password protection is on" : ""}.`);
  process.exit(0);
}
console.log("\nwould write:");
for (const w of writes) for (const [k, v] of Object.entries(w)) console.log(`    ${k}: ${config[k] ?? "(unset)"} → ${v}`);

if (!APPLY) {
  console.log("\ndry run — re-run with --apply to write these.");
  process.exit(0);
}

// 3. Back up exactly what is about to be overwritten.
const dir = join(homedir(), ".swiftcard");
mkdirSync(dir, { recursive: true });
const touched = writes.flatMap((w) => Object.keys(w));
const backup = join(dir, `auth-policy-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backup, JSON.stringify(Object.fromEntries(touched.map((k) => [k, config[k] ?? null])), null, 2));
console.log(`\nbacked up the current values to ${backup}`);

// 4. Separate writes, so a plan-gated refusal of HIBP can't block the length.
let failed = 0;
for (const body of writes) {
  const patch = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!patch.ok) {
    failed++;
    const text = (await patch.text()).slice(0, 400);
    const isHibp = "password_hibp_enabled" in body;
    console.error(`${isHibp ? "leaked-password protection" : "password_min_length"} refused (${patch.status}): ${text}${isHibp ? "\n    (expected on the Free plan — Supabase offers HIBP checks on Pro and above)" : ""}`);
  }
}

// 5. Read it back — a 200 is not proof.
const after = await readConfig();
console.log("\nafter:");
for (const k of ["password_min_length", "password_hibp_enabled", "mailer_autoconfirm"]) console.log(`    ${k}: ${after[k]}`);
if (after.password_min_length !== MIN_LENGTH) fail(`password_min_length reads back as ${after.password_min_length}, not ${MIN_LENGTH}`);
if (after.mailer_autoconfirm !== true) fail("mailer_autoconfirm changed — it must stay true");
if (failed) process.exit(2);
console.log(`applied and verified.`);
