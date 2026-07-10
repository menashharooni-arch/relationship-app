import { describe, it, expect } from "vitest";
import { sanitizeCustomizationForPlan, PRO_CUSTOMIZATION_KEYS } from "@/lib/plan";

// These cover the persistence contract for the new editable-template style keys
// (bgColor / textColor / fontFamily) alongside the existing accent/font gating,
// plus backward-compat with customization blobs saved before the feature.

describe("editable-template style keys are Pro-gated", () => {
  it("lists the new style keys as Pro-only", () => {
    for (const k of ["accentColor", "font", "bgColor", "textColor", "fontFamily"]) {
      expect(PRO_CUSTOMIZATION_KEYS).toContain(k);
    }
  });

  it("strips every style key for a Free account", () => {
    const input = {
      accentColor: "#ff0000",
      bgColor: "#101010",
      textColor: "#ffffff",
      fontFamily: "Georgia, serif",
      about: "hi",
      links: [{ label: "Site", url: "https://x.com" }],
    };
    const out = sanitizeCustomizationForPlan(input, false);
    expect(out).not.toHaveProperty("accentColor");
    expect(out).not.toHaveProperty("bgColor");
    expect(out).not.toHaveProperty("textColor");
    expect(out).not.toHaveProperty("fontFamily");
    // Free-baseline content is untouched.
    expect(out.about).toBe("hi");
    expect(out.links).toEqual([{ label: "Site", url: "https://x.com" }]);
  });

  it("keeps every style key for a paid account", () => {
    const input = { accentColor: "#ff0000", bgColor: "#101010", textColor: "#fff", fontFamily: "Mono" };
    expect(sanitizeCustomizationForPlan(input, true)).toEqual(input);
  });
});

describe("backward compatibility with cards saved before the feature", () => {
  it("an old blob with no style keys is preserved verbatim (paid)", () => {
    const legacy = {
      bio: "Realtor",
      phones: [{ number: "555", label: "mobile", showOnCard: true }],
      links: [{ label: "Reviews", url: "https://g.co" }],
      customLayout: { background: "#0e1b35", fontFamily: "sans", textColor: "#fff", elements: [] },
    };
    expect(sanitizeCustomizationForPlan(legacy, true)).toEqual(legacy);
  });

  it("an old blob still renders on Free (baseline content kept, no style keys to strip)", () => {
    const legacy = { bio: "Realtor", fax: "555-0000", about: "hi" };
    const out = sanitizeCustomizationForPlan(legacy, false);
    expect(out).toEqual(legacy);
  });

  it("does not mutate the input blob", () => {
    const input = { accentColor: "#ff0000", bgColor: "#101010", about: "hi" };
    sanitizeCustomizationForPlan(input, false);
    expect(input).toHaveProperty("accentColor");
    expect(input).toHaveProperty("bgColor");
  });
});
