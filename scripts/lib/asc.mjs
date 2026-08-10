// Shared App Store Connect API client for the release scripts.
//
// Auth is the ASC key at ~/.swiftcard/asc (see scripts/ios-release.sh header).
// Tokens are minted per call and live 15 minutes — ASC rejects anything longer.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";

export const ASC_DIR = join(homedir(), ".swiftcard", "asc");
export const API = "https://api.appstoreconnect.apple.com/v1";
export const APP_ID = process.env.ASC_APP_ID || "6798875872";

function creds() {
  const kid = readFileSync(join(ASC_DIR, "key-id"), "utf8").trim();
  const iss = readFileSync(join(ASC_DIR, "issuer-id"), "utf8").trim();
  const keyPath = join(ASC_DIR, `AuthKey_${kid}.p8`);
  if (!existsSync(keyPath)) throw new Error(`missing ${keyPath}`);
  return { kid, iss, key: readFileSync(keyPath, "utf8") };
}

export function token() {
  const { kid, iss, key } = creds();
  const b64 = (b) => Buffer.from(b).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const sig = b64(crypto.sign("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }));
  return `${h}.${p}.${sig}`;
}

/** ASC request. Returns parsed JSON, or {} for 204s. Throws with Apple's own message. */
export async function asc(method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = json.errors?.[0];
    throw new Error(`${method} ${path} → ${res.status}: ${e?.title ?? ""} — ${e?.detail ?? text.slice(0, 400)}`);
  }
  return json;
}
