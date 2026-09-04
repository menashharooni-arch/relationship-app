import crypto from "node:crypto";
import http2 from "node:http2";
import { normalizeApplePrivateKey } from "@/lib/apple-key";

// ── APNs sender for the native iOS app ───────────────────────────────────────
//
// Web push (VAPID) can't reach the Capacitor shell — WKWebView has no
// PushManager. Native devices register through @capacitor/push-notifications
// and store their APNs device token in the same push_subscriptions table as
// web subscriptions, namespaced as endpoint = "apns:<deviceToken>".
// lib/push.ts routes those rows here; web rows keep going through web-push.
//
// Completely safe to ship unconfigured: without the APPLE_PUSH_* env vars every
// call is a silent no-op ("not_configured").
//
// Env vars (owner action, documented in SHELL-RUNBOOK — created in the Apple
// Developer portal as an "Apple Push Notifications service (APNs)" key):
//   APPLE_TEAM_ID           – 10-char Team ID (shared with Wallet / Sign in)
//   APPLE_PUSH_KEY_ID       – Key ID of the APNs auth key (.p8)
//   APPLE_PUSH_PRIVATE_KEY  – the .p8 private key (PEM text)
//   APPLE_PUSH_TOPIC        – optional; defaults to the app bundle id
//   APPLE_PUSH_SANDBOX      – "1" for Xcode dev builds (sandbox APNs);
//                             unset/0 for TestFlight + App Store (production)

const APNS_TOPIC_DEFAULT = "me.swiftcard.app";

export const APNS_PREFIX = "apns:";

