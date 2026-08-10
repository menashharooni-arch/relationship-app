#!/usr/bin/env node
// Generate the "client secret" Supabase needs for Sign in with Apple.
//
//   node scripts/apple-client-secret.mjs ~/Downloads/AuthKey_ABC1234XYZ.p8
//
// Apple does not issue a static secret. The secret IS a short-lived ES256 JWT
// that you sign yourself with the Sign in with Apple .p8 private key. Apple
// caps its lifetime at 6 months, so this is NOT a one-time setup script —
// Sign in with Apple breaks the day the JWT expires and you have to run this
// again and re-paste the result. Diary it.
//
// The Key ID is read from the filename Apple gives you (AuthKey_<KEYID>.p8);
// pass --key-id to override.
//
// Nothing is printed except the JWT, so it is safe to pipe. The .p8 itself is
// never echoed.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import crypto from "node:crypto";

const TEAM_ID = process.env.APPLE_TEAM_ID || "NHK8FA2RR2";
const SERVICES_ID = process.env.APPLE_SIGN_IN_CLIENT_ID || "me.swiftcard.web";
const AUDIENCE = "https://appleid.apple.com";
// Apple rejects anything longer; 6 months minus a day of slack.
const MAX_LIFETIME_SECONDS = 15777000 - 86400;

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// Pull --key-id (and its value) out before looking for the path, or
// `--key-id ABC ~/AuthKey_ABC.p8` treats "ABC" as the path and dies with a
// confusing read error — at exactly the moment you are rotating an expired
// secret and Apple sign-in is already down.
const argv = process.argv.slice(2);
const args = [];
let keyIdFlag = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--key-id") { keyIdFlag = argv[++i]; continue; }
  if (argv[i].startsWith("--key-id=")) { keyIdFlag = argv[i].slice("--key-id=".length); continue; }
  args.push(argv[i]);
}
const keyPath = args.find((a) => !a.startsWith("--"));
if (!keyPath) {
  fail("usage: node scripts/apple-client-secret.mjs <path to AuthKey_XXXX.p8> [--key-id KEYID]");
}

const keyId = keyIdFlag || (basename(keyPath).match(/AuthKey_([A-Z0-9]+)\.p8$/) || [])[1];
if (!keyId) {
  fail(`could not infer the Key ID from "${basename(keyPath)}" — pass --key-id <KEYID>`);
}

let privateKey;
try {
  privateKey = crypto.createPrivateKey(readFileSync(keyPath, "utf8"));
} catch (e) {
  fail(`could not read a private key from ${keyPath}: ${e.message}`);
}
if (privateKey.asymmetricKeyType !== "ec") {
  fail(`${keyPath} is a ${privateKey.asymmetricKeyType} key; Sign in with Apple keys are EC (P-256)`);
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const now = Math.floor(Date.now() / 1000);

const header = { alg: "ES256", kid: keyId, typ: "JWT" };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + MAX_LIFETIME_SECONDS,
  aud: AUDIENCE,
  sub: SERVICES_ID,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
// dsaEncoding matters: Node defaults to DER, but JWS requires the raw r||s
// pair. Skip this and Apple rejects the secret with an opaque invalid_client.
const signature = crypto.sign("sha256", Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: "ieee-p1363",
});

console.error(
  `# Sign in with Apple client secret\n` +
    `#   team ${TEAM_ID}  services id ${SERVICES_ID}  key ${keyId}\n` +
    `#   expires ${new Date((now + MAX_LIFETIME_SECONDS) * 1000).toISOString().slice(0, 10)} — regenerate before then\n`
);
console.log(`${signingInput}.${b64url(signature)}`);
