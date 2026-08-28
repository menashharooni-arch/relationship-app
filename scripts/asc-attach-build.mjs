// Attach a processed build to the current App Store version (no submission).
//
//   node scripts/asc-attach-build.mjs 10
import { asc, APP_ID } from "./lib/asc.mjs";
const want = process.argv[2];
if (!want) { console.error("usage: node scripts/asc-attach-build.mjs <buildNumber>"); process.exit(1); }
const b = await asc("GET", `/builds?filter[app]=${APP_ID}&filter[version]=${want}&limit=1&fields[builds]=version,processingState`);
const build = b.data?.[0];
if (!build) { console.error(`build ${want} not found`); process.exit(1); }
if (build.attributes.processingState !== "VALID") { console.error(`build ${want} is ${build.attributes.processingState}, not VALID`); process.exit(1); }
const versions = await asc("GET", `/apps/${APP_ID}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appVersionState`);
const v = versions.data[0];
await asc("PATCH", `/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: build.id } });
const check = await asc("GET", `/appStoreVersions/${v.id}/build?fields[builds]=version`);
console.log(`version ${v.attributes.versionString} (${v.attributes.appVersionState}) now has build ${check.data?.attributes?.version}`);
