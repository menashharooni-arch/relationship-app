import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { assessPassword, emailLocalPart, COMMON_PASSWORDS, MIN_LENGTH, CONFIRM_MISMATCH } from "@/lib/password-policy";

// ── The one password rule (owner decision 2026-09-24) ───────────────────────
// 8+ characters, no complexity rules, refuse the obvious. The same function
// gates create-account and reset, and the Supabase project is kept at the same
// minimum by scripts/supabase-auth-policy.mjs.

describe("the rule itself", () => {
  it("is 8 characters, and the Supabase script agrees", () => {
    expect(MIN_LENGTH).toBe(8);
    const script = readFileSync("scripts/supabase-auth-policy.mjs", "utf8");
    expect(script).toMatch(/const MIN_LENGTH = 8;/);
    expect(script).toMatch(/password_min_length: MIN_LENGTH/);
  });

  it("refuses 7 characters with the exact words the form shows", () => {
    const r = assessPassword("abcdefg");
    expect(r).toEqual({ ok: false, score: 0, label: "Too short", reason: "Use at least 8 characters." });
  });

  it("accepts 8 plain characters (no complexity rule)", () => {
    const r = assessPassword("abcdefgh");
    expect(r.ok).toBe(true);
    expect(r.score).toBe(1);
    expect(r.label).toBe("Weak");
    expect(r.reason).toBeNull();
  });

  it("does not throw on nothing", () => {
    expect(() => assessPassword("", undefined)).not.toThrow();
    expect(() => assessPassword("x", null)).not.toThrow();
    expect(assessPassword("").ok).toBe(false);
  });

  it("exports the mismatch copy once, for both forms", () => {
    expect(CONFIRM_MISMATCH).toBe("Passwords don't match.");
  });
});

describe("common passwords", () => {
  it("are refused, whatever the case", () => {
    expect(assessPassword("password123").ok).toBe(false);
    expect(assessPassword("PASSWORD123").reason).toBe("That password is too common. Pick something harder to guess.");
    expect(assessPassword("SwiftCard1").ok).toBe(false);
  });

  it("are all at least MIN_LENGTH and lowercase — shorter ones would be dead weight", () => {
    for (const p of COMMON_PASSWORDS) {
      expect(p.length, p).toBeGreaterThanOrEqual(MIN_LENGTH);
      expect(p, p).toBe(p.toLowerCase());
    }
    expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
  });
});

describe("the email rule", () => {
  it("reads the local part, lowercased", () => {
    expect(emailLocalPart("Ann.Lee@Example.com")).toBe("ann.lee");
    expect(emailLocalPart("  x@y.z ")).toBe("x");
    expect(emailLocalPart("")).toBe("");
    expect(emailLocalPart(undefined)).toBe("");
  });

  it("refuses a password containing the whole local part", () => {
    expect(assessPassword("ann.lee2026", "Ann.Lee@x.com").reason).toBe("Your password can't contain your email address.");
    expect(assessPassword("xxANN.LEExx", "ann.lee@x.com").ok).toBe(false);
  });

  it("refuses the first token when it is 4+ characters", () => {
    expect(assessPassword("menash-2026!", "menash.h@x.com").ok).toBe(false);
  });

  it("ignores a local part shorter than 4 — 'ann' would refuse every password with those letters", () => {
    expect(assessPassword("bananaboat", "ann@x.com").ok).toBe(true);
    expect(assessPassword("a-long-password", "a@x.com").ok).toBe(true);
  });
});

describe("the meter is advice, never a gate", () => {
  it("scores by length first", () => {
    expect(assessPassword("correct-horse-battery").score).toBe(3);
    expect(assessPassword("abcdefghij").score).toBe(2);
  });

  it("credits mixed character classes", () => {
    expect(assessPassword("Xk9!pq2m").score).toBe(2);
    expect(assessPassword("Xk9!pq2mLw4z").score).toBe(3);
  });

  it("never blocks anything that passes the three rules", () => {
    for (const p of ["abcdefgh", "abcdefghij", "Xk9!pq2m", "correct-horse-battery"]) {
      expect(assessPassword(p).ok, p).toBe(true);
      expect(assessPassword(p).reason, p).toBeNull();
    }
  });
});
