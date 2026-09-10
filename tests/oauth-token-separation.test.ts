import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signState, verifyState, signConnectHandoff, verifyConnectHandoff } from "@/lib/oauth-state";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const USER = "11111111-2222-3333-4444-555555555555";

beforeAll(() => {
  process.env.OAUTH_SECRET = process.env.OAUTH_SECRET || "test-secret-for-separation";
});

// ── An OAuth `state` is not a password ──────────────────────────────────────
//
// The native connect handoff token is a CREDENTIAL: present it as ?h= and the
// connect route runs as that user. It used to be the very same token as the
// OAuth `state`. But `state` is put in a query string and handed to Google or
// Salesforce, so it lands in browser history, in the provider's logs, and in
// referrers — it is not secret and was never meant to be. Anyone holding one
// could complete a connect as its owner with their OWN provider account, and
// have their tokens written onto the victim's integrations row.

describe("the two token types cannot be substituted for each other", () => {
  it("an OAuth state is rejected as a connect handoff", () => {
    const state = signState(USER);
    expect(verifyState(state)).toBe(USER); // still a valid state
    expect(verifyConnectHandoff(state), "an OAuth state still authenticates a connect").toBeNull();
  });

  it("a connect handoff is rejected as an OAuth state", () => {
    const handoff = signConnectHandoff(USER);
    expect(verifyConnectHandoff(handoff)).toBe(USER);
    expect(verifyState(handoff), "a handoff token still passes as an OAuth state").toBeNull();
  });

  it("each still round-trips its own user id", () => {
    expect(verifyState(signState(USER))).toBe(USER);
    expect(verifyConnectHandoff(signConnectHandoff(USER))).toBe(USER);
  });
});

describe("a handoff token is unforgeable and short-lived", () => {
  it("rejects a tampered signature", () => {
    const t = signConnectHandoff(USER);
    const [payload, sig] = t.split(".");
    const flipped = sig[0] === "a" ? "b" + sig.slice(1) : "a" + sig.slice(1);
    expect(verifyConnectHandoff(`${payload}.${flipped}`)).toBeNull();
  });

  it("rejects a re-signed payload naming someone else", () => {
    // Swapping the user id inside the payload invalidates the HMAC.
    const t = signConnectHandoff(USER);
    const [payload, sig] = t.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const swapped = decoded.replace(USER, "99999999-9999-9999-9999-999999999999");
    const forged = Buffer.from(swapped).toString("base64url");
    expect(verifyConnectHandoff(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects junk without throwing", () => {
    for (const junk of ["", ".", "a.b.c", "not-base64.sig", "x".repeat(500)]) {
      expect(() => verifyConnectHandoff(junk)).not.toThrow();
      expect(verifyConnectHandoff(junk)).toBeNull();
    }
  });

  it("expires far sooner than an OAuth state", () => {
    const src = read("src/lib/oauth-state.ts");
    const handoff = /HANDOFF_MAX_AGE_MS = (\d+) \* 60 \* 1000/.exec(src);
    const state = /MAX_AGE_MS = (\d+) \* 60 \* 1000/.exec(src);
    expect(handoff, "handoff lifetime constant moved").toBeTruthy();
    expect(state, "state lifetime constant moved").toBeTruthy();
    expect(Number(handoff![1])).toBeLessThan(Number(state![1]));
  });
});

describe("the call sites use the right one", () => {
  it("the handoff route mints a handoff, not a state", () => {
    const src = read("src/app/api/integrations/handoff/route.ts");
    expect(src).toContain("signConnectHandoff(user.id)");
    expect(src).not.toContain("signState(");
  });

  it("the ?h= credential path verifies a handoff, not a state", () => {
    const src = read("src/lib/connect-user.ts");
    expect(src).toContain("verifyConnectHandoff(h)");
    expect(src).not.toContain("verifyState(");
  });

  it("the OAuth callbacks still verify a state", () => {
    // The provider round trip is unchanged — this must not have been swapped
    // by accident, or every integration connect breaks.
    for (const p of [
      "src/app/api/integrations/google/callback/route.ts",
      "src/app/api/integrations/salesforce/callback/route.ts",
      "src/app/api/integrations/linkedin/callback/route.ts",
    ]) {
      expect(read(p), `${p} stopped verifying the OAuth state`).toContain("verifyState(state)");
    }
  });

  it("the connect routes still mint a state for the provider", () => {
    for (const p of [
      "src/app/api/integrations/google/connect/route.ts",
      "src/app/api/integrations/salesforce/connect/route.ts",
      "src/app/api/integrations/linkedin/connect/route.ts",
    ]) {
      expect(read(p), `${p} stopped minting an OAuth state`).toContain("signState(");
    }
  });
});
