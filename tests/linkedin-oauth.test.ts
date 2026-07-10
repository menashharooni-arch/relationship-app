import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signState, verifyState } from "@/lib/oauth-state";
import {
  isLinkedInEnabled,
  LINKEDIN_SCOPES,
  LINKEDIN_AUTH_URL,
  LINKEDIN_REDIRECT_URI,
} from "@/lib/sync-linkedin";

// The LinkedIn callback reuses the shared signed-state helper exactly like the
// Google integration, so the security-critical behavior to lock in is: a state
// this module signs verifies back to the same user_id, and a tampered state is
// rejected (can't bind LinkedIn tokens to another user's row).
describe("LinkedIn OAuth signed state (shared helper)", () => {
  it("round-trips a user_id through sign → verify", () => {
    const uid = "user-abc-123";
    const state = signState(uid);
    expect(verifyState(state)).toBe(uid);
  });

  it("rejects a tampered signature", () => {
    const state = signState("victim-user");
    const [payload] = state.split(".");
    const forged = `${payload}.deadbeef`;
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects a swapped payload (forged user_id) — the whole point of signing", () => {
    const state = signState("real-user");
    const sig = state.split(".")[1];
    const fakePayload = Buffer.from("attacker.999").toString("base64url");
    expect(verifyState(`${fakePayload}.${sig}`)).toBeNull();
  });

  it("rejects malformed states", () => {
    expect(verifyState("garbage")).toBeNull();
    expect(verifyState("")).toBeNull();
  });
});

describe("LinkedIn config gating (fail-safe)", () => {
  const orig = { id: process.env.LINKEDIN_CLIENT_ID, secret: process.env.LINKEDIN_CLIENT_SECRET };
  beforeEach(() => { delete process.env.LINKEDIN_CLIENT_ID; delete process.env.LINKEDIN_CLIENT_SECRET; });
  afterEach(() => {
    if (orig.id === undefined) delete process.env.LINKEDIN_CLIENT_ID; else process.env.LINKEDIN_CLIENT_ID = orig.id;
    if (orig.secret === undefined) delete process.env.LINKEDIN_CLIENT_SECRET; else process.env.LINKEDIN_CLIENT_SECRET = orig.secret;
  });

  it("is disabled unless BOTH client id and secret are present", () => {
    expect(isLinkedInEnabled()).toBe(false);
    process.env.LINKEDIN_CLIENT_ID = "id";
    expect(isLinkedInEnabled()).toBe(false); // secret still missing
    process.env.LINKEDIN_CLIENT_SECRET = "secret";
    expect(isLinkedInEnabled()).toBe(true);
  });
});

describe("LinkedIn OAuth constants use official endpoints + minimal scopes", () => {
  it("authorizes against linkedin.com and requests only openid profile email", () => {
    expect(LINKEDIN_AUTH_URL).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(LINKEDIN_SCOPES).toBe("openid profile email");
    expect(LINKEDIN_REDIRECT_URI).toMatch(/\/api\/integrations\/linkedin\/callback$/);
  });
});
