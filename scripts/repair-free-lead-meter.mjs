#!/usr/bin/env node
// One-time repair for the Free contact meter (see commit 346fad0a).
//
// Until that fix, every contact a Free account captured was counted THREE times
// (mutateCustomization compared jsonb with key order, saw every write as lost,
// and bumpUsage's retry added 1 each time). So this month a Free account could
// show "12/5" after four contacts, and contacts from roughly the third on were
// stored LOCKED ("open to unlock") when they should have been open.
//
// This script, for every account NOT on a paid plan whose meter is for the
// current month:
//   1. recounts this month's contacts from the leads themselves (the sample
//      contact excluded), and sets the meter to that — never HIGHER than it is
//      now (it only ever corrects downward);
//   2. unlocks any of the month's first FREE_LEADS_PER_MONTH contacts that were
//      locked (removes the "sc-locked" tag). Contacts past the real limit stay
//      locked, exactly as the plan intends.
//
// A contact the owner DELETED this month no longer has a row, so it is not
// recounted — the account gets that slot back. That is the only way this can
// err, and it errs in the customer's favour for one month.
//
// DRY RUN by default — prints what it would change. Add --apply to write.
//   node scripts/repair-free-lead-meter.mjs
//   node scripts/repair-free-lead-meter.mjs --apply
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).

import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/\/$/, "");
const env = existsSync(`${ROOT}/.env.local`) ? readFileSync(`${ROOT}/.env.local`, "utf8") : "";
const g = (k) => process.env[k] ?? (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const SB = g("NEXT_PUBLIC_SUPABASE_URL");
const SVC = g("SUPABASE_SERVICE_ROLE_KEY");
if (!SB || !SVC) { console.error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const APPLY = process.argv.includes("--apply");

const FREE_LEADS_PER_MONTH = 5; // PLAN_LIMITS.FREE_LEADS_PER_MONTH (src/lib/plan.ts)
const LOCKED = "sc-locked";     // LOCKED_LEAD_TAG
const DEMO = "demo";            // the sample contact (lib/demo-contact)
const PAID = new Set(["pro", "enterprise", "office"]);

const now = new Date();
const PERIOD = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const MONTH_START = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

const api = async (path, init = {}) => {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const profiles = [];
for (let from = 0; ; from += 1000) {
  const page = await api(`profiles?select=id,plan,customization&order=id`, { headers: { Range: `${from}-${from + 999}` } });
  profiles.push(...page);
  if (page.length < 1000) break;
}

let accounts = 0, meters = 0, unlocked = 0;
for (const p of profiles) {
  if (PAID.has(String(p.plan ?? "").toLowerCase())) continue;
  const usage = p.customization?._usage;
  if (!usage || usage.period !== PERIOD || !(usage.leads > 0)) continue;

  const cards = await api(`cards?select=username&user_id=eq.${p.id}`);
  const slugs = cards.map((c) => c.username).filter(Boolean);
  const leads = slugs.length
    ? await api(`leads?select=id,tags,created_at&card_owner=in.(${slugs.map((s) => `"${s}"`).join(",")})&created_at=gte.${MONTH_START}&order=created_at.asc`)
    : [];
  const real = leads.filter((l) => !(Array.isArray(l.tags) && l.tags.includes(DEMO)));
  const recount = Math.min(real.length, usage.leads);
  const toUnlock = real.slice(0, FREE_LEADS_PER_MONTH).filter((l) => Array.isArray(l.tags) && l.tags.includes(LOCKED));
  if (recount === usage.leads && !toUnlock.length) continue;

  accounts++;
  console.log(`${p.id}: meter ${usage.leads} → ${recount}; unlock ${toUnlock.length} contact(s)`);
  if (!APPLY) continue;

  if (recount !== usage.leads) {
    // Re-read right before writing so a contact landing meanwhile is not lost.
    const [fresh] = await api(`profiles?select=customization&id=eq.${p.id}`);
    const cust = fresh?.customization ?? {};
    if (cust._usage?.period === PERIOD) {
      // The recount, plus any contact captured since we first read the meter.
      const arrivedSince = Math.max(0, cust._usage.leads - usage.leads);
      cust._usage = { ...cust._usage, leads: Math.min(cust._usage.leads, recount + arrivedSince) };
      await api(`profiles?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ customization: cust }) });
      meters++;
    }
  }
  for (const l of toUnlock) {
    await api(`leads?id=eq.${l.id}`, { method: "PATCH", body: JSON.stringify({ tags: l.tags.filter((t) => t !== LOCKED) }) });
    unlocked++;
  }
}

console.log(`\n${APPLY ? "Applied" : "DRY RUN — nothing written"}: ${accounts} account(s) need repair` + (APPLY ? `; ${meters} meter(s) corrected, ${unlocked} contact(s) unlocked.` : ". Re-run with --apply to fix them."));
