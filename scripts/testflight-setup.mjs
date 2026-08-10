#!/usr/bin/env node
// Put the latest build in front of an internal tester so it appears in TestFlight.
//
//   node scripts/testflight-setup.mjs --dry
//   node scripts/testflight-setup.mjs
//
// A freshly uploaded build sits at READY_FOR_BETA_TESTING but belongs to no
// beta group, so nobody can install it — App Store Connect shows no error for
// this, the build just never appears on anyone's phone. This creates the
// internal group, attaches the build, and adds the tester.
//
// INTERNAL, deliberately: internal testing needs no Beta App Review, so the
// build is installable immediately. External testing would gate the first build
// behind a 24–48h review. Internal testers must already be App Store Connect
// users — an arbitrary email address cannot be added, which is why this reads
// the eligible list rather than taking one on faith.
//
// Adding a tester sends them a TestFlight invitation email.
import { asc, APP_ID } from "./lib/asc.mjs";

const DRY = process.argv.includes("--dry");
const GROUP_NAME = process.env.TF_GROUP || "Internal";
const attrs = (r) => r?.attributes ?? {};

// Latest non-expired build.
const builds = await asc("GET", `/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate&include=preReleaseVersion`);
const build = (builds.data ?? []).find((b) => !attrs(b).expired && attrs(b).processingState === "VALID");
if (!build) throw new Error("no VALID unexpired build to distribute");
const inc = new Map((builds.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
const ver = attrs(inc.get(`preReleaseVersions:${build.relationships?.preReleaseVersion?.data?.id}`)).version;
console.log(`build ${ver} (${attrs(build).version})  id=${build.id}`);

if (attrs(build).usesNonExemptEncryption == null) {
  throw new Error("export compliance unanswered — build would show 'Missing Compliance' and stay uninstallable");
}

// Internal testers must be ASC users; take the account holder.
const users = await asc("GET", "/users?limit=50");
const holder =
  (users.data ?? []).find((u) => attrs(u).roles?.includes("ACCOUNT_HOLDER")) ?? (users.data ?? [])[0];
if (!holder) throw new Error("no App Store Connect users found to invite");
const email = attrs(holder).username;
console.log(`tester ${email}  roles=${attrs(holder).roles?.join(",")}`);

if (DRY) {
  console.log(`\n--dry: would create internal group "${GROUP_NAME}", attach the build, invite ${email}.`);
  process.exit(0);
}

// Reuse the group if a previous run made it — this script must be re-runnable.
const existing = await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`);
let group = (existing.data ?? []).find((g) => attrs(g).name === GROUP_NAME);

if (group) {
  console.log(`group "${GROUP_NAME}" already exists — reusing (${group.id})`);
} else {
  // hasAccessToAllBuilds so every future upload appears without re-running this.
  const created = await asc("POST", "/betaGroups", {
    data: {
      type: "betaGroups",
      attributes: { name: GROUP_NAME, isInternalGroup: true, hasAccessToAllBuilds: true },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  group = created.data;
  console.log(`created internal group "${GROUP_NAME}" (${group.id}), hasAccessToAllBuilds=true`);
}

// With hasAccessToAllBuilds the build is implicit; attach explicitly otherwise.
if (!attrs(group).hasAccessToAllBuilds) {
  await asc("POST", `/betaGroups/${group.id}/relationships/builds`, {
    data: [{ type: "builds", id: build.id }],
  });
  console.log("attached build to group");
}

const inGroup = await asc("GET", `/betaGroups/${group.id}/betaTesters?limit=50`);
if ((inGroup.data ?? []).some((t) => attrs(t).email?.toLowerCase() === email.toLowerCase())) {
  console.log(`${email} is already a tester — no invitation re-sent`);
} else {
  await asc("POST", "/betaTesters", {
    data: {
      type: "betaTesters",
      attributes: { email, firstName: attrs(holder).firstName ?? "SwiftCard", lastName: attrs(holder).lastName ?? "Team" },
      relationships: { betaGroups: { data: [{ type: "betaGroups", id: group.id }] } },
    },
  });
  console.log(`invited ${email} — TestFlight invitation email sent`);
}

console.log("\nInstall TestFlight on the iPhone, sign in, and the build appears under SwiftCard.");
console.log("Verify with: node scripts/testflight-status.mjs");
