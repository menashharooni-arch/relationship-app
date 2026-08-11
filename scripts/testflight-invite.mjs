#!/usr/bin/env node
// Get a specific person onto internal TestFlight.
//
//   node scripts/testflight-invite.mjs you@example.com --dry
//   node scripts/testflight-invite.mjs you@example.com
//
// testflight-setup.mjs only ever invites the account holder, so a second person
// (anyone but hello@swiftcard.me) has no path in. This is that path.
//
// It takes TWO runs, and that is Apple's constraint, not a bug here: an internal
// tester must already be an App Store Connect USER, so run one sends the account
// invitation and stops. Nothing can add the tester until the invitation is
// accepted — betaTesters rejects an email that belongs to no user. Re-run after
// accepting and it attaches them to the internal group.
//
// The email must be usable as an Apple ID, and it must be the Apple ID signed
// into the iPhone's App Store — TestFlight reads Media & Purchases, not the
// iCloud account. A build that "never appears" is almost always those two
// differing.
//
// Role is DEVELOPER scoped to this one app: the minimum Apple accepts for an
// internal tester (CUSTOMER_SUPPORT and FINANCE cannot test).
import { asc, APP_ID } from "./lib/asc.mjs";

const DRY = process.argv.includes("--dry");
const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
const GROUP_NAME = process.env.TF_GROUP || "Internal";
const attrs = (r) => r?.attributes ?? {};
const eq = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

if (!email || !email.includes("@")) {
  console.error("usage: node scripts/testflight-invite.mjs <email> [--dry]");
  process.exit(1);
}
const [first, ...rest] = (email.split("@")[0] || "tester").split(/[._-]/);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

// Is there a VALID build for them to actually install? Being in the group is
// pointless otherwise, and this is the state that shows no error in ASC.
const builds = await asc("GET", `/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`);
const build = (builds.data ?? []).find((b) => !attrs(b).expired && attrs(b).processingState === "VALID");
if (!build) throw new Error("no VALID unexpired build — nothing would be installable");
console.log(`latest installable build: ${attrs(build).version}  (${build.id})`);

const users = await asc("GET", "/users?limit=100");
const user = (users.data ?? []).find((u) => eq(attrs(u).username, email));

if (!user) {
  const pending = await asc("GET", "/userInvitations?limit=100");
  const already = (pending.data ?? []).find((i) => eq(attrs(i).email, email));
  if (already) {
    console.log(`\n${email} was already invited to App Store Connect and has NOT accepted yet.`);
    console.log(`invitation expires ${attrs(already).expirationDate}`);
    console.log("Accept it from the inbox, then re-run this to finish adding the tester.");
    process.exit(0);
  }
  if (DRY) {
    console.log(`\n--dry: would invite ${email} to App Store Connect as DEVELOPER on this app only.`);
    process.exit(0);
  }
  await asc("POST", "/userInvitations", {
    data: {
      type: "userInvitations",
      attributes: {
        email,
        firstName: cap(first),
        lastName: cap(rest.join(" ")) || "SwiftCard",
        roles: ["DEVELOPER"],
        allAppsVisible: false,
        provisioningAllowed: false,
      },
      relationships: { visibleApps: { data: [{ type: "apps", id: APP_ID }] } },
    },
  });
  console.log(`\ninvited ${email} to App Store Connect (DEVELOPER, this app only)`);
  console.log("NEXT: accept the email from Apple, then re-run this command to add the tester.");
  process.exit(0);
}

console.log(`${email} is an App Store Connect user  roles=${attrs(user).roles?.join(",")}`);

const groups = await asc("GET", `/apps/${APP_ID}/betaGroups?limit=50`);
const group = (groups.data ?? []).find((g) => attrs(g).name === GROUP_NAME && attrs(g).isInternalGroup);
if (!group) throw new Error(`no internal group "${GROUP_NAME}" — run scripts/testflight-setup.mjs first`);

const inGroup = await asc("GET", `/betaGroups/${group.id}/betaTesters?limit=200`);
if ((inGroup.data ?? []).some((t) => eq(attrs(t).email, email))) {
  console.log(`already a tester in "${GROUP_NAME}" — no invitation re-sent`);
  process.exit(0);
}
if (DRY) {
  console.log(`\n--dry: would add ${email} to internal group "${GROUP_NAME}".`);
  process.exit(0);
}

await asc("POST", "/betaTesters", {
  data: {
    type: "betaTesters",
    attributes: { email, firstName: attrs(user).firstName ?? cap(first), lastName: attrs(user).lastName ?? "SwiftCard" },
    relationships: { betaGroups: { data: [{ type: "betaGroups", id: group.id }] } },
  },
});
console.log(`added ${email} to "${GROUP_NAME}" — TestFlight invitation email sent`);
console.log("\nInstall TestFlight on the iPhone, sign in with THAT Apple ID, and SwiftCard appears.");
console.log("Verify with: node scripts/testflight-status.mjs");
