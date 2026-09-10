#!/usr/bin/env node
// Provision App Store signing assets through the App Store Connect API —
// distribution certificate + App Store profiles for all four targets: the app,
// the home-screen widget, the Apple Watch app and its complication.
//
//   node scripts/asc-provision.mjs
//
// WHY: `xcodebuild -exportArchive -allowProvisioningUpdates` wants to CLOUD-sign
// (Apple holds the private key), and that needs permissions our App Manager API
// key does not have ("Cloud signing permission error"). But the same key CAN
// create classic certificates and profiles through the public API — where WE
// hold the private key (~/.swiftcard/dist/dist-key.pem). So this script does
// what Xcode's magic would have, deterministically:
//   1. POST /v1/certificates (DISTRIBUTION) with our CSR    → Apple Distribution cert
//   2. GET  /v1/bundleIds  (creating any watch id that is missing, with the
//      App Groups capability)                                → four bundle ids
//   3. POST /v1/profiles (IOS_APP_STORE) for each bundle id  → App Store profiles
//      (App Store profiles need NO registered devices — that requirement is
//      development-profile-only, and is why the naive archive failed.)
//   4. Write everything to ~/.swiftcard/dist/ for ios-release.sh to consume.
//
// Idempotent: reuses an existing usable DISTRIBUTION cert if its serial file is
// present locally, and deletes+recreates profiles by name (profiles are cheap
// and regenerating them is the documented fix for capability changes).
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

const ASC = join(homedir(), ".swiftcard", "asc");
const DIST = join(homedir(), ".swiftcard", "dist");
const API = "https://api.appstoreconnect.apple.com/v1";

const APP_BUNDLE = "me.swiftcard.app";
const WIDGET_BUNDLE = "me.swiftcard.app.SwiftCardWidgetExtension";
// The Apple Watch app and its complication. watchOS bundle ids live in the same
// App ID list as iOS ones and take the SAME profile type — the App Store
// provisioning profile covers iOS, iPadOS, visionOS and watchOS. There is no
// WATCHOS_APP_STORE to look for.
const WATCH_BUNDLE = "me.swiftcard.app.watchkitapp";
const WATCH_COMPLICATION_BUNDLE = "me.swiftcard.app.watchkitapp.complication";

// Every bundle id that ends up inside the uploaded .ipa. Miss one and the
// export fails at the last step with "no profile for <id>", after the archive.
const BUNDLES = [APP_BUNDLE, WIDGET_BUNDLE, WATCH_BUNDLE, WATCH_COMPLICATION_BUNDLE];

const PROFILE_NAMES = {
  [APP_BUNDLE]: "SwiftCard App Store",
  [WIDGET_BUNDLE]: "SwiftCard Widget App Store",
  [WATCH_BUNDLE]: "SwiftCard Watch App Store",
  [WATCH_COMPLICATION_BUNDLE]: "SwiftCard Watch Complication App Store",
};

// Names as they appear in the developer portal's App ID list, used only when a
// bundle id has to be created.
const BUNDLE_NAMES = {
  [WATCH_BUNDLE]: "SwiftCard Watch App",
  [WATCH_COMPLICATION_BUNDLE]: "SwiftCard Watch Complication",
};

// All four share the App Group so the widget and the complication can read the
// active card. A profile minted without this capability signs fine and then
// fails at runtime with an unreadable shared container — the exact failure
// WidgetBridge.swift documents.
const APP_GROUP = "group.me.swiftcard.app";

function token() {
  const key = readFileSync(join(ASC, "AuthKey_" + readFileSync(join(ASC, "key-id"), "utf8").trim() + ".p8"), "utf8");
  const kid = readFileSync(join(ASC, "key-id"), "utf8").trim();
  const iss = readFileSync(join(ASC, "issuer-id"), "utf8").trim();
  const b64 = (b) => Buffer.from(b).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const sig = b64(crypto.sign("sha256", Buffer.from(h + "." + p), { key, dsaEncoding: "ieee-p1363" }));
  return `${h}.${p}.${sig}`;
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = json.errors?.[0];
    throw new Error(`${method} ${path} → ${res.status}: ${err?.title ?? ""} ${err?.detail ?? text.slice(0, 300)}`);
  }
  return json;
}

