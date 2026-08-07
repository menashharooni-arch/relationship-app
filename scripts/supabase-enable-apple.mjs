#!/usr/bin/env node
// Turn on Sign in with Apple for the SwiftCard Supabase project, and make sure
// the native shell's custom-scheme redirect is allow-listed.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... \
//     node scripts/supabase-enable-apple.mjs ~/Downloads/AuthKey_ABC1234XYZ.p8
//
// Get the token from https://supabase.com/dashboard/account/tokens (or run
// `supabase login`, which writes ~/.supabase/access-token). It is read from the
// environment only — never pass it as an argument, where it would land in your
// shell history.
//
// Closes both Supabase items in app-store/RELEASE_CHECKLIST.md §B:
//   1. Auth → Providers → Apple, with the Services ID + a freshly signed secret.
//   2. Auth → URL Configuration → Redirect URLs gains swiftcard://auth-callback,
//      which is the return leg of the native OAuth flow (src/lib/native-auth.ts).
//      Without it the provider round-trip dies at the redirect.
//
// Re-runnable: it reads the current allow-list and only adds what is missing,
// so running it again to refresh the 6-month secret is safe.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "grxmovpmlgmjncnyiyrt";
const SERVICES_ID = process.env.APPLE_SIGN_IN_CLIENT_ID || "me.swiftcard.web";
const NATIVE_REDIRECT = "swiftcard://auth-callback";
const API = "https://api.supabase.com/v1";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// Token sources, in order. The dropped-file path exists because `supabase
// login` is an interactive TUI that cannot be driven headlessly, and because
// the CLI may stash its token in the macOS Keychain rather than on disk — so
// "just run supabase login" is not something a script can rely on finding.
function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const candidates = [
    join(homedir(), ".swiftcard", "supabase-token"),
    join(homedir(), ".supabase", "access-token"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const t = readFileSync(p, "utf8").trim();
      if (t) return t;
    }
  }
  fail(
    "no Supabase token. Either:\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-enable-apple.mjs <key.p8>\n" +
      "or drop it in a file this reads:\n" +
      "  mkdir -p ~/.swiftcard && chmod 700 ~/.swiftcard\n" +
      "  echo 'sbp_...' > ~/.swiftcard/supabase-token && chmod 600 ~/.swiftcard/supabase-token\n" +
      "Create one at https://supabase.com/dashboard/account/tokens"
  );
}

const keyPath = process.argv[2];
if (!keyPath) fail("usage: node scripts/supabase-enable-apple.mjs <path to AuthKey_XXXX.p8>");

// Reuse the signer so there is exactly one implementation of the JWT rules.
const secret = execFileSync(
  process.execPath,
  [join(import.meta.dirname, "apple-client-secret.mjs"), keyPath],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
).trim();

const token = accessToken();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const current = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, { headers });
if (!current.ok) {
  fail(`could not read auth config (${current.status}): ${(await current.text()).slice(0, 300)}`);
}
const config = await current.json();

const allowList = String(config.uri_allow_list || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const needsRedirect = !allowList.includes(NATIVE_REDIRECT);
if (needsRedirect) allowList.push(NATIVE_REDIRECT);

const body = {
  external_apple_enabled: true,
  external_apple_client_id: SERVICES_ID,
  external_apple_secret: secret,
  uri_allow_list: allowList.join(","),
};

const res = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers,
  body: JSON.stringify(body),
});
if (!res.ok) {
  fail(`PATCH failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
}

console.log(`Apple provider enabled  (client id ${SERVICES_ID})`);
console.log(
  needsRedirect
    ? `Redirect URL added      ${NATIVE_REDIRECT}`
    : `Redirect URL already present  ${NATIVE_REDIRECT}`
);

// Prove it from the outside rather than trusting the 200: a misconfigured
// provider still accepts the PATCH and only fails at /authorize.
const probe = await fetch(
  `https://${PROJECT_REF}.supabase.co/auth/v1/authorize?provider=apple&redirect_to=${encodeURIComponent(NATIVE_REDIRECT)}`,
  { redirect: "manual" }
);
const location = probe.headers.get("location") || "";
if (probe.status === 302 && location.startsWith("https://appleid.apple.com")) {
  console.log(`Verified                /authorize?provider=apple → appleid.apple.com`);
} else {
  console.error(
    `\nWARNING: provider is enabled but /authorize returned ${probe.status}` +
      `${location ? ` → ${location}` : ""}\n${(await probe.text()).slice(0, 300)}`
  );
  process.exit(1);
}
