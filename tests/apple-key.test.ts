import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeApplePrivateKey } from "@/lib/apple-key";

// A throwaway P-256 key in the same PEM shape Apple issues (.p8 / PKCS#8).
// Generated per run — no real key material lives in the repo.
const pem = crypto
  .generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

function canSign(key: string): boolean {
  try {
    crypto.sign("sha256", Buffer.from("payload"), {
      key: normalizeApplePrivateKey(key),
      dsaEncoding: "ieee-p1363",
    });
    return true;
  } catch {
    return false;
  }
}

describe("normalizeApplePrivateKey", () => {
  it("leaves a well-formed PEM usable", () => {
    expect(canSign(pem)).toBe(true);
  });

  // The actual bug this exists for: pasting the key into a dashboard that
  // escapes newlines. Without normalization crypto.sign throws, and both call
  // sites swallow it — push and Apple token revocation die silently.
  it("repairs escaped \\n newlines", () => {
    const escaped = pem.replace(/\n/g, "\\n");
    expect(canSign(escaped)).toBe(true);
    // prove the raw form really is broken, so this test can't pass vacuously
    let rawWorks = true;
    try {
      crypto.sign("sha256", Buffer.from("x"), { key: escaped, dsaEncoding: "ieee-p1363" });
    } catch {
      rawWorks = false;
    }
    expect(rawWorks).toBe(false);
  });

  it("repairs escaped CRLF and surrounding quotes", () => {
    expect(canSign(pem.replace(/\n/g, "\\r\\n"))).toBe(true);
    expect(canSign(`"${pem.replace(/\n/g, "\\n")}"`)).toBe(true);
    expect(canSign(`'${pem}'`)).toBe(true);
  });

  it("tolerates a missing trailing newline", () => {
    expect(canSign(pem.trimEnd())).toBe(true);
  });
});

describe("both Apple signers normalize their key", () => {
  // Guards against one of the two call sites being fixed and the other drifting.
  it("apns.ts and apple-revoke.ts both run the env value through the helper", () => {
    for (const f of ["src/lib/apns.ts", "src/lib/apple-revoke.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("normalizeApplePrivateKey");
      // the key passed to crypto.sign must be the normalized one, never raw env
      expect(src).toMatch(/key: normalizeApplePrivateKey\(/);
    }
  });

  it("both sign ES256 with JOSE r||s, not DER", () => {
    for (const f of ["src/lib/apns.ts", "src/lib/apple-revoke.ts"]) {
      expect(readFileSync(f, "utf8")).toContain('dsaEncoding: "ieee-p1363"');
    }
  });
});

describe("Apple refresh-token persistence (5.1.1(v))", () => {
  // The provider refresh token exists exactly once, on the freshly exchanged
  // session — identity_data never carries it. Every one of these three legs
  // has to hold or deletion quietly stops revoking again.
  it("web callback persists it server-side", () => {
    const cb = readFileSync("src/app/auth/callback/route.ts", "utf8");
    expect(cb).toMatch(/provider_refresh_token/);
    expect(cb).toMatch(/saveAppleRefreshToken/);
  });
  it("native flow hands it to the API, stored under the session user", () => {
    const na = readFileSync("src/lib/native-auth.ts", "utf8");
    expect(na).toMatch(/\/api\/auth\/apple-token/);
    const route = readFileSync("src/app/api/auth/apple-token/route.ts", "utf8");
    // stored under the AUTHENTICATED user's id, never an id from the body
    expect(route).toMatch(/saveAppleRefreshToken\(user\.id/);
    expect(route).toMatch(/getUser\(\)/);
  });
  it("revocation reads the store, not just identity_data", () => {
    const rv = readFileSync("src/lib/apple-revoke.ts", "utf8");
    expect(rv).toMatch(/readAppleRefreshToken/);
  });
  it("the table is service-role only and dies with the user", () => {
    const sql = readFileSync("supabase/apple-refresh-tokens.sql", "utf8");
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.apple_refresh_tokens from anon, authenticated/);
    expect(sql).toMatch(/on delete cascade/);
  });
});
