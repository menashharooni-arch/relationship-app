#!/usr/bin/env node
// Apply SwiftCard's auth email templates (supabase/auth-email-templates.mjs)
// and the "SwiftCard" sender name to the Supabase project.
//
//   node scripts/supabase-auth-emails.mjs            # dry run: shows what would change
//   node scripts/supabase-auth-emails.mjs --apply    # writes it, then reads it back
//
// Token: SUPABASE_ACCESS_TOKEN, else ~/.swiftcard/supabase-token, else
// ~/.supabase/access-token (same sources as scripts/supabase-enable-apple.mjs).
// Create one at https://supabase.com/dashboard/account/tokens. Never pass it
// as an argument, where it would land in shell history.
//
// ORDER MATTERS: the templates link to /auth/confirm, so that route must be
// live on swiftcard.me BEFORE this runs. The script checks it is.
//
// Before writing, the current values of every field it touches are saved to
// ~/.swiftcard/auth-email-backup-<timestamp>.json, so a revert is one PATCH.
// Re-runnable: fields already equal are left out of the write.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { AUTH_EMAILS, SENDER_NAME, SITE } from "../supabase/auth-email-templates.mjs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "grxmovpmlgmjncnyiyrt";
const API = "https://api.supabase.com/v1";
const APPLY = process.argv.includes("--apply");

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

// 1. The route the links point at must already be live.
{
  const probe = await fetch(`${SITE}/auth/confirm`, { redirect: "manual" }).catch(() => null);
  const to = probe?.headers.get("location") ?? "";
  if (!probe || probe.status < 300 || probe.status >= 400 || !/\/login\?error=oauth/.test(to)) {
    fail(`${SITE}/auth/confirm is not live yet (got ${probe?.status ?? "no response"} → ${to || "-"}). Deploy first.`);
  }
  console.log(`ok  ${SITE}/auth/confirm is live (a bare request is sent to ${to})`);
}

const headers = { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" };
const res = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, { headers });
if (!res.ok) fail(`could not read auth config (${res.status}): ${(await res.text()).slice(0, 300)}`);
const config = await res.json();

// 2. What the links rely on.
console.log(`    site_url: ${config.site_url}`);
const allow = String(config.uri_allow_list || "").split(",").map((s) => s.trim()).filter(Boolean);
const callbackAllowed = allow.some((u) => u.startsWith(`${SITE}/auth/callback`) || u === `${SITE}/**` || u === `${SITE}/*`);
console.log(`    redirect allow-list covers ${SITE}/auth/callback: ${callbackAllowed ? "yes" : "NO"}`);
if (!callbackAllowed) console.log("    ! RedirectTo would fall back to the Site URL; links still verify, but lose where the person was going.");
const customSmtp = !!config.smtp_host;
console.log(`    custom SMTP: ${customSmtp ? `${config.smtp_host} as ${config.smtp_admin_email}` : "no (Supabase's built-in sender)"}`);

// 3. The wanted values, and which differ.
const wanted = {};
for (const [key, { subject, content }] of Object.entries(AUTH_EMAILS)) {
  wanted[`mailer_subjects_${key}`] = subject;
  wanted[`mailer_templates_${key}_content`] = content;
}
// The sender name only applies to custom SMTP; the built-in sender ignores it.
if (customSmtp) wanted.smtp_sender_name = SENDER_NAME;

const changes = Object.fromEntries(Object.entries(wanted).filter(([k, v]) => config[k] !== v));
if (!Object.keys(changes).length) {
  console.log("\nnothing to change — the project already has these templates.");
  process.exit(0);
}
console.log(`\n${Object.keys(changes).length} field(s) differ:`);
for (const k of Object.keys(changes)) {
  const was = config[k] == null ? "(unset)" : String(config[k]).replace(/\s+/g, " ").slice(0, 70);
  console.log(`  ${k}\n      was: ${was}`);
}

if (!APPLY) {
  console.log("\ndry run — re-run with --apply to write these.");
  process.exit(0);
}

// 4. Back up exactly what is about to be overwritten.
const dir = join(homedir(), ".swiftcard");
mkdirSync(dir, { recursive: true });
const backup = join(dir, `auth-email-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backup, JSON.stringify(Object.fromEntries(Object.keys(changes).map((k) => [k, config[k] ?? null])), null, 2));
console.log(`\nbacked up the current values to ${backup}`);

const patch = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, { method: "PATCH", headers, body: JSON.stringify(changes) });
if (!patch.ok) fail(`update failed (${patch.status}): ${(await patch.text()).slice(0, 400)}`);

// 5. Read it back — a 200 is not proof.
const after = await (await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, { headers })).json();
const mismatched = Object.keys(changes).filter((k) => after[k] !== changes[k]);
if (mismatched.length) fail(`written but read back different: ${mismatched.join(", ")}`);
console.log(`applied and verified ${Object.keys(changes).length} field(s).`);
