import crypto from "node:crypto";
import http2 from "node:http2";

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

// Provider-token JWT (ES256). Apple accepts tokens up to 1h old; we build a
// fresh short-lived one per send batch — simple and stateless.
function buildApnsJwt(teamId: string, keyId: string, privateKey: string): string {
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

export type ApnsSendResult = "sent" | "not_configured" | "gone" | "error";

/**
 * Send one alert push to one APNs device token over HTTP/2.
 * Returns "gone" when Apple reports the token unregistered (caller should
 * delete the subscription row) — mirrors web-push's 404/410 handling.
 */
export async function sendApnsNotification(
  endpoint: string,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<ApnsSendResult> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_PUSH_KEY_ID;
  const privateKey = process.env.APPLE_PUSH_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKey) return "not_configured";

  const deviceToken = endpoint.slice(APNS_PREFIX.length);
  if (!deviceToken) return "error";

  const topic = process.env.APPLE_PUSH_TOPIC || APNS_TOPIC_DEFAULT;
  const host = process.env.APPLE_PUSH_SANDBOX === "1"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";

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

  let jwt: string;
  try {
    jwt = buildApnsJwt(teamId, keyId, privateKey);
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
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    // Never hang a request path on APNs — notifications are best-effort.
    req.setTimeout(10_000, () => { done("error"); try { req.close(); client.close(); } catch { /* ignore */ } });

    let status = 0;
    req.on("response", (headers) => { status = Number(headers[":status"] ?? 0); });
    req.on("close", () => {
      try { client.close(); } catch { /* ignore */ }
      if (status === 200) return done("sent");
      // 410 Unregistered (or 400 BadDeviceToken) → prune the subscription.
      if (status === 410 || status === 400) return done("gone");
      done("error");
    });
    req.on("error", () => { done("error"); try { client.close(); } catch { /* ignore */ } });

    req.end(body);
  });
}
