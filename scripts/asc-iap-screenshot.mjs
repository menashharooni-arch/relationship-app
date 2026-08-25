// Attach a review screenshot to each subscription so it can reach
// READY_TO_SUBMIT — StoreKit's sandbox refuses to serve products stuck in
// MISSING_METADATA, which is what blanked the paywall in the simulator test.
//
//   node scripts/asc-iap-screenshot.mjs <path-to-png>
//
// Uploads only; nothing is submitted for review.
import { asc } from "./lib/asc.mjs";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import crypto from "node:crypto";

const file = process.argv[2];
const bytes = readFileSync(file);
const md5 = crypto.createHash("md5").update(bytes).digest("hex");

for (const [name, subId] of [["monthly", "6804832192"], ["annual", "6804832278"]]) {
  const existing = await asc("GET", `/subscriptions/${subId}/appStoreReviewScreenshot`).catch(() => null);
  if (existing?.data) { console.log(name, "screenshot already attached"); continue; }
  const created = await asc("POST", "/subscriptionAppStoreReviewScreenshots", {
    data: {
      type: "subscriptionAppStoreReviewScreenshots",
      attributes: { fileName: basename(file), fileSize: bytes.length },
      relationships: { subscription: { data: { type: "subscriptions", id: subId } } },
    },
  });
  const op = created.data.attributes.uploadOperations[0];
  const headers = {};
  for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
  const up = await fetch(op.url, { method: op.method, headers, body: bytes });
  if (!up.ok) { console.log(name, "upload failed", up.status); continue; }
  await asc("PATCH", `/subscriptionAppStoreReviewScreenshots/${created.data.id}`, {
    data: {
      type: "subscriptionAppStoreReviewScreenshots",
      id: created.data.id,
      attributes: { uploaded: true, sourceFileChecksum: md5 },
    },
  });
  console.log(name, "screenshot uploaded + committed");
}
for (const [name, subId] of [["monthly", "6804832192"], ["annual", "6804832278"]]) {
  const r = await asc("GET", `/subscriptions/${subId}`);
  console.log(name, "state:", r.data.attributes.state);
}
