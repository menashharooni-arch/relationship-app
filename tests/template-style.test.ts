import { describe, it, expect } from "vitest";
import { templateStyle, CARD_FONT_OPTIONS } from "@/lib/template-style";

describe("templateStyle normalization", () => {
  it("returns all-undefined for a card with no style keys (pre-existing cards)", () => {
    expect(templateStyle({ customization: {} })).toEqual({
      accentColor: undefined,
      bgColor: undefined,
      textColor: undefined,
      fontFamily: undefined,
    });
    expect(templateStyle({ customization: undefined })).toEqual({
      accentColor: undefined,
      bgColor: undefined,
      textColor: undefined,
      fontFamily: undefined,
    });
  });

  it("passes through real string overrides", () => {
    const s = templateStyle({
      customization: {
        accentColor: "#ff0000",
        bgColor: "#101010",
        textColor: "#ffffff",
        fontFamily: "Georgia, serif",
      },
    });
    expect(s).toEqual({
      accentColor: "#ff0000",
      bgColor: "#101010",
      textColor: "#ffffff",
      fontFamily: "Georgia, serif",
    });
  });

  it("treats empty/whitespace/null as 'use the template default'", () => {
    const s = templateStyle({
      customization: {
        accentColor: "",
        bgColor: "   ",
        // a cleared field may arrive as null through the DB round-trip
        textColor: null as unknown as string,
        fontFamily: undefined,
      },
    });
    expect(s.accentColor).toBeUndefined();
    expect(s.bgColor).toBeUndefined();
    expect(s.textColor).toBeUndefined();
    expect(s.fontFamily).toBeUndefined();
  });

  it("ignores unrelated customization keys (compat with old blobs)", () => {
    const s = templateStyle({
      customization: {
        about: "hi",
        links: [{ label: "x", url: "https://x.com" }],
        accentColor: "#123456",
      },
    });
    expect(s.accentColor).toBe("#123456");
    expect(s.bgColor).toBeUndefined();
  });
});

describe("CARD_FONT_OPTIONS", () => {
  it("offers a non-empty list of {label,value} font choices", () => {
    expect(CARD_FONT_OPTIONS.length).toBeGreaterThan(0);
    for (const f of CARD_FONT_OPTIONS) {
      expect(typeof f.label).toBe("string");
      expect(f.value.length).toBeGreaterThan(0);
    }
  });

  it("no option calls itself the default", () => {
    // Every consumer of this list PREPENDS its own "Default" pill meaning "no
    // override — inherit the page" (TemplateStyleControls' FontPills and
    // SwiftLinkDesign both do). The Sans entry used to be labelled
    // "Sans (default)", so the picker showed "Default" and "Sans (default)"
    // side by side, each claiming to be the default — and they aren't even the
    // same typeface: Default inherits Arial, this one resolves to Geist.
    for (const f of CARD_FONT_OPTIONS) {
      expect(f.label.toLowerCase(), `"${f.label}" competes with the Default pill`)
        .not.toContain("default");
    }
  });

  it("every option is a distinct label and a distinct typeface", () => {
    expect(new Set(CARD_FONT_OPTIONS.map((f) => f.label)).size).toBe(CARD_FONT_OPTIONS.length);
    expect(new Set(CARD_FONT_OPTIONS.map((f) => f.value)).size).toBe(CARD_FONT_OPTIONS.length);
  });
});

describe("both font pickers prepend their own Default", () => {
  // If a consumer stopped adding it, "Default" would vanish and there'd be no
  // way back to the template's own typeface — the reason the list itself must
  // not claim a default.
  it.each([
    "src/components/card-templates/TemplateStyleControls.tsx",
    "src/components/SwiftLinkDesign.tsx",
  ])("%s offers a Default pill alongside CARD_FONT_OPTIONS", async (file) => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/\{\s*label:\s*"Default",\s*value:\s*undefined[^}]*\}\s*,\s*\.\.\.CARD_FONT_OPTIONS/);
  });
});
