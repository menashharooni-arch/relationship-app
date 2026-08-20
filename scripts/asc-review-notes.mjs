// Read (and with --set, update) the App Review notes + demo-account fields.
//
//   node scripts/asc-review-notes.mjs            # print current review details
//   node scripts/asc-review-notes.mjs --set      # PATCH notes from NOTES below
//
// Exists because the 1.0.0 (3) rejection was partly self-inflicted: the notes
// claimed "nothing is unlocked in-app" while the demo account was Pro. The
// notes must describe the build exactly — see docs/ios-review.
import { asc, APP_ID } from "./lib/asc.mjs";

import { readFileSync } from "node:fs";
const notesFile = process.env.ASC_REVIEW_NOTES_FILE;
const NOTES = notesFile ? readFileSync(notesFile, "utf8").trim() : (process.env.ASC_REVIEW_NOTES || null);

const details = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=3&include=appStoreReviewDetail`);
const versions = details.data || [];
for (const v of versions) {
  console.log(`version ${v.attributes.versionString} — ${v.attributes.appVersionState}`);
}
const current = versions[0];
if (!current) process.exit(0);

const rd = await asc("GET", `/appStoreVersions/${current.id}/appStoreReviewDetail`);
const a = rd.data?.attributes || {};
console.log("\n— App Review Details —");
console.log("demo account:", a.demoAccountName, "| demoRequired:", a.demoAccountRequired);
console.log("contact:", a.contactFirstName, a.contactLastName, a.contactEmail, a.contactPhone);
console.log("\n— Notes —\n" + (a.notes || "(empty)"));

if (process.argv.includes("--set") && NOTES) {
  const res = await asc("PATCH", `/appStoreReviewDetails/${rd.data.id}`, {
    data: { type: "appStoreReviewDetails", id: rd.data.id, attributes: { notes: NOTES } },
  });
  console.log("\nPATCHED notes ok:", !!res.data);
}
