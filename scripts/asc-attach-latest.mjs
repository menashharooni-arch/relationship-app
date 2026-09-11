// node scripts/asc-attach-latest.mjs [--apply]
//
// Attaches the newest VALID build to the version sitting in Prepare for
// Submission. Attaching is NOT submitting — the version stays in Prepare for
// Submission and still needs the Submit for Review button.
import { asc, APP_ID } from "./lib/asc.mjs";

const APPLY = process.argv.includes("--apply");

const vers = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState`);
const v = (vers.data ?? []).find((x) => x.attributes.appStoreState === "PREPARE_FOR_SUBMISSION");
if (!v) { console.log("no version in PREPARE_FOR_SUBMISSION"); process.exit(1); }

const builds = await asc("GET", `/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate&fields[builds]=version,processingState,expired`);
const b = (builds.data ?? []).find((x) => x.attributes.processingState === "VALID" && !x.attributes.expired);
if (!b) { console.log("no VALID build to attach"); process.exit(1); }

console.log(`version ${v.attributes.versionString} (${v.attributes.appStoreState})`);
console.log(`build    ${b.attributes.version} (${b.attributes.processingState})`);

let current = null;
try {
  const cur = await asc("GET", `/appStoreVersions/${v.id}/build?fields[builds]=version`);
  current = cur.data?.attributes?.version ?? null;
} catch { /* none attached */ }
console.log(`currently attached: ${current ?? "NONE"}`);

if (!APPLY) { console.log("\n(dry run — pass --apply to attach)"); process.exit(0); }
if (current === b.attributes.version) { console.log("already attached — nothing to do"); process.exit(0); }

await asc("PATCH", `/appStoreVersions/${v.id}/relationships/build`, {
  data: { type: "builds", id: b.id },
});
const after = await asc("GET", `/appStoreVersions/${v.id}/build?fields[builds]=version`);
console.log(`attached → build ${after.data?.attributes?.version}`);
