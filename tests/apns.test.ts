import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const APNS = "src/lib/apns.ts";

describe("a config error does not unregister every iOS device", () => {
  it("reads APNs' reason from the response body", () => {
    // The body carries { "reason": "..." } and was never read, so every 400
    // was treated as a dead token and the caller DELETED the subscription.
    const c = code(APNS);
    expect(c).toMatch(/req\.setEncoding\("utf8"\)/);
    expect(c).toMatch(/req\.on\("data"/);
    expect(c).toMatch(/JSON\.parse\(raw\)/);
  });

  it("prunes only on Unregistered or BadDeviceToken", () => {
    const c = code(APNS);
    expect(c).toMatch(/reason === "Unregistered" \|\| reason === "BadDeviceToken"/);
    expect(
      c,
      "a bare 400 still prunes — BadTopic and DeviceTokenNotForTopic would wipe the install base",
    ).not.toMatch(/status === 410 \|\| status === 400/);
  });

  it("still prunes a 410 with no body", () => {
    // 410 is always Unregistered, body or not.
    expect(code(APNS)).toMatch(/status === 410 && !reason/);
  });

  it("logs the reason instead of swallowing it", () => {
    expect(code(APNS)).toMatch(/\[apns\] send failed: status=/);
  });

  it("caps how much of the body it buffers", () => {
    expect(code(APNS)).toMatch(/raw\.length < 2048/);
  });
});

describe("the provider JWT is cached, not minted per notification", () => {
  it("send paths go through the cache", () => {
    const c = code(APNS);
    expect(c).toMatch(/jwt = getApnsJwt\(teamId, keyId, privateKey\)/);
    // buildApnsJwt should now be reached only from getApnsJwt.
    const buildCalls = c.match(/buildApnsJwt\(/g) ?? [];
    expect(buildCalls.length, "buildApnsJwt is still called from a send path").toBe(2); // declaration + the one call inside getApnsJwt
  });

  it("refreshes inside Apple's expiry but outside its mint floor", () => {
    // Apple accepts a token for ~1h but rejects minting more than about once
    // per 20 minutes per key (TooManyProviderTokenUpdates → 403).
    const c = code(APNS);
    expect(c).toMatch(/JWT_TTL_MS = 50 \* 60 \* 1000/);
  });

  it("is keyed on the credentials, so a rotation can't serve a stale token", () => {
    const c = code(APNS);
    expect(c).toMatch(/const key = `\$\{teamId\}:\$\{keyId\}`/);
    expect(c).toMatch(/cachedJwt\.key === key/);
  });
});
