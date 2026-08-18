import { describe, it, expect } from "vitest";
import {
  SWIFTLINK_LOOKS, FREE_SWIFTLINK_LOOKS, DEFAULT_SWIFTLINK_LOOK,
  getLook, isFreeLook, freeSafeLook,
} from "@/lib/swiftlink-looks";

// ── WCAG relative luminance / contrast ──────────────────────────────────────
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("every Look is readable (WCAG AA)", () => {
  it.each(SWIFTLINK_LOOKS)("$id: text on sheet ≥ 4.5:1", (l) => {
    expect(contrast(l.text, l.sheet), `${l.id} text/sheet = ${contrast(l.text, l.sheet).toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(SWIFTLINK_LOOKS)("$id: accentText on accent ≥ 4.5:1 (the Connect button)", (l) => {
    expect(contrast(l.accentText, l.accent), `${l.id} = ${contrast(l.accentText, l.accent).toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(SWIFTLINK_LOOKS)("$id: mode matches the sheet it claims", (l) => {
    // A "light" look must actually have a light sheet and vice versa — the
    // mode drives neutral chrome (rings, hovers), and a lie here makes those
    // invisible.
    expect(lum(l.sheet) > 0.5, `${l.id} sheet luminance ${lum(l.sheet).toFixed(2)}`).toBe(l.mode === "light");
  });
  it("all hex values are well-formed", () => {
    for (const l of SWIFTLINK_LOOKS) {
      for (const v of [l.sheet, l.page, l.text, l.accent, l.accentText, l.tile]) {
        expect(v).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });
  it("ids are unique", () => {
    const ids = SWIFTLINK_LOOKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the plan line", () => {
  it("the default look is light and free", () => {
    // Owner decision 2026-08-18: default is light. And a default a Free page
    // cannot render would be a contradiction in terms.
    const d = getLook(DEFAULT_SWIFTLINK_LOOK);
    expect(d.mode).toBe("light");
    expect(isFreeLook(d.id)).toBe(true);
  });
  it("Onyx preserves the pre-Looks stock page byte-for-byte", () => {
    // Existing pages must not change appearance except by the deliberate
    // default flip. These are SwiftLinkProfile's old SHEET / PAGE constants.
    const onyx = getLook("onyx");
    expect(onyx.sheet.toUpperCase()).toBe("#191A1A");
    expect(onyx.page.toUpperCase()).toBe("#09090B");
    expect(onyx.text).toBe("#FFFFFF");
    expect(isFreeLook("onyx")).toBe(true);
  });
  it("exactly the advertised number of free looks", () => {
    expect(FREE_SWIFTLINK_LOOKS).toHaveLength(2);
    for (const id of FREE_SWIFTLINK_LOOKS) expect(SWIFTLINK_LOOKS.some((l) => l.id === id)).toBe(true);
  });
  it("freeSafeLook keeps free choices and snaps everything else to the default", () => {
    expect(freeSafeLook("onyx")).toBe("onyx");
    expect(freeSafeLook("paper")).toBe("paper");
    expect(freeSafeLook("orchid")).toBe(DEFAULT_SWIFTLINK_LOOK);
    expect(freeSafeLook(undefined)).toBe(DEFAULT_SWIFTLINK_LOOK);
    expect(freeSafeLook("nonsense")).toBe(DEFAULT_SWIFTLINK_LOOK);
  });
  it("getLook never returns undefined", () => {
    expect(getLook("garbage").id).toBe(DEFAULT_SWIFTLINK_LOOK);
    expect(getLook(null).id).toBe(DEFAULT_SWIFTLINK_LOOK);
  });
});

// ── Social icon shape & fill ─────────────────────────────────────────────────
// The icon customization keys are Pro styling: they must be stripped for free
// accounts exactly like the other link-style keys, and unknown stored values
// must normalize to safe defaults so an old or hand-edited row can't break the
// public page.
import { normalizeIconShape, normalizeIconFill, DEFAULT_ICON_SHAPE, DEFAULT_ICON_FILL, ICON_SHAPES, ICON_FILLS } from "../src/lib/swiftlink-looks";
import { LINK_STYLE_KEYS } from "../src/lib/plan";

describe("social icon shape & fill", () => {
  it("normalizes unknown shapes and fills to the defaults", () => {
    expect(normalizeIconShape("squircle")).toBe("squircle");
    expect(normalizeIconShape("square")).toBe("square");
    expect(normalizeIconShape("circle")).toBe("circle");
    expect(normalizeIconShape("hexagon")).toBe(DEFAULT_ICON_SHAPE);
    expect(normalizeIconShape(undefined)).toBe(DEFAULT_ICON_SHAPE);
    expect(normalizeIconShape(null)).toBe(DEFAULT_ICON_SHAPE);
    expect(normalizeIconFill("accent")).toBe("accent");
    expect(normalizeIconFill("mono")).toBe("mono");
    expect(normalizeIconFill("brand")).toBe("brand");
    expect(normalizeIconFill("rainbow")).toBe(DEFAULT_ICON_FILL);
    expect(normalizeIconFill(undefined)).toBe(DEFAULT_ICON_FILL);
  });
  it("every advertised option normalizes to itself", () => {
    for (const s of ICON_SHAPES) expect(normalizeIconShape(s.id)).toBe(s.id);
    for (const f of ICON_FILLS) expect(normalizeIconFill(f.id)).toBe(f.id);
  });
  it("icon keys are plan-gated like the rest of the link styling", () => {
    expect(LINK_STYLE_KEYS).toContain("linkIconShape");
    expect(LINK_STYLE_KEYS).toContain("linkIconFill");
  });
});

// Picking a Look must clear the fine-tune background/text overrides — they win
// over the Look at render time, so a stale custom color would make every Look
// in the picker appear broken. Pinned at source level (the panel is a client
// component; the invariant is the shape of the patch it emits).
import { readFileSync } from "node:fs";
describe("Look press resets fine-tune overrides", () => {
  it("LookPicker's onPick clears linkBgColor and linkTextColor", () => {
    const src = readFileSync("src/components/SwiftLinkDesign.tsx", "utf8");
    expect(src).toMatch(/onPick=\{\(v\) => onChange\(\{ linkLook: v, linkBgColor: undefined, linkTextColor: undefined \}\)\}/);
  });
});
