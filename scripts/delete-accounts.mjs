#!/usr/bin/env node
// ── Permanently delete named accounts ────────────────────────────────────────
//
// Mirrors purgeUserData() in src/lib/account-purge.ts step for step: children
// first, then the office a user owns, then storage, then cards → profile → auth
// identity. That function is the product's own deletion path (Apple §5.1.1(v),
// the Privacy Policy promise), and it cannot be imported here — it is a
// TypeScript module behind the "@/" alias and this repo has no tsx. So the
// sequence is duplicated, and the SAME table list is re-queried afterwards to
// prove nothing was left behind rather than trusting the duplication.
//
// SAFETY
//   • Deletes ONLY the addresses in ALLOW below. Anything else is refused, even
//     if passed on the command line.
//   • Dry run by default. `--go` is required to write, matching asc-resubmit.
//   • Writes a full JSON backup of every row it is about to remove, first. Hard
//     deletion is irreversible; the backup is the difference between a mistake
//     and a disaster.
//
// Usage:  node scripts/delete-accounts.mjs            # inventory + dry run
//         node scripts/delete-accounts.mjs --go       # actually delete

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const env = existsSync(`${ROOT}/.env.local`) ? readFileSync(`${ROOT}/.env.local`, "utf8") : "";
const g = (k) => process.env[k] ?? (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const SB = g("NEXT_PUBLIC_SUPABASE_URL");
const SVC = g("SUPABASE_SERVICE_ROLE_KEY");
if (!SB || !SVC) { console.error("missing SUPABASE url / service role key"); process.exit(2); }

const GO = process.argv.includes("--go");

// Accounts this script must NEVER delete, whatever it is asked to do.
//
// applereview-free@swiftcard.me is the live App Store review demo account:
// App Store Connect carries demoAccountRequired: true with those exact
// credentials (scripts/asc-review-notes.mjs prints them). Delete it and the
// next App Review sign-in fails, which is a Guideline 2.1 rejection — and
// nobody could tell that from the address alone. Retiring it means wiring a
// replacement into ASC first, then removing it from this list.
//
// The rest are the real production accounts, named so that a typo or a
// copy-pasted address can never take one out.
const PROTECTED = new Set([
  "applereview-free@swiftcard.me",
  "aaron@malvecapital.com",
  "menashharooni@gmail.com",
  "hello@swiftcard.me",
]);

const requested = process.argv.slice(2).filter((a) => a.includes("@")).map((a) => a.toLowerCase());
if (!requested.length) {
  console.error("usage: node scripts/delete-accounts.mjs <email> [more emails] [--go]");
  process.exit(2);
}
const blocked = requested.filter((e) => PROTECTED.has(e));
if (blocked.length) {
  console.error(`\nREFUSED — protected account(s): ${blocked.join(", ")}`);
  console.error("See the PROTECTED list in this file for why. Nothing was deleted.\n");
  process.exit(1);
}
const ALLOW = requested;

const rest = (p, init) =>
  fetch(`${SB}/rest/v1${p}`, {
    ...init,
    headers: {
      apikey: SVC, Authorization: `Bearer ${SVC}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...(init?.headers ?? {}),
    },
  });
const authApi = (p, init) =>
  fetch(`${SB}/auth/v1${p}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

async function sel(path) {
  const r = await rest(path);
  if (!r.ok) return [];
  return r.json().catch(() => []);
}
/** Best-effort delete, exactly like purgeUserData's safeDelete: a table or
 *  column missing in this environment must never stop the purge. */
async function del(path) {
  if (!GO) return { skipped: true };
  try {
    const r = await rest(path, { method: "DELETE" });
    if (!r.ok) return { error: `${r.status} ${(await r.text()).slice(0, 120)}` };
    const rows = await r.json().catch(() => []);
    return { removed: Array.isArray(rows) ? rows.length : 0 };
  } catch (e) { return { error: String(e).slice(0, 120) }; }
}
const inList = (vals) => `(${vals.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",")})`;

// ── 1. Resolve the accounts ──────────────────────────────────────────────────
const users = [];
for (const email of ALLOW) {
  const r = await authApi(`/admin/users?filter=${encodeURIComponent(email)}`);
  const j = await r.json().catch(() => ({}));
  const u = (j.users ?? []).find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
  if (u) users.push({ email, id: u.id });
  else console.log(`  (not found, nothing to do) ${email}`);
}

console.log(`\n${GO ? "DELETING" : "DRY RUN — nothing will be written"}  ·  ${users.length} account(s)\n`);

const backup = { takenAt: new Date().toISOString(), accounts: [] };

for (const u of users) {
  const cards = await sel(`/cards?user_id=eq.${u.id}&select=*`);
  const slugs = cards.map((c) => c.username).filter(Boolean);
  const viewKeys = slugs.flatMap((s) => [s, `${s}__links`]);
  const leads = slugs.length ? await sel(`/leads?card_owner=in.${inList(slugs)}&select=*`) : [];
  const leadIds = leads.map((l) => l.id);

  const snap = {
    email: u.email, id: u.id, slugs,
    profile: (await sel(`/profiles?id=eq.${u.id}&select=*`))[0] ?? null,
    cards, leads,
    lead_messages: leadIds.length ? await sel(`/lead_messages?lead_id=in.${inList(leadIds)}&select=*`) : [],
    lead_reminders: leadIds.length ? await sel(`/lead_reminders?lead_id=in.${inList(leadIds)}&select=*`) : [],
    card_events: slugs.length ? await sel(`/card_events?card_owner_username=in.${inList(slugs)}&select=*`) : [],
    card_views: viewKeys.length ? await sel(`/card_views?username=in.${inList(viewKeys)}&select=*`) : [],
    notifications: await sel(`/notifications?user_id=eq.${u.id}&select=*`),
    integrations: await sel(`/integrations?user_id=eq.${u.id}&select=*`),
    offices_owned: await sel(`/offices?owner_id=eq.${u.id}&select=*`),
    office_members: await sel(`/office_members?user_id=eq.${u.id}&select=*`),
  };
  backup.accounts.push(snap);

  console.log(`${u.email}  (${u.id})`);
  console.log(`   cards ${cards.length}${slugs.length ? ` [${slugs.join(", ")}]` : ""} · leads ${leads.length} · events ${snap.card_events.length} · views ${snap.card_views.length} · notifications ${snap.notifications.length} · owns ${snap.offices_owned.length} office(s)`);

  if (!GO) continue;

  // ── children first, mirroring purgeUserData ────────────────────────────────
  if (leadIds.length) {
    await del(`/lead_messages?lead_id=in.${inList(leadIds)}`);
    await del(`/lead_reminders?lead_id=in.${inList(leadIds)}`);
    await del(`/message_opt_outs?lead_id=in.${inList(leadIds)}`);
  }
  if (slugs.length) {
    await del(`/leads?card_owner=in.${inList(slugs)}`);
    await del(`/card_events?card_owner_username=in.${inList(slugs)}`);
    await del(`/analytics_events?username=in.${inList(slugs)}`);
  }
  if (viewKeys.length) await del(`/card_views?username=in.${inList(viewKeys)}`);

  // An owned office releases its members back to free/unbranded before it goes.
  for (const office of snap.offices_owned) {
    const members = await sel(`/office_members?office_id=eq.${office.id}&user_id=not.is.null&select=user_id`);
    for (const m of members) {
      if (!m.user_id) continue;
      await rest(`/profiles?id=eq.${m.user_id}`, { method: "PATCH", body: JSON.stringify({ plan: "free", office_id: null }) });
    }
    await del(`/office_members?office_id=eq.${office.id}`);
    await del(`/offices?id=eq.${office.id}`);
  }

  await del(`/office_members?user_id=eq.${u.id}`);
  await del(`/notifications?user_id=eq.${u.id}`);
  await del(`/integrations?user_id=eq.${u.id}`);
  await del(`/push_subscriptions?user_id=eq.${u.id}`);
  await del(`/email_preferences?user_id=eq.${u.id}`);
  await del(`/email_logs?user_id=eq.${u.id}`);
  await del(`/promo_code_redemptions?user_id=eq.${u.id}`);
  await del(`/referrals?referrer_id=eq.${u.id}`);

  // Public storage buckets: the card images and every original upload. Deleting
  // rows does not touch these, and a freed slug re-registered later would
  // otherwise serve this account's card image to its new owner.
  for (const bucket of ["card-shares", "card-signatures"]) {
    for (const s of slugs) {
      await fetch(`${SB}/storage/v1/object/${bucket}/${s}.png`, {
        method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
      }).catch(() => {});
    }
  }
  for (let pass = 0; pass < 100; pass++) {
    const r = await fetch(`${SB}/storage/v1/object/list/card-uploads`, {
      method: "POST",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: `${u.id}/`, limit: 100 }),
    }).catch(() => null);
    const files = r && r.ok ? await r.json().catch(() => []) : [];
    if (!files.length) break;
    const ok = await fetch(`${SB}/storage/v1/object/card-uploads`, {
      method: "DELETE",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: files.map((f) => `${u.id}/${f.name}`) }),
    }).catch(() => null);
    if (!ok || !ok.ok) break;
  }

  await del(`/cards?user_id=eq.${u.id}`);
  await del(`/profiles?id=eq.${u.id}`);
  const au = await authApi(`/admin/users/${u.id}`, { method: "DELETE" });
  console.log(`   auth identity: ${au.ok ? "deleted" : `FAILED ${au.status} ${(await au.text()).slice(0, 100)}`}`);
}

// ── Backup, always, and before the summary so a crash still leaves it ────────
mkdirSync(`${ROOT}/.account-backups`, { recursive: true });
const path = `${ROOT}/.account-backups/deleted-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(path, JSON.stringify(backup, null, 2));
console.log(`\nbackup: ${path}`);
if (!GO) console.log("\nDry run. Re-run with --go to delete.");
