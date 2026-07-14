import { describe, it, expect } from "vitest";
import { overlayOfficeDesign, extractDesign, OFFICE_DESIGN_KEYS } from "@/lib/office-brand";
import { cardIsOffline } from "@/lib/card-active";
import { roleHasCapability } from "@/lib/office-roles";

// The office owns the LOOK (template, colours, fonts) — every employee card is
// based on the admin's primary card. Employees own only their personal content.

const design = { accentColor: "#123456", font: "Inter", bgColor: "#ffffff" };

describe("overlayOfficeDesign — the office's look is forced onto member cards", () => {
  it("overwrites an employee's colours/fonts with the office's", () => {
    const cust = { accentColor: "#ff0000", font: "Comic Sans" };
    const out = overlayOfficeDesign(cust, { design, lockTemplate: true });
    expect(out.accentColor).toBe("#123456");
    expect(out.font).toBe("Inter");
  });

  it("never touches the employee's own content", () => {
    const cust = {
      accentColor: "#ff0000",
      photoUrl: "https://cdn/me.jpg",
      bio: "my bio",
      links: [{ label: "My blog", url: "https://blog" }],
      phones: [{ number: "555", label: "Mobile" }],
    };
    const out = overlayOfficeDesign(cust, { design, lockTemplate: true });
    expect(out.photoUrl).toBe("https://cdn/me.jpg"); // headshot is theirs
    expect(out.bio).toBe("my bio");
    expect(out.links).toEqual(cust.links);
    expect(out.phones).toEqual(cust.phones);
  });

  it("clears a design key the office does NOT define, so nothing off-brand survives", () => {
    const cust = { accentColor: "#ff0000", fontFamily: "Papyrus" };
    const out = overlayOfficeDesign(cust, { design: { accentColor: "#123456" }, lockTemplate: true });
    expect(out.accentColor).toBe("#123456");
    expect("fontFamily" in out).toBe(false);
  });

  it("is a no-op while the office leaves the look unlocked", () => {
    const cust = { accentColor: "#ff0000", font: "Comic Sans" };
    const out = overlayOfficeDesign(cust, { design, lockTemplate: false });
    expect(out).toEqual(cust); // employee keeps their own look
  });

  it("is a no-op when the office has no design set", () => {
    const cust = { accentColor: "#ff0000" };
    expect(overlayOfficeDesign(cust, { design: null, lockTemplate: true })).toEqual(cust);
  });

  it("handles a card with no customization at all", () => {
    expect(overlayOfficeDesign(null, { design, lockTemplate: true })).toMatchObject(design);
  });

  it("does not mutate the input", () => {
    const cust = { accentColor: "#ff0000" };
    overlayOfficeDesign(cust, { design, lockTemplate: true });
    expect(cust.accentColor).toBe("#ff0000");
  });
});

describe("extractDesign — the office look is derived from the primary card", () => {
  it("pulls only the design keys off the card", () => {
    const out = extractDesign({ accentColor: "#123456", font: "Inter", bio: "x", photoUrl: "y" });
    expect(out).toEqual({ accentColor: "#123456", font: "Inter" });
  });

  it("returns null when the card defines no design", () => {
    expect(extractDesign({ bio: "x" })).toBeNull();
    expect(extractDesign(null)).toBeNull();
  });

  it("ignores empty values so a blank field doesn't lock everyone to nothing", () => {
    expect(extractDesign({ accentColor: "", font: null })).toBeNull();
  });

  it("round-trips: what's extracted from the primary card is what gets forced", () => {
    const primary = { accentColor: "#abcdef", fontFamily: "Georgia", bio: "admin bio" };
    const extracted = extractDesign(primary)!;
    const employee = overlayOfficeDesign({ accentColor: "#000000", bio: "employee bio" }, { design: extracted, lockTemplate: true });
    expect(employee.accentColor).toBe("#abcdef");
    expect(employee.fontFamily).toBe("Georgia");
    expect(employee.bio).toBe("employee bio"); // their own content survives
  });

  it("covers exactly the colour/font keys — a new design key must be added deliberately", () => {
    expect([...OFFICE_DESIGN_KEYS]).toEqual(["accentColor", "font", "bgColor", "textColor", "infoColor", "fontFamily"]);
  });
});

describe("cardIsOffline — the admin's take-offline kill-switch", () => {
  it("is true only when explicitly offline", () => {
    expect(cardIsOffline({ is_offline: true })).toBe(true);
    expect(cardIsOffline({ is_offline: false })).toBe(false);
  });

  it("treats a pre-migration row (no column) as live, never dark", () => {
    expect(cardIsOffline({ id: "x" })).toBe(false);
    expect(cardIsOffline(null)).toBe(false);
  });
});

describe("manage_member_cards capability", () => {
  it("is held by the owner and admin", () => {
    expect(roleHasCapability("owner", "manage_member_cards")).toBe(true);
    expect(roleHasCapability("admin", "manage_member_cards")).toBe(true);
  });

  it("is NOT held by manager, billing_admin or employee", () => {
    expect(roleHasCapability("manager", "manage_member_cards")).toBe(false);
    expect(roleHasCapability("billing_admin", "manage_member_cards")).toBe(false);
    expect(roleHasCapability("employee", "manage_member_cards")).toBe(false);
  });
});
