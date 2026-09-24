// Submit EXACTLY version 1.0.3 (pinned id) with build 13 for App Review.
// Refuses on any mismatch. Owner's go on 2026-09-24: "let's ship and commit
// everything to the App Store".
import { asc, APP_ID } from "./lib/asc.mjs";

const VERSION_ID = "7894a513-571d-4a54-8635-5b8c9129ab79";
const WANT_VERSION = "1.0.3";
const WANT_BUILD = "13";
const GO = process.argv.includes("--go");

const v = await asc("GET", `/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=versionString,appStoreState,releaseType`);
const a = v.data.attributes;
console.log(`version ${a.versionString} ${a.appStoreState} release=${a.releaseType}`);
if (a.versionString !== WANT_VERSION) throw new Error("wrong version");
if (a.appStoreState !== "PREPARE_FOR_SUBMISSION") throw new Error("not in PREPARE_FOR_SUBMISSION");

const b = await asc("GET", `/appStoreVersions/${VERSION_ID}/build?fields[builds]=version,processingState`);
console.log(`attached build ${b.data?.attributes?.version} ${b.data?.attributes?.processingState}`);
if (b.data?.attributes?.version !== WANT_BUILD || b.data?.attributes?.processingState !== "VALID") throw new Error("build 13 not attached/VALID");

const loc = await asc("GET", `/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew`);
for (const l of loc.data) {
  console.log(`${l.attributes.locale} whatsNew: ${JSON.stringify((l.attributes.whatsNew ?? "").slice(0, 60))}`);
  if (!l.attributes.whatsNew) throw new Error("empty whatsNew");
  const sets = await asc("GET", `/appStoreVersionLocalizations/${l.id}/appScreenshotSets`);
  for (const s of sets.data) {
    const shots = await asc("GET", `/appScreenshotSets/${s.id}/appScreenshots?limit=10&fields[appScreenshots]=assetDeliveryState`);
    const ok = shots.data.filter((x) => x.attributes.assetDeliveryState?.state === "COMPLETE").length;
    console.log(`  ${s.attributes.screenshotDisplayType}: ${ok}/${shots.data.length} complete`);
    if (ok !== 10) throw new Error("screenshots not complete");
  }
}

const subs = await asc("GET", `/reviewSubmissions?filter[app]=${APP_ID}&limit=5`);
for (const s of subs.data ?? []) console.log(`submission ${s.id} ${s.attributes.state}`);
const open = (subs.data ?? []).filter((s) => !["COMPLETE", "CANCELING", "CANCELED"].includes(s.attributes.state));
if (open.some((s) => s.attributes.state !== "READY_FOR_REVIEW")) throw new Error("another submission is open");

if (!GO) { console.log("\ndry run — pass --go"); process.exit(0); }

let subId = open.find((s) => s.attributes.state === "READY_FOR_REVIEW")?.id;
if (!subId) {
  const created = await asc("POST", "/reviewSubmissions", {
    data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } },
  });
  subId = created.data.id;
  console.log("created submission", subId);
}
await asc("POST", "/reviewSubmissionItems", {
  data: { type: "reviewSubmissionItems", relationships: {
    reviewSubmission: { data: { type: "reviewSubmissions", id: subId } },
    appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
  } },
});
console.log("version added to submission");
const out = await asc("PATCH", `/reviewSubmissions/${subId}`, { data: { type: "reviewSubmissions", id: subId, attributes: { submitted: true } } });
console.log("SUBMITTED:", out.data.attributes.state);
const after = await asc("GET", `/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=appStoreState`);
console.log("version state now:", after.data.attributes.appStoreState);
