import { describe, it, expect } from "vitest";
import {
  isPersonalEmailDomain,
  extractEmailDomain,
  isValidDomain,
  normalizeLogoInput,
  parseLogoDevMatches,
  LogoDevProvider,
} from "@/lib/logo-provider";

describe("personal-domain detection", () => {
  it("flags common free mailbox providers", () => {
    for (const d of ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "aol.com"]) {
      expect(isPersonalEmailDomain(d)).toBe(true);
    }
  });
  it("does not flag a real company domain", () => {
    expect(isPersonalEmailDomain("acme.com")).toBe(false);
    expect(isPersonalEmailDomain("stripe.com")).toBe(false);
  });
  it("is case- and trailing-dot-insensitive", () => {
    expect(isPersonalEmailDomain("GMAIL.com")).toBe(true);
    expect(isPersonalEmailDomain("gmail.com.")).toBe(true);
  });
});

describe("extractEmailDomain", () => {
  it("returns the domain for email-shaped input", () => {
    expect(extractEmailDomain("john@acme.com")).toBe("acme.com");
    expect(extractEmailDomain("  John@Acme.CO  ")).toBe("acme.co");
  });
  it("returns null for non-emails", () => {
    expect(extractEmailDomain("acme.com")).toBeNull();
    expect(extractEmailDomain("Acme Corp")).toBeNull();
    expect(extractEmailDomain("john@")).toBeNull();
    expect(extractEmailDomain("@acme.com")).toBeNull();
  });
});

describe("isValidDomain", () => {
  it("accepts real domains", () => {
    expect(isValidDomain("acme.com")).toBe(true);
    expect(isValidDomain("sub.acme.co.uk")).toBe(true);
  });
  it("rejects names, schemes, paths, and junk", () => {
    expect(isValidDomain("Acme Corp")).toBe(false);
    expect(isValidDomain("https://acme.com")).toBe(false);
    expect(isValidDomain("acme.com/path")).toBe(false);
    expect(isValidDomain("acme")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
});

describe("normalizeLogoInput", () => {
  it("routes a business email to its domain", () => {
    expect(normalizeLogoInput("jane@stripe.com")).toEqual({ kind: "query", query: "stripe.com" });
  });
  it("short-circuits personal emails", () => {
    expect(normalizeLogoInput("jane@gmail.com")).toEqual({ kind: "personal" });
  });
  it("short-circuits a bare personal domain too", () => {
    expect(normalizeLogoInput("gmail.com")).toEqual({ kind: "personal" });
  });
  it("treats a domain as a query", () => {
    expect(normalizeLogoInput("acme.com")).toEqual({ kind: "query", query: "acme.com" });
  });
  it("treats a plain company name as a query", () => {
    expect(normalizeLogoInput("Acme Corp")).toEqual({ kind: "query", query: "Acme Corp" });
  });
  it("rejects empty, over-long, and malformed @ input", () => {
    expect(normalizeLogoInput("")).toEqual({ kind: "invalid" });
    expect(normalizeLogoInput("   ")).toEqual({ kind: "invalid" });
    expect(normalizeLogoInput("a".repeat(201))).toEqual({ kind: "invalid" });
    expect(normalizeLogoInput("john@")).toEqual({ kind: "invalid" });
    expect(normalizeLogoInput("!!!")).toEqual({ kind: "invalid" });
  });
});

describe("parseLogoDevMatches", () => {
  it("maps well-formed matches and dedupes by domain", () => {
    const body = [
      { name: "Stripe", domain: "stripe.com", logo_url: "https://img.logo.dev/stripe.com?token=x" },
      { name: "Stripe (dup)", domain: "stripe.com", logo_url: "https://img.logo.dev/stripe.com?token=y" },
      { name: "Acme", domain: "acme.com", logo_url: "https://img.logo.dev/acme.com?token=z" },
    ];
    const out = parseLogoDevMatches(body);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "Stripe", domain: "stripe.com", logoUrl: "https://img.logo.dev/stripe.com?token=x" });
  });
  it("drops entries missing fields or with non-https logo URLs", () => {
    const body = [
      { name: "NoLogo", domain: "x.com" },
      { name: "", domain: "y.com", logo_url: "https://img.logo.dev/y.com" },
      { name: "BadScheme", domain: "z.com", logo_url: "http://img.logo.dev/z.com" },
      { name: "Data", domain: "d.com", logo_url: "data:image/png;base64,AAA" },
    ];
    expect(parseLogoDevMatches(body)).toEqual([]);
  });
  it("returns [] for non-array bodies", () => {
    expect(parseLogoDevMatches(null)).toEqual([]);
    expect(parseLogoDevMatches({})).toEqual([]);
    expect(parseLogoDevMatches("nope")).toEqual([]);
  });
});

describe("LogoDevProvider fail-safe (no credential)", () => {
  it("reports not configured when the token is absent", async () => {
    const p = new LogoDevProvider(undefined);
    expect(p.isConfigured()).toBe(false);
    const res = await p.suggest("Acme Corp");
    expect(res).toEqual({ status: "not_configured", candidates: [] });
  });
  it("treats an empty/whitespace token as absent", () => {
    expect(new LogoDevProvider("   ").isConfigured()).toBe(false);
  });
  it("short-circuits personal + invalid input WITHOUT a network call", async () => {
    // Configured (fake token) but the input never reaches the network because
    // normalization rejects it first — proves the guard order.
    const p = new LogoDevProvider("sk_test_fake");
    expect(await p.suggest("jane@gmail.com")).toEqual({ status: "personal_domain", candidates: [] });
    expect(await p.suggest("")).toEqual({ status: "invalid_input", candidates: [] });
  });
});
