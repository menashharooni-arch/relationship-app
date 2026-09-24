import { describe, it, expect } from "vitest";
import { suggestDomain, levenshtein, COMMON_DOMAINS, KNOWN_GOOD_DOMAINS } from "@/lib/email-typo";

// ── "Did you mean you@gmail.com?" ───────────────────────────────────────────
// With email confirmation off, a mistyped address is an account nobody can
// reach and a reset email nobody receives. This is the only net.

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("gmail.com", "gmail.com")).toBe(0);
    expect(levenshtein("gmial.com", "gmail.com")).toBe(2);
    expect(levenshtein("gmail.co", "gmail.com")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("suggestDomain", () => {
  it("catches the classic slips", () => {
    expect(suggestDomain("x@gmial.com")).toBe("x@gmail.com");
    expect(suggestDomain("x@gmail.co")).toBe("x@gmail.com");
    expect(suggestDomain("x@gmail.con")).toBe("x@gmail.com");
    expect(suggestDomain("x@gamil.com")).toBe("x@gmail.com");
    expect(suggestDomain("x@hotmail.cm")).toBe("x@hotmail.com");
    expect(suggestDomain("x@yaho.com")).toBe("x@yahoo.com");
    expect(suggestDomain("x@outlok.com")).toBe("x@outlook.com");
    expect(suggestDomain("x@iclould.com")).toBe("x@icloud.com");
    expect(suggestDomain("x@protonmail.co")).toBe("x@protonmail.com");
  });

  it("leaves a correct address alone", () => {
    for (const d of COMMON_DOMAINS) expect(suggestDomain(`x@${d}`), d).toBeNull();
  });

  it("never 'corrects' a real provider that happens to be close", () => {
    for (const d of KNOWN_GOOD_DOMAINS) expect(suggestDomain(`x@${d}`), d).toBeNull();
    expect(suggestDomain("x@mail.com")).toBeNull();
    expect(suggestDomain("x@msn.com")).toBeNull();
  });

  it("never second-guesses a company domain", () => {
    expect(suggestDomain("x@company.com")).toBeNull();
    expect(suggestDomain("x@swiftcard.me")).toBeNull();
    expect(suggestDomain("x@malvecapital.com")).toBeNull();
    expect(suggestDomain("x@acme.io")).toBeNull();
  });

  it("needs a long enough domain before trusting two edits", () => {
    // One edit is always a slip: ao.com → aol.com, me.co → me.com. Two edits
    // on a short domain could be a different real domain, so leave it.
    expect(suggestDomain("x@ao.com")).toBe("x@aol.com");
    expect(suggestDomain("x@me.co")).toBe("x@me.com");
    expect(suggestDomain("x@ab.com")).toBeNull();
    expect(suggestDomain("x@xy.org")).toBeNull();
  });

  it("keeps the local part exactly as typed and normalises the rest", () => {
    expect(suggestDomain("Ann.Lee@GMIAL.com")).toBe("Ann.Lee@gmail.com");
    expect(suggestDomain("  x@gmial.com  ")).toBe("x@gmail.com");
  });

  it("returns null for anything that is not one address", () => {
    expect(suggestDomain("")).toBeNull();
    expect(suggestDomain("nothing")).toBeNull();
    expect(suggestDomain("@gmial.com")).toBeNull();
    expect(suggestDomain("x@gmial")).toBeNull();
    expect(suggestDomain("a@b@gmial.com")).toBeNull();
  });
});
