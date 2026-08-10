#!/usr/bin/env node
// Where does A2P 10DLC registration actually stand right now?
//
//   node scripts/a2p-status.mjs
//
// Prints brand + campaign state, any rejection errors in full, the carrier
// throughput limits once approved, and whether the sending number is attached
// to the messaging service. Read-only.
//
// Outbound US SMS stays blocked until campaign_status is VERIFIED — a
// campaign in IN_PROGRESS or FAILED means messages will be rejected by
// carriers, so check here before wondering why a send failed.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || "MG173ded99039996a73538bc1b5b661b6b";
const cfg = JSON.parse(readFileSync(join(homedir(), ".twilio-cli", "config.json"), "utf8"));
const prof = cfg.profiles[cfg.activeProject] ?? Object.values(cfg.profiles)[0];
const auth = "Basic " + Buffer.from(`${prof.apiKey}:${prof.apiSecret}`).toString("base64");

const get = async (url) => {
  const r = await fetch(url, { headers: { Authorization: auth } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${url} → ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
};

const brands = await get("https://messaging.twilio.com/v1/a2p/BrandRegistrations");
for (const b of brands.data ?? []) {
  console.log(`BRAND    ${b.sid}`);
  console.log(`         status=${b.status} identity=${b.identity_status} type=${b.brand_type}`);
  if (b.failure_reason) console.log(`         failure: ${b.failure_reason}`);
}

const list = await get(`https://messaging.twilio.com/v1/Services/${SERVICE_SID}/Compliance/Usa2p`);
const c = (list.compliance ?? [])[0];
if (!c) {
  console.log("\nCAMPAIGN none on this messaging service");
} else {
  console.log(`\nCAMPAIGN ${c.sid}`);
  console.log(`         status=${c.campaign_status} usecase=${c.us_app_to_person_usecase}`);
  if (c.campaign_id) console.log(`         TCR id=${c.campaign_id}`);
  for (const e of c.errors ?? []) {
    console.log(`         REJECTED [${e.error_code}] ${(e.fields ?? []).join(", ")}`);
    console.log(`           ${e.description}`);
  }
  const rl = c.rate_limits ?? {};
  if (Object.values(rl).some(Boolean)) {
    console.log("         carrier limits:");
    for (const [carrier, v] of Object.entries(rl)) if (v) console.log(`           ${carrier}: ${JSON.stringify(v)}`);
  }
  console.log(
    c.campaign_status === "VERIFIED"
      ? "\n→ Approved. US outbound SMS is unblocked."
      : `\n→ US outbound SMS is BLOCKED until this reads VERIFIED (currently ${c.campaign_status}).`
  );
}

const nums = await get(`https://messaging.twilio.com/v1/Services/${SERVICE_SID}/PhoneNumbers`);
console.log(`\nNUMBERS attached to the messaging service: ${(nums.phone_numbers ?? []).length}`);
for (const n of nums.phone_numbers ?? []) console.log(`         ${n.phone_number} (${n.sid})`);
