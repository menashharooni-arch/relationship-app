#!/usr/bin/env node
// Resubmit the A2P 10DLC campaign after a FAILED review.
//
//   node scripts/a2p-resubmit.mjs --dry     # show what would be sent
//   node scripts/a2p-resubmit.mjs           # delete the failed campaign, recreate
//
// WHY DELETE-AND-RECREATE: Twilio does not expose campaign editing on the
// public API (Console only; API editing is private beta). A FAILED campaign
// cannot be re-reviewed in place, so the supported programmatic path is to
// remove it and submit a fresh one. The brand is untouched — it stays APPROVED
// and is simply referenced again, so none of that vetting is repeated.
//
// It reads the existing campaign first and reuses every field verbatim, so a
// resubmission never silently drops copy that took weeks to get right. It
// refuses to run unless the campaign is actually FAILED.
//
// Credentials: the Twilio CLI profile at ~/.twilio-cli/config.json.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || "MG173ded99039996a73538bc1b5b661b6b";
const API = "https://messaging.twilio.com/v1";
const DRY = process.argv.includes("--dry");

const cfg = JSON.parse(readFileSync(join(homedir(), ".twilio-cli", "config.json"), "utf8"));
const prof = cfg.profiles[cfg.activeProject] ?? Object.values(cfg.profiles)[0];
const auth = "Basic " + Buffer.from(`${prof.apiKey}:${prof.apiSecret}`).toString("base64");

async function tw(method, path, form) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: auth,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.message ?? text.slice(0, 400)}`);
  return json;
}

const list = await tw("GET", `/Services/${SERVICE_SID}/Compliance/Usa2p`);
const current = (list.compliance ?? [])[0];
if (!current) throw new Error("no campaign found on this messaging service");

console.log(`campaign ${current.sid} — status ${current.campaign_status}`);
for (const e of current.errors ?? []) console.log(`  rejection [${e.error_code}] ${e.fields?.join(",")}: ${e.description}`);

if (current.campaign_status !== "FAILED") {
  console.log(`\nNothing to do: only a FAILED campaign should be recreated. Current status is ${current.campaign_status}.`);
  process.exit(0);
}

// Keep a copy before the delete — this payload represents weeks of wording work.
const backup = join(homedir(), ".swiftcard", `a2p-campaign-${current.sid}.json`);
writeFileSync(backup, JSON.stringify(current, null, 1));
console.log(`\nbacked up existing campaign → ${backup}`);

// Speak to the two rejections directly. 30882/30908 said the Terms and the
// Privacy Policy could not be verified, so point the reviewer at the exact
// pages and name what is on them — the disclosures now sit ON /terms rather
// than one link away, which is what the first review was missing. MessageFlow
// is capped at 2049 chars, so only append while it fits.
const ADDENDUM =
  " REVIEW NOTE: program description, frequency, 'Message and data rates may apply', STOP/HELP," +
  " support contact, carrier non-liability, and 'mobile information is never shared or sold to" +
  " third parties or affiliates for marketing' now appear ON https://swiftcard.me/terms and" +
  " https://swiftcard.me/privacy .";
let messageFlow = current.message_flow;
if (messageFlow.length + ADDENDUM.length <= 2049 && !messageFlow.includes("NOTE FOR REVIEW")) {
  messageFlow += ADDENDUM;
} else {
  console.log("  (message flow already at length limit — submitting unchanged)");
}

const form = new URLSearchParams();
form.set("BrandRegistrationSid", current.brand_registration_sid);
form.set("Description", current.description);
form.set("MessageFlow", messageFlow);
form.set("UsAppToPersonUsecase", current.us_app_to_person_usecase);
form.set("HasEmbeddedLinks", String(current.has_embedded_links));
form.set("HasEmbeddedPhone", String(current.has_embedded_phone));
for (const s of current.message_samples ?? []) form.append("MessageSamples", s);
for (const k of current.opt_out_keywords ?? []) form.append("OptOutKeywords", k);
for (const k of current.help_keywords ?? []) form.append("HelpKeywords", k);
if (current.opt_out_message) form.set("OptOutMessage", current.opt_out_message);
if (current.help_message) form.set("HelpMessage", current.help_message);
if (current.opt_in_message) form.set("OptInMessage", current.opt_in_message);
for (const k of current.opt_in_keywords ?? []) form.append("OptInKeywords", k);
if (current.subscriber_opt_in != null) form.set("SubscriberOptIn", String(current.subscriber_opt_in));
if (current.age_gated != null) form.set("AgeGated", String(current.age_gated));
if (current.direct_lending != null) form.set("DirectLending", String(current.direct_lending));

console.log("\npayload to submit:");
for (const [k, v] of form.entries()) console.log(`  ${k} = ${String(v).slice(0, 90)}${String(v).length > 90 ? "…" : ""}`);

if (DRY) {
  console.log("\n--dry: nothing deleted, nothing submitted.");
  process.exit(0);
}

console.log(`\ndeleting failed campaign ${current.sid}…`);
await tw("DELETE", `/Services/${SERVICE_SID}/Compliance/Usa2p/${current.sid}`);

console.log("submitting fresh campaign…");
const created = await tw("POST", `/Services/${SERVICE_SID}/Compliance/Usa2p`, form);
console.log(`\nsubmitted: ${created.sid} — status ${created.campaign_status}`);
for (const e of created.errors ?? []) console.log(`  ${e.error_code}: ${e.description}`);
console.log("\nCarrier review typically takes days; poll with:");
console.log("  node scripts/a2p-status.mjs");
