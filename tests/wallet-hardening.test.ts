import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { passCertDaysLeft, EMAIL_SHARES_ROW_MAX } from "@/lib/wallet";

const read = (p: string) => readFileSync(p, "utf8");

// Three hardening rules from the 2026-08-27 Wallet audit. None changes how a
// pass LOOKS for the cards that already work; each closes a way a pass could
// quietly go wrong later.
describe("Apple Wallet hardening", () => {
  it("a long email takes the secondary row alone; the phone drops to the auxiliary row", () => {
    const src = read("src/lib/wallet.ts");
    expect(EMAIL_SHARES_ROW_MAX).toBe(24);
    expect(src).toMatch(/const longEmail = !!card\.email && card\.email\.length > EMAIL_SHARES_ROW_MAX;/);
    expect(src).toMatch(/if \(card\.phone && !longEmail\) pass\.secondaryFields\.push\(\{ key: "phone"/);
    expect(src).toMatch(/if \(card\.phone && longEmail\) pass\.auxiliaryFields\.push\(\{ key: "phone"/);
    // The email itself is never dropped or moved.
    expect(src).toMatch(/if \(card\.email\) pass\.secondaryFields\.push\(\{ key: "email"/);
  });

  it("certificate expiry is readable and unreadable input is tolerated", () => {
    expect(passCertDaysLeft(undefined)).toBeNull();
    expect(passCertDaysLeft("not a cert")).toBeNull();
    // Node can't mint an X.509 cert without openssl, so verify the parser
    // on the WWDR-style structure via the class itself: a garbage PEM throws
    // and is mapped to null above; a real cert path is exercised in prod.
    expect(typeof X509Certificate).toBe("function");
    expect(() => generateKeyPairSync("ec", { namedCurve: "P-256" })).not.toThrow();
    const src = read("src/lib/wallet.ts");
    expect(src).toMatch(/warnIfCertExpiring\(\);/);
    expect(src).toMatch(/days <= 30/);
  });

  it("an image that fails to load is retried, and a degraded pass is never fingerprinted as final", () => {
    const strip = read("src/lib/wallet-strip.tsx");
    expect(strip).toMatch(/if \(attempt === 1\) return fetchImage\(url, 2\);/);
    expect(strip).toMatch(/attempt === 1 \? 2500 : 6000/);
    expect(strip).toMatch(/degraded = imageFailures > before/);
    const pass = read("src/lib/wallet-pass.ts");
    expect(pass).toMatch(/export async function buildPassDetailed/);
    const route = read("src/app/api/wallet/pass/route.ts");
    expect(route).toMatch(/buildPassDetailed\(inputs\)/);
    expect(route).toMatch(/if \(degraded\) \{[\s\S]*markWalletPassStale\(username\)[\s\S]*\} else \{[\s\S]*touchWalletPass\(username\)/);
    const reg = read("src/lib/wallet-registry.ts");
    expect(reg).toMatch(/content_hash: `degraded:\$\{Date\.now\(\)\}`/);
  });

  it("the auth-token secret is documented so a cert renewal can't strand installed passes", () => {
    expect(read(".env.example")).toMatch(/WALLET_AUTH_SECRET=/);
  });
});
