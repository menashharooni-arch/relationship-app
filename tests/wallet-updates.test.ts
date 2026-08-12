import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { passAuthToken, verifyPassAuth } from "@/lib/wallet-registry";
import { passContentHash, type PassInputs } from "@/lib/wallet-pass";

// The pass web service is what lets a redesign reach a pass someone is already
// carrying. Two pieces of it are pure and load-bearing enough to pin: the token
// that authenticates every device callback, and the fingerprint that decides
// whether anyone gets woken at all.

const SECRET = "test-wallet-secret";

describe("pass authentication token", () => {
  let prev: string | undefined;
  beforeEach(() => { prev = process.env.WALLET_AUTH_SECRET; process.env.WALLET_AUTH_SECRET = SECRET; });
  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_AUTH_SECRET;
    else process.env.WALLET_AUTH_SECRET = prev;
  });

  it("is stable across rebuilds — a pass minted a year ago still authenticates", () => {
    expect(passAuthToken("aaron-lavi")).toBe(passAuthToken("aaron-lavi"));
  });

  it("is different per pass, so one pass's token can't fetch another", () => {
    const a = passAuthToken("aaron-lavi")!;
    const b = passAuthToken("aaron-lavi-malve-capital")!;
    expect(a).not.toBe(b);
    expect(verifyPassAuth(`ApplePass ${a}`, "aaron-lavi-malve-capital")).toBe(false);
  });

  it("accepts the real header and rejects everything close to it", () => {
    const token = passAuthToken("aaron-lavi")!;
    expect(verifyPassAuth(`ApplePass ${token}`, "aaron-lavi")).toBe(true);
    expect(verifyPassAuth(`applepass ${token}`, "aaron-lavi")).toBe(true); // scheme is case-insensitive
    expect(verifyPassAuth(`ApplePass   ${token}  `, "aaron-lavi")).toBe(true);

    expect(verifyPassAuth(null, "aaron-lavi")).toBe(false);
    expect(verifyPassAuth("", "aaron-lavi")).toBe(false);
    expect(verifyPassAuth(token, "aaron-lavi")).toBe(false);            // no scheme
    expect(verifyPassAuth(`Bearer ${token}`, "aaron-lavi")).toBe(false); // wrong scheme
    expect(verifyPassAuth("ApplePass ", "aaron-lavi")).toBe(false);
    expect(verifyPassAuth(`ApplePass ${token}x`, "aaron-lavi")).toBe(false);
    expect(verifyPassAuth(`ApplePass ${token.slice(0, -1)}`, "aaron-lavi")).toBe(false);
  });

  it("refuses everything when no secret is configured, rather than a fixed token", () => {
    delete process.env.WALLET_AUTH_SECRET;
    const prevKey = process.env.APPLE_PASS_KEY_PEM;
    delete process.env.APPLE_PASS_KEY_PEM;
    try {
      expect(passAuthToken("aaron-lavi")).toBeNull();
      expect(verifyPassAuth("ApplePass anything", "aaron-lavi")).toBe(false);
    } finally {
      if (prevKey !== undefined) process.env.APPLE_PASS_KEY_PEM = prevKey;
    }
  });
});

describe("pass content fingerprint", () => {
  const inputs = (over: Partial<PassInputs["card"]> = {}, metaOver = {}): PassInputs => ({
    card: {
      username: "aaron-lavi", name: "Aaron Lavi", title: "Principal", company: "Nadlan Homes",
      phone: "9179057335", email: "a@example.com", website: null, label: "Personal", ...over,
    },
    meta: {
      name: "Aaron Lavi", title: "Principal", company: "Nadlan Homes",
      photoUrl: null, logoUrl: null, phone: null, email: null, website: null, address: null,
      accentColor: null, template: "luxury-minimal", style: {}, custom: null, ...metaOver,
    },
  });

  it("is stable for identical input — an unchanged card wakes nobody", () => {
    expect(passContentHash(inputs())).toBe(passContentHash(inputs()));
  });

  it("moves for every field the pass actually shows", () => {
    const base = passContentHash(inputs());
    expect(passContentHash(inputs({ name: "Aaron L" }))).not.toBe(base);
    expect(passContentHash(inputs({ title: "Director" }))).not.toBe(base);
    expect(passContentHash(inputs({ company: "Malve" }))).not.toBe(base);
    expect(passContentHash(inputs({ phone: "2125550000" }))).not.toBe(base);
    expect(passContentHash(inputs({ email: "b@example.com" }))).not.toBe(base);
    expect(passContentHash(inputs({ label: "Work" }))).not.toBe(base); // names the pass
    expect(passContentHash(inputs({}, { template: "modern-bold" }))).not.toBe(base);
    expect(passContentHash(inputs({}, { accentColor: "#ff0000" }))).not.toBe(base);
    expect(passContentHash(inputs({}, { photoUrl: "https://x/y.png" }))).not.toBe(base);
    expect(passContentHash(inputs({}, { logoUrl: "https://x/y.png" }))).not.toBe(base);
    expect(passContentHash(inputs({}, { style: { bgColor: "#000000" } }))).not.toBe(base);
    expect(passContentHash(inputs({}, {
      custom: { background: "#111111", textColor: "#ffffff", fontFamily: "s" },
    }))).not.toBe(base);
  });

  it("ignores what the pass does not show, so an unrelated edit is silent", () => {
    // The website is on the BACK of the pass only via card.website, which is
    // part of the hash; address is not on the pass at all.
    expect(passContentHash(inputs({}, { address: "1 Main St" }))).toBe(passContentHash(inputs()));
  });

  it("survives a card with no resolvable design", () => {
    const bare: PassInputs = { card: inputs().card, meta: null };
    expect(passContentHash(bare)).toBe(passContentHash({ card: inputs().card, meta: null }));
    expect(passContentHash(bare)).not.toBe(passContentHash(inputs()));
  });
});
