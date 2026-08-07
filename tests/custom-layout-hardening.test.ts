import { describe, it, expect } from "vitest";
import { normalizeCustomLayout, buildPreset, DEFAULT_PRESET } from "@/lib/custom-layout";
import type { CustomLayout } from "@/components/card-templates/types";

// `customLayout` is a JSON blob the card's owner PATCHes, and the renderer
// spreads its colours straight into a style object. normalizeCustomLayout is the
// single gate both renderers pass through, so these are the guarantees it owes
// them: nothing that ends a declaration, starts a comment or fetches, and no
// element shape that throws on render.

const CLEAN = buildPreset(DEFAULT_PRESET);

describe("style sinks reject injected CSS", () => {
  const hostile = [
    "#111111;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647",
    "url('https://attacker.tld/beacon.png')",
    "#fff}.sc-card{display:none",
    "expression(alert(1))",
    "red;background-image:url(//evil.tld/x)",
    "#fff/*x*/;color:red",
    "@import url(//evil.tld/x.css)",
    "<script>alert(1)</script>",
    "#fff\\3b position:fixed",
  ];

  for (const value of hostile) {
    it(`drops ${JSON.stringify(value.slice(0, 34))} from every colour field`, () => {
      const out = normalizeCustomLayout({
        ...CLEAN,
        background: value,
        textColor: value,
        accentColor: value,
        panelBackground: value,
        panelTextColor: value,
        fontFamily: value,
      });
      for (const v of [out.background, out.textColor, out.accentColor, out.panelBackground, out.panelTextColor, out.fontFamily]) {
        if (v === undefined) continue;
        expect(v).not.toContain(";");
        expect(v).not.toMatch(/url\s*\(/i);
        expect(v).not.toContain(":");
        expect(v).not.toMatch(/[{}<>\\]/);
      }
      expect(out.background).toBe(CLEAN.background);
      expect(out.fontFamily).toBe(CLEAN.fontFamily);
    });
  }

  it("sanitises per-block and per-element colours too", () => {
    const evil = "#fff;position:fixed;width:100vw";
    const blocks = normalizeCustomLayout({
      ...CLEAN,
      blocks: [{ id: "name", type: "field", field: "name", on: true, zone: "right", emphasis: "hero", color: evil }],
    } as unknown as CustomLayout);
    expect(blocks.blocks?.[0].color).toBeUndefined();

    const legacy = normalizeCustomLayout({
      background: "#111111",
      elements: [{ id: "a", type: "text", text: "hi", x: 5, y: 5, color: evil }],
    });
    expect(legacy.elements?.[0].color).toBeUndefined();
  });

  it("keeps the legitimate values the presets actually use", () => {
    const out = normalizeCustomLayout({
      ...CLEAN,
      background: "#f4f2ed",
      panelBackground: "linear-gradient(200deg, #1d4ed8 0%, #3b82f6 100%)",
      textColor: "rgba(20, 49, 42, 0.9)",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    });
    expect(out.background).toBe("#f4f2ed");
    expect(out.panelBackground).toBe("linear-gradient(200deg, #1d4ed8 0%, #3b82f6 100%)");
    expect(out.textColor).toBe("rgba(20, 49, 42, 0.9)");
    expect(out.fontFamily).toBe("var(--font-geist-sans), system-ui, sans-serif");
  });

  it("every shipped preset survives its own gate unchanged", () => {
    for (const key of ["ink", "signal", "marquee", "atelier", "noir", "meridian", "broadsheet", "ember"]) {
      const p = buildPreset(key);
      const out = normalizeCustomLayout(p);
      expect(out.background).toBe(p.background);
      expect(out.textColor).toBe(p.textColor);
      expect(out.accentColor).toBe(p.accentColor);
      expect(out.panelBackground).toBe(p.panelBackground);
      expect(out.fontFamily).toBe(p.fontFamily);
    }
  });
});

describe("malformed elements can't crash the legacy renderer", () => {
  // `Array.isArray([null]) && length` passed the old guard, and the renderer
  // then read el.x off null — a 500 on the public card page.
  const junk = [[null], [undefined], [0], ["x"], [[]], [{}], [{ id: "a" }], [{ type: "text" }]];

  for (const elements of junk) {
    it(`falls back rather than rendering ${JSON.stringify(elements)}`, () => {
      const out = normalizeCustomLayout({ background: "#111111", elements });
      // Nothing malformed survives; either it's empty (blocks path) or every
      // entry is a well-formed element with numeric coordinates.
      for (const el of out.elements ?? []) {
        expect(typeof el.id).toBe("string");
        expect(Number.isFinite(el.x)).toBe(true);
        expect(Number.isFinite(el.y)).toBe(true);
      }
    });
  }

  it("keeps well-formed elements and repairs non-numeric coordinates", () => {
    const out = normalizeCustomLayout({
      background: "#111111",
      elements: [
        { id: "a", type: "text", text: "hi", x: 12, y: 34 },
        { id: "b", type: "text", text: "no", x: "nope", y: NaN },
        null,
      ],
    });
    expect(out.elements).toHaveLength(2);
    expect(out.elements?.[0]).toMatchObject({ id: "a", x: 12, y: 34 });
    expect(out.elements?.[1]).toMatchObject({ id: "b", x: 0, y: 0 });
  });
});
