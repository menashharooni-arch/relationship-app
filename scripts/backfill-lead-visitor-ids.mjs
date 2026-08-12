#!/usr/bin/env node
// Give existing contacts back their activity history.
//
//   node scripts/backfill-lead-visitor-ids.mjs [--apply]
//
// Three of the four share surfaces never sent visitor_id, so most contacts
// stored null — and the conversation view joins card_events BY visitor_id, so
// those contacts could never show a single view. New contacts are fixed at the
// source; this is for the ones already in the database.
//
// The match is deliberately narrow. card_events historically carry no name or
// email — only the browser id — so the only available signal is TIME: a person
// opens the card, then shares their details seconds later. So a lead is
// matched to a visitor_id only when, on that same card, within a few minutes
// of the lead being created, there is EXACTLY ONE distinct visitor id. Two
// candidates means two people were on that card at once and either answer
// could be wrong — and attributing one person's visits to another is worse
// than showing no history at all, so those are skipped and printed.
//
// Read-only unless --apply is passed.

import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const WINDOW_MS = 5 * 60 * 1000;

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = env();
const URL_BASE = e.NEXT_PUBLIC_SUPABASE_URL;
const KEY = e.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const get = async (path) => {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
};

const leads = await get("leads?select=id,name,email,phone,visitor_id,card_owner,created_at&visitor_id=is.null&order=created_at.desc&limit=500");
console.log(`${leads.length} contact(s) with no visitor id\n`);

let matched = 0, ambiguous = 0, none = 0;

for (const lead of leads) {
  const t = new Date(lead.created_at).getTime();
  const from = new Date(t - WINDOW_MS).toISOString();
  const to = new Date(t + WINDOW_MS).toISOString();
  const events = await get(
    `card_events?select=visitor_id,event_type,created_at&card_owner_username=eq.${encodeURIComponent(lead.card_owner)}` +
    `&created_at=gte.${encodeURIComponent(from)}&created_at=lte.${encodeURIComponent(to)}&visitor_id=not.is.null`,
  );

  const ids = [...new Set(events.map((x) => x.visitor_id))];
  const label = `${(lead.name || "(no name)").padEnd(20)} ${lead.card_owner}`;

  if (ids.length === 1) {
    matched++;
    console.log(`MATCH      ${label} -> ${ids[0].slice(0, 8)} (${events.length} event(s) in window)`);
    if (APPLY) {
      const r = await fetch(`${URL_BASE}/rest/v1/leads?id=eq.${lead.id}`, {
        method: "PATCH", headers: H, body: JSON.stringify({ visitor_id: ids[0] }),
      });
      if (!r.ok) console.log(`  ! update failed: ${r.status} ${await r.text()}`);
    }
  } else if (ids.length > 1) {
    ambiguous++;
    console.log(`AMBIGUOUS  ${label} -> ${ids.length} visitors in window, skipped`);
  } else {
    none++;
    console.log(`NO EVENTS  ${label}`);
  }
}

console.log(`\nmatched=${matched} ambiguous=${ambiguous} none=${none}  ${APPLY ? "(applied)" : "(dry run — pass --apply to write)"}`);
