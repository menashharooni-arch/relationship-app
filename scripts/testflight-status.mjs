#!/usr/bin/env node
// Can this build actually be installed on a phone right now?
//
//   node scripts/testflight-status.mjs
//
// Read-only. A build being "VALID" in App Store Connect does NOT mean it is
// installable — two things silently block TestFlight and neither surfaces as an
// error anywhere obvious:
//
//   1. Export compliance. Until the encryption question is answered the build
//      reads "Missing Compliance" and no tester can install it. It sits there
//      looking finished.
//   2. No tester assignment. A build reaches internal testers only once it is
//      added to an internal beta group whose members are App Store Connect
//      users — internal testers cannot be arbitrary email addresses.
//
// So this prints build state, compliance, groups, and testers together, which
// is the combination that answers "why is nothing showing up on my phone".
import { asc, APP_ID } from "./lib/asc.mjs";

const j = (o) => JSON.stringify(o);
const attrs = (r) => r?.attributes ?? {};

const app = await asc("GET", `/apps/${APP_ID}`);
console.log(`APP      ${attrs(app.data).name} (${attrs(app.data).bundleId})`);

// ---- builds -------------------------------------------------------------
const builds = await asc(
  "GET",
  `/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate` +
    `&include=buildBetaDetail,preReleaseVersion,appStoreVersion`,
);
if (!builds.data?.length) {
  console.log("\nNo builds uploaded.");
  process.exit(0);
}

const inc = new Map((builds.included ?? []).map((r) => [`${r.type}:${r.id}`, r]));
const rel = (b, name) => {
  const d = b.relationships?.[name]?.data;
  return d ? inc.get(`${d.type}:${d.id}`) : null;
};

for (const b of builds.data) {
  const a = attrs(b);
  const detail = attrs(rel(b, "buildBetaDetail"));
  const pre = attrs(rel(b, "preReleaseVersion"));
  console.log(`\nBUILD    ${pre.version ?? "?"} (${a.version})   id=${b.id}`);
  console.log(`         processingState=${a.processingState}  expired=${a.expired}`);
  console.log(`         uploaded=${a.uploadedDate}  expires=${a.expirationDate ?? "—"}`);
  console.log(`         internalBuildState=${detail.internalBuildState ?? "—"}`);
  console.log(`         externalBuildState=${detail.externalBuildState ?? "—"}`);

  // Export compliance is the #1 "VALID but uninstallable" trap.
  const missing = a.usesNonExemptEncryption === null || a.usesNonExemptEncryption === undefined;
  console.log(
    `         usesNonExemptEncryption=${a.usesNonExemptEncryption ?? "NOT ANSWERED"}` +
      (missing ? "   ⚠️  BLOCKS INSTALL — this is 'Missing Compliance'" : ""),
  );

  // Which groups is this build actually shipped to? A group created with
  // hasAccessToAllBuilds reaches every build WITHOUT an explicit link, so this
  // relationship comes back empty for it — reporting that as "no tester can see
  // it" is wrong, and was wrong here the first time. Count those groups too.
  const gs = await asc("GET", `/builds/${b.id}/betaGroups`).catch(() => ({ data: [] }));
  const allBuildGroups = (await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`).catch(() => ({ data: [] })))
    .data?.filter((g) => attrs(g).hasAccessToAllBuilds) ?? [];
  const reaching = [
    ...(gs.data ?? []).map((g) => attrs(g).name),
    ...allBuildGroups.map((g) => `${attrs(g).name} (all-builds)`),
  ];
  console.log(`         betaGroups=${reaching.length ? reaching.join(", ") : "NONE — no tester can see it"}`);
}

// ---- groups + testers ---------------------------------------------------
const groups = await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`);
console.log(`\nBETA GROUPS (${groups.data?.length ?? 0})`);
for (const g of groups.data ?? []) {
  const a = attrs(g);
  const testers = await asc("GET", `/betaGroups/${g.id}/betaTesters?limit=50`).catch(() => ({ data: [] }));
  console.log(`  ${a.name}  internal=${a.isInternalGroup}  publicLink=${a.publicLinkEnabled ?? false}  id=${g.id}`);
  for (const t of testers.data ?? []) {
    const ta = attrs(t);
    console.log(`      ${ta.email}  ${ta.firstName ?? ""} ${ta.lastName ?? ""}  state=${ta.state ?? "—"}`);
  }
  if (!testers.data?.length) console.log("      (no testers)");
}

// ---- who can even BE an internal tester ---------------------------------
const users = await asc("GET", "/users?limit=50").catch((e) => ({ data: [], err: e.message }));
console.log(`\nAPP STORE CONNECT USERS (eligible to be internal testers)`);
for (const u of users.data ?? []) {
  const a = attrs(u);
  console.log(`  ${a.username}  roles=${j(a.roles)}  allAppsVisible=${a.allAppsVisible}`);
}
if (users.err) console.log(`  (could not list users: ${users.err})`);
