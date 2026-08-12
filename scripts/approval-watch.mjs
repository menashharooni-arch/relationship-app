#!/usr/bin/env node
// Watch the two pending approvals — App Store review and the A2P campaign —
// and print one line per state change. Exits when both reach a terminal state.
//
//   node scripts/approval-watch.mjs
//
// Both are other people's queues (Apple review, TCR/Twilio review) with no
// webhooks available to us, so polling is the only option. 30 minutes is
// plenty: App Store review changes a handful of times over days, and TCR
// campaign reviews flip once.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { asc, APP_ID } from "./lib/asc.mjs";

const EVERY = Number(process.env.WATCH_POLL_SECONDS || 1800) * 1000;
const say = (s) => console.log(s);

// Apple: appStoreState of the 1.0.0 version.
const APPLE_DONE = new Set([
  "READY_FOR_SALE", "ACCEPTED", "REJECTED", "METADATA_REJECTED",
  "DEVELOPER_REJECTED", "INVALID_BINARY",
]);
let lastApple = "";
let appleDone = false;
async function checkApple() {
  const v = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=1`);
  const st = v.data?.[0]?.attributes?.appStoreState ?? "?";
  if (st !== lastApple) {
    say(`APPLE App Store 1.0.0: ${lastApple || "—"} → ${st}`);
    lastApple = st;
  }
  if (APPLE_DONE.has(st)) {
    say(st === "READY_FOR_SALE" || st === "ACCEPTED"
      ? "🎉 APPLE APPROVED — the app is (or is about to be) live on the App Store."
      : `❌ APPLE decision: ${st} — needs attention.`);
    appleDone = true;
  }
}

// Twilio: A2P campaign status on the messaging service.
const SERVICE_SID = "MG173ded99039996a73538bc1b5b661b6b";
let lastTwilio = "";
let twilioDone = false;
async function checkTwilio() {
  const cfg = JSON.parse(readFileSync(join(homedir(), ".twilio-cli", "config.json"), "utf8"));
  const prof = cfg.profiles[cfg.activeProject] ?? Object.values(cfg.profiles)[0];
  const auth = "Basic " + Buffer.from(`${prof.apiKey}:${prof.apiSecret}`).toString("base64");
  const res = await fetch(
    `https://messaging.twilio.com/v1/Services/${SERVICE_SID}/Compliance/Usa2p`,
    { headers: { Authorization: auth } },
  );
  const j = await res.json();
  const c = (j.compliance ?? [])[0];
  const st = c?.campaign_status ?? "?";
  if (st !== lastTwilio) {
    say(`TWILIO A2P campaign: ${lastTwilio || "—"} → ${st}`);
    lastTwilio = st;
  }
  if (st === "VERIFIED") {
    say("🎉 TWILIO APPROVED — US outbound SMS is unblocked on (917) 905-7335.");
    twilioDone = true;
  } else if (st === "FAILED") {
    const errs = (c.errors ?? []).map((e) => e.error_code).join(",");
    say(`❌ TWILIO campaign FAILED again (${errs}) — reply on ticket #28933836.`);
    twilioDone = true;
  }
}

for (;;) {
  if (!appleDone) await checkApple().catch((e) => say(`apple check failed: ${e.message}`));
  if (!twilioDone) await checkTwilio().catch((e) => say(`twilio check failed: ${e.message}`));
  if (appleDone && twilioDone) { say("both watches closed."); break; }
  await new Promise((r) => setTimeout(r, EVERY));
}
