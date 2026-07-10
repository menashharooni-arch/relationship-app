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
});
