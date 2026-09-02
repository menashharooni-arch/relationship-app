import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  HERO_STYLES, BUTTON_STYLES,
  normalizeHeroStyle, normalizeButtonStyle,
  DEFAULT_HERO_STYLE, DEFAULT_BUTTON_STYLE,
} from "@/lib/swiftlink-looks";
import { LINK_STYLE_KEYS } from "@/lib/plan";

const read = (p: string) => readFileSync(p, "utf8");

// ── Swift Links design expansion (owner order 2026-09-01) ────────────────────
// Linktree-informed additions: a "Page header" style (full cover photo vs a
// compact circle — the fix for "the top part is so large"), and "Link buttons"
// styles (rich tiles / solid rows / outlined rows, with a button color).
// Pins: defaults reproduce the pre-expansion page byte-for-byte, the header
// style is EVERY plan, the button styling is Pro, and both editors carry it
// through the shared SwiftLinkStyleControls.
describe("normalizers fail closed to today's rendering", () => {
  it("hero: only 'avatar' changes anything", () => {
    expect(DEFAULT_HERO_STYLE).toBe("cover");
    expect(normalizeHeroStyle(undefined)).toBe("cover");
    expect(normalizeHeroStyle(null)).toBe("cover");
    expect(normalizeHeroStyle("junk")).toBe("cover");
    expect(normalizeHeroStyle("avatar")).toBe("avatar");
    expect(HERO_STYLES.map((o) => o.id)).toEqual(["cover", "avatar"]);
  });

  it("buttons: only 'solid'/'outline' change anything", () => {
    expect(DEFAULT_BUTTON_STYLE).toBe("tile");
    expect(normalizeButtonStyle(undefined)).toBe("tile");
    expect(normalizeButtonStyle("junk")).toBe("tile");
    expect(normalizeButtonStyle("solid")).toBe("solid");
    expect(normalizeButtonStyle("outline")).toBe("outline");
    expect(BUTTON_STYLES.map((o) => o.id)).toEqual(["tile", "solid", "outline"]);
  });
});

describe("plan line", () => {
  it("button style + color are Pro (stripped for Free by LINK_STYLE_KEYS)", () => {
    expect(LINK_STYLE_KEYS).toContain("linkButtonStyle");
    expect(LINK_STYLE_KEYS).toContain("linkButtonColor");
  });

  it("the header style is EVERY plan — the sanitizer never touches it", () => {
    expect(LINK_STYLE_KEYS).not.toContain("linkHeroStyle");
    expect(read("src/lib/plan.ts")).not.toMatch(/["']linkHeroStyle["']/);
  });

  it("the public page gates matching the sanitizer: header outside the paid spread, buttons inside", () => {
    const src = read("src/app/links/[username]/page.tsx");
    expect(src).toMatch(/heroStyle: customization\.linkHeroStyle,\s*\n\s*\.\.\.\(ownerPaid/);
    expect(src).toMatch(/buttonStyle: customization\.linkButtonStyle/);
    expect(src).toMatch(/buttonColor: customization\.linkButtonColor/);
  });

  it("the live preview mirrors the same gating", () => {
    const src = read("src/components/SwiftLinkLivePreview.tsx");
    expect(src).toMatch(/heroStyle: style\?\.linkHeroStyle/);
    expect(src).toMatch(/\.\.\.\(paid \? \{[^}]*buttonStyle: style\?\.linkButtonStyle/);
  });
});

describe("rendering", () => {
  it("the profile has both header branches and normalizes the choice", () => {
    const src = read("src/components/SwiftLinkProfile.tsx");
    expect(src).toMatch(/normalizeHeroStyle\(pageStyle\?\.heroStyle\) === "avatar"/);
    expect(src).toMatch(/\{!heroAvatar && \(/); // cover hero survives, unchanged
    expect(src).toMatch(/\{heroAvatar && \(/); // compact circle
    // The avatar keeps the full identity fallback: photo → logo → initials.
    expect(src.split("heroAvatar && (")[1]).toMatch(/photoUrl \?[\s\S]*logoUrl \?[\s\S]*\{initials\}/);
  });

  it("buttons: solid/outline force rows; custom color derives its own text", () => {
    const src = read("src/components/SwiftLinkButtons.tsx");
    expect(src).toMatch(/buttonStyle === "solid" \|\| buttonStyle === "outline"/);
    expect(src).toMatch(/rowsOnly \|\| size === "compact"/);
    expect(src).toMatch(/buttonColor \? \(isLightHex\(buttonColor\) \? "#111827" : "#FFFFFF"\) : accentText/);
    // Outline/compact labels stay in the page's AA-tested text color.
    expect(src).toMatch(/variant === "solid" \? btnText : textColor/);
  });

  it("the stock compact row markup is intact (Free rendering unchanged)", () => {
    const src = read("src/components/SwiftLinkButtons.tsx");
    expect(src).toContain('ring-1 bg-white ring-black/[0.08] shadow-[0_2px_10px_rgba(15,23,42,0.06)]');
    expect(src).toContain('ring-1 bg-white/[0.07] ring-white/10');
  });
});

describe("both editors edit it", () => {
  it("the shared controls expose header + button styles", () => {
    const src = read("src/components/SwiftLinkDesign.tsx");
    expect(src).toContain("Page header");
    expect(src).toContain("Link buttons");
    // Header choice is never plan-disabled; button styles are.
    expect(src).toMatch(/HERO_STYLES\.map[\s\S]{0,600}onClick/);
    expect(src).toMatch(/BUTTON_STYLES\.map[\s\S]{0,300}disabled=\{locked\}/);
    // A Look pick clears the custom button color along with bg/text.
    expect(src).toMatch(/linkLook: v, linkBgColor: undefined, linkTextColor: undefined, linkButtonColor: undefined/);
  });

  it("the editor round-trips all three keys explicitly (null clears on the merge route)", () => {
    const src = read("src/app/cards/[id]/edit/CardEditForm.tsx");
    for (const k of ["linkHeroStyle", "linkButtonStyle", "linkButtonColor"]) {
      expect(src).toMatch(new RegExp(`${k}: card\\.customization\\?\\.${k} \\?\\? undefined`));
      expect(src).toMatch(new RegExp(`${k}: linkStyleState\\.${k} \\?\\? null`));
    }
  });

  it("the wizard persists via the linkStyleState spread", () => {
    expect(read("src/app/cards/new/NewCardWizard.tsx")).toMatch(/\.\.\.linkStyleState,/);
  });
});