// ── 1. Apple Distribution certificate ────────────────────────────────────────
let certId, certContent;
try {
  const saved = JSON.parse(readFileSync(join(DIST, "cert.json"), "utf8"));
  // confirm it still exists server-side
  const check = await api("GET", `/certificates/${saved.id}`);
  certId = saved.id;
  certContent = check.data.attributes.certificateContent;
  console.log(`cert: reusing ${certId} (${check.data.attributes.serialNumber})`);
} catch {
  const csr = readFileSync(join(DIST, "dist.csr"), "utf8");
  const created = await api("POST", "/certificates", {
    data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } },
  });
  certId = created.data.id;
  certContent = created.data.attributes.certificateContent;
  writeFileSync(join(DIST, "cert.json"), JSON.stringify({ id: certId }));
  console.log(`cert: created ${certId} (${created.data.attributes.serialNumber}, expires ${created.data.attributes.expirationDate?.slice(0, 10)})`);
}
writeFileSync(join(DIST, "dist-cert.cer"), Buffer.from(certContent, "base64"));

// ── 2. bundle ids ────────────────────────────────────────────────────────────
const bundles = await api(
  "GET",
  "/bundleIds?filter[identifier]=" + BUNDLES.map(encodeURIComponent).join(",") + "&limit=200"
);
const byIdentifier = Object.fromEntries(bundles.data.map((b) => [b.attributes.identifier, b.id]));

for (const b of BUNDLES) {
  if (byIdentifier[b]) {
    console.log(`bundleId: ${b} → ${byIdentifier[b]}`);
    continue;
  }

  // The two shipping ids predate this script and are never created here — if
  // one of them is missing something is wrong with the account, not with the
  // build, and creating a replacement would be the wrong repair.
  if (b === APP_BUNDLE || b === WIDGET_BUNDLE) {
    throw new Error(`bundle id ${b} is not registered in the developer portal`);
  }

  // platform IOS is correct for a watchOS bundle id: watch apps are part of
  // the iOS app's platform family in the portal, not a platform of their own.
  const made = await api("POST", "/bundleIds", {
    data: {
      type: "bundleIds",
      attributes: { identifier: b, name: BUNDLE_NAMES[b] ?? b, platform: "IOS" },
    },
  });
  byIdentifier[b] = made.data.id;
  console.log(`bundleId: created ${b} → ${made.data.id}`);

  await api("POST", "/bundleIdCapabilities", {
    data: {
      type: "bundleIdCapabilities",
      attributes: {
        capabilityType: "APP_GROUPS",
        settings: [{ key: "APP_GROUPS", options: [{ key: APP_GROUP }] }],
      },
      relationships: { bundleId: { data: { type: "bundleIds", id: made.data.id } } },
    },
  });
  console.log(`bundleId: enabled App Groups on ${b}`);
}

// ── 3. App Store profiles (delete-and-recreate by name: capability changes
//        invalidate profiles, and recreating is the documented remedy) ────────
const existing = await api("GET", "/profiles?filter[profileType]=IOS_APP_STORE&limit=200");
for (const bundle of BUNDLES) {
  const name = PROFILE_NAMES[bundle];
  const old = existing.data.find((p) => p.attributes.name === name);
  if (old) {
    await api("DELETE", `/profiles/${old.id}`);
    console.log(`profile: deleted stale "${name}"`);
  }
  const created = await api("POST", "/profiles", {
    data: {
      type: "profiles",
      attributes: { name, profileType: "IOS_APP_STORE" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: byIdentifier[bundle] } },
        certificates: { data: [{ type: "certificates", id: certId }] },
      },
    },
  });
  const file = join(DIST, name.replace(/ /g, "-") + ".mobileprovision");
  writeFileSync(file, Buffer.from(created.data.attributes.profileContent, "base64"));
  console.log(`profile: created "${name}" (${created.data.attributes.uuid}) → ${file}`);
}

console.log("\nDone. ios-release.sh installs these and signs with them.");
