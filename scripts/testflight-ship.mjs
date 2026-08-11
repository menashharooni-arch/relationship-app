#!/usr/bin/env node
// Take a freshly uploaded build all the way to "a tester can install it".
//
//   node scripts/testflight-ship.mjs 5
//   node scripts/testflight-ship.mjs 5 --no-external   # internal only
//
// Uploading is not shipping. Between `altool --upload-app` succeeding and an
// app appearing on a phone there are four separate gates, none of which report
// themselves as an error — the build just sits in App Store Connect looking
// finished:
//
//   1. PROCESSING → VALID. Apple re-signs and scans the binary; a build in
//      PROCESSING cannot be added to a group or reviewed. Takes 5–20 minutes.
//   2. Export compliance. Unanswered, the build reads "Missing Compliance" and
//      installs for nobody. SwiftCard uses only HTTPS, hence exempt.
//   3. "What to Test". Beta App Review rejects an external submission with no
//      betaBuildLocalization, and the failure surfaces as a rejection days
//      later rather than as a 400 here.
//   4. Group membership. Internal groups created with hasAccessToAllBuilds
//      pick a build up automatically; external groups do NOT — the build has
//      to be attached, and then submitted for Beta App Review before the
//      public link will serve it.
//
// So this does all four in order and prints what each one actually returned.
import { asc, APP_ID } from "./lib/asc.mjs";

const attrs = (r) => r?.attributes ?? {};
const wanted = process.argv.slice(2).find((a) => !a.startsWith("--"));
const NO_EXTERNAL = process.argv.includes("--no-external");
const WHATS_NEW =
  process.env.TF_WHATS_NEW ||
  "Full app on iPhone: card picker, dashboard, contacts, links and settings. " +
    "This build fixes long names and long links overflowing the contact screen " +
    "sideways, and the input zoom that could strand you off-screen.";

if (!wanted) {
  console.error("usage: node scripts/testflight-ship.mjs <buildNumber> [--no-external]");
  process.exit(1);
}

// ── 1. find it, and wait out PROCESSING ──────────────────────────────────────
const findBuild = async () => {
  const r = await asc(
    "GET",
    `/builds?filter[app]=${APP_ID}&limit=20&sort=-uploadedDate&include=buildBetaDetail`,
  );
  return (r.data ?? []).find((b) => attrs(b).version === String(wanted));
};

// Apple's own ingest can take 20+ minutes; poll rather than fail fast, but do
// not poll forever — a build stuck in PROCESSING past this is a real problem.
const DEADLINE = Date.now() + 40 * 60 * 1000;

// An accepted upload does not mean a visible build: /builds returns nothing at
// all for several minutes after "UPLOAD SUCCEEDED", so "not found" this soon is
// still ingest, not a failure. Wait it out on the same deadline.
let build = await findBuild();
while (!build && Date.now() < DEADLINE) {
  console.log(`build ${wanted}: not visible in App Store Connect yet (ingest) …`);
  await new Promise((r) => setTimeout(r, 60_000));
  build = await findBuild();
}
if (!build) throw new Error(`build ${wanted} never appeared in App Store Connect`);

while (attrs(build).processingState === "PROCESSING" && Date.now() < DEADLINE) {
  console.log(`build ${wanted}: PROCESSING …`);
  await new Promise((r) => setTimeout(r, 60_000));
  build = (await findBuild()) ?? build;
}
const state = attrs(build).processingState;
console.log(`build ${wanted} (${build.id}): processingState=${state}`);
if (state !== "VALID") throw new Error(`build ${wanted} is ${state}, not VALID — cannot ship it`);

// ── 2. export compliance ─────────────────────────────────────────────────────
if (attrs(build).usesNonExemptEncryption === null || attrs(build).usesNonExemptEncryption === undefined) {
  await asc("PATCH", `/builds/${build.id}`, {
    data: { type: "builds", id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
  console.log("export compliance: set usesNonExemptEncryption=false");
} else {
  console.log(`export compliance: already ${attrs(build).usesNonExemptEncryption}`);
}

// ── 3. "What to Test" ────────────────────────────────────────────────────────
const locs = await asc("GET", `/builds/${build.id}/betaBuildLocalizations`);
const existing = (locs.data ?? []).find((l) => attrs(l).locale === "en-US");
if (existing) {
  await asc("PATCH", `/betaBuildLocalizations/${existing.id}`, {
    data: { type: "betaBuildLocalizations", id: existing.id, attributes: { whatsNew: WHATS_NEW } },
  });
  console.log("what to test: updated");
} else {
  await asc("POST", "/betaBuildLocalizations", {
    data: {
      type: "betaBuildLocalizations",
      attributes: { locale: "en-US", whatsNew: WHATS_NEW },
      relationships: { build: { data: { type: "builds", id: build.id } } },
    },
  });
  console.log("what to test: created");
}

// ── 4. groups ────────────────────────────────────────────────────────────────
const groups = (await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`)).data ?? [];
const internal = groups.filter((g) => attrs(g).isInternalGroup);
const external = groups.filter((g) => !attrs(g).isInternalGroup);

for (const g of internal) {
  if (attrs(g).hasAccessToAllBuilds) {
    console.log(`internal "${attrs(g).name}": all-builds — reaches this build with no action`);
    continue;
  }
  await asc("POST", `/betaGroups/${g.id}/relationships/builds`, {
    data: [{ type: "builds", id: build.id }],
  }).catch((e) => console.log(`internal "${attrs(g).name}": ${e.message}`));
  console.log(`internal "${attrs(g).name}": build added`);
}

if (!NO_EXTERNAL) {
  for (const g of external) {
    await asc("POST", `/betaGroups/${g.id}/relationships/builds`, {
      data: [{ type: "builds", id: build.id }],
    }).catch((e) => console.log(`external "${attrs(g).name}": add build → ${e.message}`));
    console.log(`external "${attrs(g).name}": build added  publicLink=${attrs(g).publicLink ?? "—"}`);
  }

  // Beta App Review. Attaching the build to an external group often creates the
  // submission implicitly, so a 409 here means "already submitted", not failure.
  await asc("POST", "/betaAppReviewSubmissions", {
    data: {
      type: "betaAppReviewSubmissions",
      relationships: { build: { data: { type: "builds", id: build.id } } },
    },
  })
    .then(() => console.log("beta app review: submitted"))
    .catch((e) => console.log(`beta app review: ${e.message}`));
}

// ── report ───────────────────────────────────────────────────────────────────
const fresh = await asc("GET", `/builds/${build.id}?include=buildBetaDetail`);
const detail = attrs((fresh.included ?? [])[0]);
console.log(
  `\nfinal: internal=${detail.internalBuildState ?? "—"}  external=${detail.externalBuildState ?? "—"}`,
);
for (const g of external) {
  const link = attrs(g).publicLink;
  if (link) console.log(`public link: ${link}   (code ${attrs(g).publicLinkId})`);
}
