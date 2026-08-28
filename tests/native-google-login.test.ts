import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";

// Same shape every deployed environment has: OAUTH_SECRET is a 32-byte hex key
// (token-crypto reads it as hex for AES-256-GCM).
process.env.OAUTH_SECRET ||= "b".repeat(64);

import {
  NATIVE_GOOGLE_REDIRECT_PATH,
  NATIVE_GOOGLE_SCOPES,
  hashHandoff,
  isHandoffHash,
  isNativeGoogleLoginState,
  openIdTokenTicket,
  sealIdTokenTicket,
  signNativeGoogleState,
  verifyNativeGoogleState,
} from "@/lib/native-google-login";
import { signState } from "@/lib/oauth-state";

const SECRET = "handoff-secret-value";
const HASH = hashHandoff(SECRET);

afterEach(() => vi.useRealTimers());

// The whole point of this flow: Google must be sent a swiftcard.me redirect_uri,
// because Google prints the redirect host on its account chooser. If this ever
// points back at the Supabase project host, every app user reads
// "to continue to grxmovpmlgmjncnyiyrt.supabase.co" again.
describe("native Google login — the consent-screen contract", () => {
  it("redirects Google to a swiftcard.me path, never a supabase host", () => {
    expect(NATIVE_GOOGLE_REDIRECT_PATH.startsWith("/api/")).toBe(true);
    expect(NATIVE_GOOGLE_REDIRECT_PATH).not.toMatch(/supabase/i);
  });

  it("asks only for non-sensitive identity scopes (no unverified-app warning)", () => {
    expect(NATIVE_GOOGLE_SCOPES.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    // A sensitive scope here would resurrect the "Google hasn't verified this
    // app" interstitial that the CRM contacts connect still shows.
    expect(NATIVE_GOOGLE_SCOPES).not.toMatch(/googleapis\.com/);
  });

  it("starts the shell's Google sign-in at our own leg, not Supabase's broker", () => {
    const src = readFileSync("src/lib/native-auth.ts", "utf8");
    expect(src).toContain("/api/auth/google/native/start");
    // The Supabase-brokered call must survive only as the fallback, below the
    // google branch — startNativeGoogleLogin() has to be reached first.
    expect(src.indexOf("startNativeGoogleLogin")).toBeLessThan(src.indexOf("signInWithOAuth"));
  });
});

describe("signed state", () => {
  it("round-trips the handoff hash", () => {
    expect(verifyNativeGoogleState(signNativeGoogleState(HASH))).toBe(HASH);
  });

  it("rejects a tampered signature", () => {
    const state = signNativeGoogleState(HASH);
    expect(verifyNativeGoogleState(`${state.slice(0, -4)}beef`)).toBeNull();
  });

  it("rejects a swapped payload — an attacker cannot bind their own handoff hash", () => {
    const sig = signNativeGoogleState(HASH).split(".").pop()!;
    const forged = Buffer.from(`${hashHandoff("attacker")}.${Date.now()}`).toString("base64url");
    expect(verifyNativeGoogleState(`ngl1.${forged}.${sig}`)).toBeNull();
  });

  it("expires after 15 minutes", () => {
    const state = signNativeGoogleState(HASH);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(verifyNativeGoogleState(state)).toBeNull();
  });

  it("rejects junk, empties and nulls", () => {
    for (const bad of ["", "garbage", "ngl1.", "ngl1.a.b.c", null, undefined]) {
      expect(verifyNativeGoogleState(bad)).toBeNull();
    }
  });

  it("is never confused with a CRM connect state (and vice versa)", () => {
    // The CRM callback dispatches on this predicate — a user-binding state must
    // not be routed into the login handler.
    expect(isNativeGoogleLoginState(signState("user-123"))).toBe(false);
    expect(isNativeGoogleLoginState(signNativeGoogleState(HASH))).toBe(true);
    // …and a login state must never verify as a user id.
    expect(verifyNativeGoogleState(signState("user-123"))).toBeNull();
  });

  it("only accepts a real SHA-256 hex hash", () => {
    expect(isHandoffHash(HASH)).toBe(true);
    for (const bad of ["", "xyz", "A".repeat(64), "a".repeat(63), "a".repeat(65), null]) {
      expect(isHandoffHash(bad)).toBe(false);
    }
  });
});

describe("sealed ID-token ticket", () => {
  const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.fake-google-id-token.sig";

  it("opens only for the webview holding the handoff secret", () => {
    const ticket = sealIdTokenTicket(ID_TOKEN, HASH);
    expect(openIdTokenTicket(ticket, SECRET)).toBe(ID_TOKEN);
  });

  it("refuses an interceptor who has the ticket but not the secret", () => {
    const ticket = sealIdTokenTicket(ID_TOKEN, HASH);
    expect(openIdTokenTicket(ticket, "wrong-secret")).toBeNull();
    expect(openIdTokenTicket(ticket, "")).toBeNull();
  });

  it("never exposes the token to anyone reading the custom-scheme URL", () => {
    // The ticket rides swiftcard://auth-callback?gt=… and any app on the device
    // can claim that scheme — so it must be ciphertext, not readable payload.
    const ticket = sealIdTokenTicket(ID_TOKEN, HASH);
    expect(ticket).not.toContain(ID_TOKEN);
    expect(Buffer.from(ticket).toString("base64")).not.toContain(ID_TOKEN);
    expect(ticket.startsWith("v2:")).toBe(true); // AES-256-GCM, authenticated
  });

  it("rejects a tampered ticket (GCM auth tag)", () => {
    const ticket = sealIdTokenTicket(ID_TOKEN, HASH);
    expect(openIdTokenTicket(`${ticket.slice(0, -2)}00`, SECRET)).toBeNull();
    expect(openIdTokenTicket("v2:garbage", SECRET)).toBeNull();
    expect(openIdTokenTicket("", SECRET)).toBeNull();
  });

  it("expires after 3 minutes", () => {
    const ticket = sealIdTokenTicket(ID_TOKEN, HASH);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 4 * 60 * 1000);
    expect(openIdTokenTicket(ticket, SECRET)).toBeNull();
  });
});
