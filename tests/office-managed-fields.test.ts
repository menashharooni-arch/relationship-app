import { describe, it, expect } from "vitest";
import { findManagedFieldViolations, type OfficeBrand } from "@/lib/office-brand";

// Server-side rejection for office SUB-USERS: a PATCH that tries to CHANGE an
// org-managed field away from the office brand is refused with a 403 (the
// overlays remain the normalization backstop). These tests pin down exactly
// what counts as a violation — and, just as importantly, what doesn't, so a
// normal editor save (which echoes the brand values back) always passes.

const brand: OfficeBrand = {
  logoUrl: "https://cdn/acme-logo.png",
  company: "Acme Plumbing",
  website: "acmeplumbing.com",
  template: "modern-bold",
  customLayout: null,
  design: { accentColor: "#123456", fontFamily: "Inter" },
  phone: "(555) 100-2000",
  fax: "(555) 100-2001",
  address: { street: "1 Main St", unit: "", city: "Austin", state: "TX", zip: "78701" },
  lockTemplate: true,
};

describe("findManagedFieldViolations — sub-user attempts on managed fields", () => {
  it("passes a normal editor save that echoes the brand values back", () => {
    const body = {
      company: "Acme Plumbing",
      website: "acmeplumbing.com",
      logo_url: "https://cdn/acme-logo.png",
      template: "modern-bold",
      name: "Dana Lee",
      customization: {
        fax: "(555) 100-2001",
        address: { street: "1 Main St", unit: "", city: "Austin", state: "TX", zip: "78701" },
        accentColor: "#123456",
        fontFamily: "Inter",
        photoUrl: "https://cdn/me.jpg",
      },
    };
    expect(findManagedFieldViolations(body, brand)).toEqual([]);
  });

  it("flags a changed company name, website, and logo", () => {
    const out = findManagedFieldViolations(
      { company: "Dana's Side Hustle", website: "dana.me", logo_url: "https://cdn/other.png" },
      brand,
    );
    expect(out).toContain("company name");
    expect(out).toContain("website");
    expect(out).toContain("company logo");
  });

  it("flags a template change while the design lock is ON, allows it when OFF", () => {
    expect(findManagedFieldViolations({ template: "classic-pro" }, brand)).toContain("card design");
    expect(findManagedFieldViolations({ template: "classic-pro" }, { ...brand, lockTemplate: false })).toEqual([]);
  });

  it("flags changed locked design keys, allows them when unlocked", () => {
    const body = { customization: { accentColor: "#ff0000" } };
    expect(findManagedFieldViolations(body, brand)).toContain("card design");
    expect(findManagedFieldViolations(body, { ...brand, lockTemplate: false })).toEqual([]);
  });

  it("flags a changed fax and address", () => {
    const out = findManagedFieldViolations(
      { customization: { fax: "(555) 9", address: { street: "9 Elm", unit: "", city: "Austin", state: "TX", zip: "78701" } } },
      brand,
    );
    expect(out).toContain("fax number");
    expect(out).toContain("address");
  });

  it("never flags fields the office left blank (partial company info)", () => {
    const sparse: OfficeBrand = { ...brand, company: null, website: null, fax: null, address: null, design: null };
    const body = {
      company: "Whatever I want",
      website: "mine.com",
      customization: { fax: "123", address: { street: "9 Elm" }, accentColor: "#ff0000" },
    };
    // Only the logo and template remain managed in this sparse brand.
    expect(findManagedFieldViolations(body, sparse)).toEqual([]);
  });

  it("never flags personal fields", () => {
    const body = {
      name: "New Name",
      title: "VP of Sales",
      email: "dana@acme.com",
      phone: "(555) 777-8888",
      customization: { bio: "new bio", photoUrl: "https://cdn/new.jpg", links: [{ label: "x", url: "https://x" }] },
    };
    expect(findManagedFieldViolations(body, brand)).toEqual([]);
  });

  it("ignores fields the request doesn't send at all", () => {
    expect(findManagedFieldViolations({ name: "Just my name" }, brand)).toEqual([]);
  });
});
