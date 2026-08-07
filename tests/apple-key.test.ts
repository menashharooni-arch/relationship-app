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
