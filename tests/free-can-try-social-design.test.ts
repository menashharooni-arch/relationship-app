import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { proLinkFeaturesInUse, proFeaturesInUse, sanitizeCustomizationForPlan } from "@/lib/plan";

// ── Social design works exactly like Card design ─────────────────────────────
//
// Owner, 2026-09-11: "That exact same system that's there, I want to implement
// it in Social Design. I want users to be able to fully design their whole
// socials page and still keep the pro tags on everything that's pro. When they
// go to save changes, it will tell them."
//
// Card design already worked that way: every control live, PRO tags where the
// cost is, and Save Changes naming what was used. Social design was the
// opposite — the Look swatches, the colour pickers, the icon and button styles
// and the page background were all `disabled` on a Free account.
//
// Unlocking the panel is only half of it, and the dangerous half on its own:
// the server strips these keys when the page RENDERS, so without a save-time
// wall a Free user would design a page, save it, and watch it come back plain
// with nothing having said why. Both halves are pinned here.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the panel: nothing is dead on a Free account", () => {
  const design = code("src/components/SwiftLinkDesign.tsx");
  const buttons = code("src/components/LinkButtonsControls.tsx");

  it("no control is disabled by the plan", () => {
    for (const [name, src] of [["SwiftLinkDesign", design], ["LinkButtonsControls", buttons]] as const) {
      expect(src, `${name} still disables a control on Free`).not.toMatch(/disabled=\{locked\}/);
      expect(src, `${name} still disables a control on Free`).not.toMatch(/disabled=\{busy \|\| locked\}/);
      expect(src, `${name} still disables the custom colour input`).not.toMatch(/disabled=\{customLocked\}/);
      expect(src, `${name} still swallows taps on Free`).not.toMatch(/locked \? "opacity-50 pointer-events-none/);
    }
  });

  it("a Pro Look is tappable, like the card's Looks gallery", () => {
    // It used to carry `disabled={proLocked}` plus opacity-45.
    expect(design).not.toMatch(/disabled=\{proLocked\}/);
    expect(design).not.toMatch(/proLocked \? "opacity-45/);
  });

  it("keeps every PRO tag exactly where it was", () => {
    // The tags are the disclosure that replaces the disabled state, so they
    // have to survive the unlock — one per gated section, plus the Look family.
    for (const label of ["Page background", "Social icons", "Connect button", "Link buttons"]) {
      expect(design, `the ${label} section lost its PRO tag`)
        .toMatch(new RegExp(`${label}\\{locked && <span[^>]*><ProTag`));
    }
    expect(design).toMatch(/famLocked && <ProTag \/>/);
    expect(design).toMatch(/customLocked && <ProTag \/>/);
  });
});

describe("the wall: Save Changes names what they used", () => {
  it("names a Pro Look by its own name", () => {
    expect(proLinkFeaturesInUse({ linkLook: "glass-frost" })).toEqual([
      expect.stringMatching(/look for your Swift Links$/),
    ]);
  });

  it("stays silent for the two free Looks", () => {
    expect(proLinkFeaturesInUse({ linkLook: "paper" })).toEqual([]);
    expect(proLinkFeaturesInUse({ linkLook: "onyx" })).toEqual([]);
    expect(proLinkFeaturesInUse({})).toEqual([]);
  });

  it("names the page background photo and video separately", () => {
    expect(proLinkFeaturesInUse({ linkBgMedia: "https://x/y.jpg" })).toContain("Your Swift Links background photo");
    expect(proLinkFeaturesInUse({ linkBgMedia: "https://x/y.mp4", linkBgMediaType: "video" }))
      .toContain("Your Swift Links background video");
  });

  it("rolls the colours and the font into one line, however many moved", () => {
    const many = proLinkFeaturesInUse({ linkBgColor: "#123456", linkTextColor: "#ffffff", linkFontFamily: "Georgia, serif" });
    expect(many).toEqual(["Your own colors and font on Swift Links"]);
  });

  it("names the per-link styles too — a Free page renders every link plain", () => {
    // lib/swiftlink-tiles.ts: no tiles, no media, no section headers on Free.
    // Without this line someone styles six links and watches all six revert.
    expect(proLinkFeaturesInUse({}, [{ size: "featured" }])).toContain("How your links and social icons look");
    expect(proLinkFeaturesInUse({}, [{ media: { url: "https://x/y.jpg", type: "image" } }])).toHaveLength(1);
    expect(proLinkFeaturesInUse({}, [{ kind: "header" }])).toHaveLength(1);
    expect(proLinkFeaturesInUse({}, [{ size: "compact" }])).toEqual([]);
  });

  it("says nothing about the structural choices every plan keeps", () => {
    // The header layout and its content are every-plan (LINK_STRUCTURAL_KEYS) —
    // naming them would promise a loss that never happens.
    expect(proLinkFeaturesInUse({ linkHeroStyle: "cover", linkHeroContent: "logo" })).toEqual([]);
  });

  it("agrees with what the server would actually strip", () => {
    // The whole point: every key this names is a key the renderer removes, and
    // nothing it stays silent about is.
    const style = {
      linkLook: "glass-frost", linkBgColor: "#123456", linkFontFamily: "Georgia, serif",
      linkIconShape: "square", linkBgMedia: "https://x/y.jpg",
    };
    expect(proLinkFeaturesInUse(style).length).toBeGreaterThan(0);
    const free = sanitizeCustomizationForPlan(style, false, "classic-pro") as Record<string, unknown>;
    for (const k of ["linkBgColor", "linkFontFamily", "linkIconShape", "linkBgMedia"]) {
      expect(free[k], `${k} survived the Free sanitizer`).toBeUndefined();
    }
    expect(free.linkLook).not.toBe("glass-frost");
  });

  it("leaves a paid account completely alone", () => {
    const style = { linkLook: "glass-frost", linkBgColor: "#123456" };
    expect(sanitizeCustomizationForPlan(style, true, "classic-pro")).toEqual(style);
  });
});

describe("both halves reach the same dialog", () => {
  it("the edit screen lists card AND Swift Links features in one list", () => {
    const src = code("src/app/cards/[id]/edit/CardEditForm.tsx");
    expect(src).toMatch(/\.\.\.proFeaturesInUse\(\{ \.\.\.templateStyleState, \.\.\.linkStyleState, customLayout \}, template\),/);
    expect(src).toMatch(/\.\.\.proLinkFeaturesInUse\(linkStyleState[\s\S]{0,80}links\)/);
    // Same dialog as the card's, unchanged.
    expect(src).toMatch(/setProBlock\(proFeatures\)/);
    expect(src).toMatch(/<ProRequiredDialog/);
    expect(src).toMatch(/onSaveWithoutPro=\{\(\) => handleSave\(\{ allowFreeConversion: true \}\)\}/);
  });

  it("the card checker is untouched — it decides what every card renders as", () => {
    // proFeaturesInUse must not have learned about link keys: the converter
    // behind it also drives sanitizeCustomizationForPlan on every card page.
    expect(proFeaturesInUse({ linkLook: "glass-frost", linkBgColor: "#123456" }, "classic-pro")).toEqual([]);
  });

  it("the build wizard's Free/Pro choice lists them too", () => {
    const src = code("src/app/cards/new/NewCardWizard.tsx");
    expect(src).toMatch(/proLinkFeaturesInUse\(linkStyleState/);
    expect(src).toMatch(/is not included/);
  });
});
