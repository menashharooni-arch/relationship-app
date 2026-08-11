#!/usr/bin/env node
// Watch the two things that stand between "build uploaded" and "app on a phone",
// and finish the one that can be finished automatically.
//
//   node scripts/testflight-watch.mjs 5
//
// Both gates are other people's queues, so they resolve minutes-to-days after
// the upload and nothing tells you when:
//
//   1. The internal path needs the tester to accept an App Store Connect user
//      invitation — an email click this script cannot make. But the moment they
//      accept, adding them to the internal group is mechanical, so do it here
//      rather than make someone notice and run a command.
//   2. The external path needs Beta App Review. A build cannot even be
//      submitted while another build in the same train is in review (422), so
//      the submission has to be retried after the earlier one clears.
//
// Prints one line per state change and exits when there is nothing left to
// wait for. Designed to run under Monitor: every line is an event worth seeing.
import { asc, APP_ID } from "./lib/asc.mjs";

const attrs = (r) => r?.attributes ?? {};
const eq = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const say = (s) => console.log(s);

const buildNumber = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "5";
const TESTER = process.env.TF_TESTER || "menashharooni@gmail.com";
const EVERY = Number(process.env.TF_POLL_SECONDS || 120) * 1000;

let testerDone = false;
let reviewDone = false;
let lastReview = "";

async function checkTester() {
  const groups = (await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`)).data ?? [];
  const internal = groups.find((g) => attrs(g).isInternalGroup);
  if (!internal) return;

  const members = (await asc("GET", `/betaGroups/${internal.id}/betaTesters?limit=50`)).data ?? [];
  if (members.some((t) => eq(attrs(t).email, TESTER))) {
    say(`✅ ${TESTER} is already an internal tester — build ${buildNumber} is installable now.`);
    testerDone = true;
    return;
  }

  // An internal tester must be an App Store Connect USER first; betaTesters
  // rejects an address that belongs to no user, so the invitation gates this.
  const users = (await asc("GET", "/users?limit=100")).data ?? [];
  const user = users.find((u) => eq(attrs(u).username, TESTER));
  if (!user) return; // still unaccepted — silent, this is the normal state

  await asc("POST", `/betaGroups/${internal.id}/relationships/betaTesters`, {
    data: [{ type: "betaTesters", id: await testerId(user) }],
  });
  say(`✅ ${TESTER} accepted the invitation and is now an internal tester — build ${buildNumber} should appear in TestFlight within a minute.`);
  testerDone = true;
}

/** betaTesters and users are separate resources keyed by the same email. */
async function testerId(user) {
  const existing = (await asc("GET", `/betaTesters?filter[email]=${encodeURIComponent(TESTER)}&limit=10`)).data ?? [];
  if (existing.length) return existing[0].id;
  const made = await asc("POST", "/betaTesters", {
    data: {
      type: "betaTesters",
      attributes: {
        email: TESTER,
        firstName: attrs(user).firstName || "Menash",
        lastName: attrs(user).lastName || "Harooni",
      },
    },
  });
  return made.data.id;
}

async function checkReview() {
  const builds = (
    await asc("GET", `/builds?filter[app]=${APP_ID}&limit=20&sort=-uploadedDate&include=buildBetaDetail`)
  ).data ?? [];
  const mine = builds.find((b) => attrs(b).version === String(buildNumber));
  if (!mine) return;

  const inc = await asc("GET", `/builds/${mine.id}?include=buildBetaDetail`);
  const ext = attrs((inc.included ?? [])[0]).externalBuildState ?? "?";
  if (ext !== lastReview) {
    say(`build ${buildNumber} external state: ${lastReview || "—"} → ${ext}`);
    lastReview = ext;
  }
  if (ext === "READY_FOR_BETA_TESTING" || ext === "IN_BETA_TESTING") {
    const groups = (await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`)).data ?? [];
    const link = groups.map((g) => attrs(g).publicLink).find(Boolean);
    say(`✅ Beta App Review passed. Public link is live: ${link}`);
    reviewDone = true;
    return;
  }

  // Retry the submission that 422'd behind the earlier build in the train.
  if (ext === "READY_FOR_BETA_SUBMISSION") {
    await asc("POST", "/betaAppReviewSubmissions", {
      data: {
        type: "betaAppReviewSubmissions",
        relationships: { build: { data: { type: "builds", id: mine.id } } },
      },
    })
      .then(() => say(`submitted build ${buildNumber} for Beta App Review`))
      .catch((e) => {
        // "Another build is in review" is the expected wait, not a problem.
        if (!/Another build is in review/i.test(e.message)) say(`beta review submit: ${e.message}`);
      });
  }
}

for (;;) {
  if (!testerDone) await checkTester().catch((e) => say(`tester check failed: ${e.message}`));
  if (!reviewDone) await checkReview().catch((e) => say(`review check failed: ${e.message}`));
  if (testerDone && reviewDone) {
    say("both paths open — nothing left to watch.");
    break;
  }
  await new Promise((r) => setTimeout(r, EVERY));
}