export function isApnsEndpoint(endpoint: string | null | undefined): boolean {
  return typeof endpoint === "string" && endpoint.startsWith(APNS_PREFIX);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Module-scope JWT cache. Apple accepts a provider token for up to an hour but
// REJECTS tokens minted more often than roughly once per 20 minutes for the
// same key (TooManyProviderTokenUpdates, 403).
//
// The header above claimed a "per send batch" build; there was no batching —
// buildApnsJwt was called inside the per-MESSAGE send function, so every single
// notification minted a fresh token. That is fine at one push an hour and
// starts silently 403ing the moment volume rises.
//
// Refreshed at 50 minutes: comfortably inside Apple's 1h expiry, comfortably
// outside their ~20m mint floor.
const JWT_TTL_MS = 50 * 60 * 1000;
let cachedJwt: { token: string; mintedAt: number; key: string } | null = null;

function getApnsJwt(teamId: string, keyId: string, privateKey: string): string {
  // Keyed on the credentials too, so rotating them can't serve a stale token.
  const key = `${teamId}:${keyId}`;
  if (cachedJwt && cachedJwt.key === key && Date.now() - cachedJwt.mintedAt < JWT_TTL_MS) {
    return cachedJwt.token;
  }
  const token = buildApnsJwt(teamId, keyId, privateKey);
  cachedJwt = { token, mintedAt: Date.now(), key };
  return token;
}

// Provider-token JWT (ES256). Minted through getApnsJwt above — never call this
// directly from a send path, or you reintroduce the per-message minting.
function buildApnsJwt(teamId: string, keyId: string, privateKey: string): string {
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: normalizeApplePrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

export type ApnsSendResult = "sent" | "not_configured" | "gone" | "error";

/**
 * One HTTP/2 POST to APNs. The transport only — topic, headers and body are
 * the caller's business.
 *
 * Shared because there are two completely different kinds of push here: an
 * ALERT to the iOS app (topic = bundle id, visible payload) and a silent
 * WALLET push (topic = pass type id, empty payload) that tells iOS to
 * re-download a pass. They differ in every field and in nothing else, and the
 * connection handling — timeouts, reading the reason out of the body,
 * distinguishing a dead token from a misconfiguration — is the part that must
 * not be written twice.
 */
async function apnsPost(
  deviceToken: string,
  headers: Record<string, string>,
  body: string,
): Promise<ApnsSendResult> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_PUSH_KEY_ID;
  const privateKey = process.env.APPLE_PUSH_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) return "not_configured";
  if (!deviceToken) return "error";

  const host = process.env.APPLE_PUSH_SANDBOX === "1"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";

  let jwt: string;
  try {
    jwt = getApnsJwt(teamId, keyId, privateKey);
  } catch {
    return "error"; // malformed key — treat as unconfigured rather than throw
  }

  return new Promise<ApnsSendResult>((resolve) => {
    let settled = false;
    const done = (r: ApnsSendResult) => { if (!settled) { settled = true; resolve(r); } };

    const client = http2.connect(host);
    client.on("error", () => { done("error"); try { client.close(); } catch { /* ignore */ } });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwt}`,
      "content-type": "application/json",
      ...headers,
    });

    // Never hang a request path on APNs — pushes are best-effort.
    req.setTimeout(10_000, () => { done("error"); try { req.close(); client.close(); } catch { /* ignore */ } });

    let status = 0;
    // APNs puts the actual cause in the RESPONSE BODY as { "reason": "..." },
    // and we never read it — so every 400 was treated as "this device token is
    // dead" and the caller permanently DELETED the push subscription. A 400 is
    // mostly config: BadTopic (wrong apns-topic), DeviceTokenNotForTopic (the
    // classic sandbox/production mismatch), BadExpirationDate, and so on. Any
    // one of those would unregister every device in the database on its first
    // run, with no signal.
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { if (raw.length < 2048) raw += chunk; });

    req.on("response", (h) => { status = Number(h[":status"] ?? 0); });
    req.on("close", () => {
      try { client.close(); } catch { /* ignore */ }
      if (status === 200) return done("sent");

      let reason = "";
      try { reason = String((JSON.parse(raw) as { reason?: string }).reason ?? ""); } catch { /* body may be empty */ }

      // ONLY these two mean the token itself is finished. 410 is always
      // Unregistered; a 400 has to say so explicitly.
      if (reason === "Unregistered" || reason === "BadDeviceToken") return done("gone");
      if (status === 410 && !reason) return done("gone");

      // Everything else is our problem, not the device's — log the reason so a
      // misconfigured topic or environment is visible instead of silently
      // eating the install base.
      if (status >= 400) {
        console.error(`[apns] send failed: status=${status} reason=${reason || "(none)"} topic=${headers["apns-topic"]}`);
      }
      done("error");
    });
    req.on("error", () => { done("error"); try { client.close(); } catch { /* ignore */ } });

    req.end(body);
  });
}

/**
 * Tell a device its Wallet pass changed.
 *
 * Empty payload and topic = the PASS TYPE IDENTIFIER, not the app's bundle id.
 * That combination is the entire protocol: iOS receives it, calls back to the
 * pass's webServiceURL asking which serials changed, and re-downloads them.
 * There is no user-visible notification and no app involvement — a pass in a
 * wallet belonging to someone who has never installed the app still updates.
 */
export async function sendWalletPassPush(pushToken: string): Promise<ApnsSendResult> {
  const topic = process.env.APPLE_PASS_TYPE_ID;
  if (!topic) return "not_configured";
  return apnsPost(pushToken, { "apns-topic": topic, "apns-push-type": "background", "apns-priority": "5" }, "{}");
}

/**
 * Send one alert push to one APNs device token over HTTP/2.
 * Returns "gone" when Apple reports the token unregistered (caller should
 * delete the subscription row) — mirrors web-push's 404/410 handling.
 */
export async function sendApnsNotification(
  endpoint: string,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<ApnsSendResult> {
  const deviceToken = endpoint.slice(APNS_PREFIX.length);
  const topic = process.env.APPLE_PUSH_TOPIC || APNS_TOPIC_DEFAULT;

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      "thread-id": payload.tag ?? "swiftcard",
    },
    // Custom key: the in-app destination. NativeAppBridge navigates here when
    // the user taps the notification.
    url: payload.url,
  });

  // apns-collapse-id is what makes "one notification per visitor per visit"
  // TRUE ON THE LOCK SCREEN: iOS replaces a delivered notification carrying an
  // id it has already shown, instead of stacking a second one. Without it the
  // upgrade from "viewed your card" to "saved your contact card" arrives as a
  // second banner — which is the duplicate we are removing (lib/visit-notify).
  // Apple caps the header at 64 bytes; tags are short by construction, but
  // truncate rather than let APNs reject the whole send.
  const collapseId = (payload.tag ?? "").slice(0, 64);

  return apnsPost(
    deviceToken,
    {
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      ...(collapseId ? { "apns-collapse-id": collapseId } : {}),
    },
    body,
  );
}
