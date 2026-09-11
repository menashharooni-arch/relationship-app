import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { proFeaturesInUse, describeFreeDesignChanges } from "@/lib/plan";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// A Free account can try every Pro finish and the photo/video picker in the
// editor — that is the demo, and it stays open. What changed is that Save no
// longer succeeds quietly while the server strips the Pro keys, leaving a flat
// card on the live link with nothing having said why.

describe("what counts as Pro design", () => {
  it("a plain free card is not blocked", () => {
    expect(proFeaturesInUse({ finish: "flat" }, "classic-pro")).toEqual([]);
    expect(proFeaturesInUse({}, "classic-pro")).toEqual([]);
  });

  it.each([
    ["brushed", "Brushed"],
    ["carbon", "Carbon"],
    ["linen", "Linen"],
    ["gilt", "Gilt edge"],
    ["frosted", "Frosted"],
  ])("names the %s finish", (finish, label) => {
    const out = proFeaturesInUse({ finish }, "classic-pro");
    expect(out.join(" | ")).toContain(`${label} finish`);
  });

  it("names a background photo and a background video separately", () => {
    expect(proFeaturesInUse({ panelMedia: "u", panelMediaType: "image" }, "classic-pro")).toContain("Background photo");
    expect(proFeaturesInUse({ panelMedia: "u", panelMediaType: "video" }, "classic-pro")).toContain("Background video");
  });

  it("names a custom design", () => {
    expect(proFeaturesInUse({ finish: "brushed" }, "custom")).toContain("Your own custom design");
  });

  it("lists several at once, in one dialog", () => {
    const out = proFeaturesInUse({ finish: "carbon", panelMedia: "u", panelMediaType: "video" }, "classic-pro");
    expect(out).toContain("Carbon finish");
    expect(out).toContain("Background video");
  });

  // The dialog and the server's sanitizer must never disagree about WHETHER a
  // card is using Pro design — one blocking a save the other would have let
  // through (or the reverse) is the worst possible outcome here.
  it("agrees with the existing describer on every case", () => {
    const cases: Record<string, unknown>[] = [
      {}, { finish: "flat" }, { finish: "brushed" }, { finish: "gilt" },
      { panelMedia: "u", panelMediaType: "image" }, { panelMedia: "u", panelMediaType: "video" },
      { bgColor: "#123456" }, { finish: "carbon", bgColor: "#abcdef" },
    ];
    for (const t of ["classic-pro", "custom", undefined]) {
      for (const c of cases) {
        expect({ t, c, blocked: proFeaturesInUse(c, t).length > 0 }).toMatchObject({
          blocked: describeFreeDesignChanges(c, t).length > 0,
        });
      }
    }
  });

  it("never returns an empty list while the converter says the card changes", () => {
    // An empty list would block the save behind a dialog explaining nothing.
    const out = proFeaturesInUse({ finish: "brushed" }, "classic-pro");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("the save is actually gated", () => {
  const FORM = read("src/app/cards/[id]/edit/CardEditForm.tsx");

  it("Save checks the plan before it PATCHes", () => {
    expect(FORM).toContain("proFeaturesInUse");
    expect(FORM).toMatch(/if \(!isPro && !opts\?\.allowFreeConversion\)/);
    // The block must happen BEFORE the network call, not after.
    expect(FORM.indexOf("setProBlock(proFeatures)")).toBeLessThan(FORM.indexOf("method: \"PATCH\""));
  });

  it("Pro accounts are never interrupted", () => {
    expect(FORM).toMatch(/!isPro &&/);
  });

  it("the escape hatch re-enters the same save, it does not duplicate it", () => {
    expect(FORM).toContain("handleSave({ allowFreeConversion: true })");
  });

  // A click event is not an options object; binding handleSave directly would
  // have passed a MouseEvent as `opts` and silently skipped the gate.
  it("the Save button does not hand the DOM event to the gate", () => {
    expect(FORM).toContain("onClick={() => handleSave()}");
    expect(FORM).not.toMatch(/onClick=\{handleSave\}/);
  });
});

describe("the offer is one implementation, shared by both platforms", () => {
  const DLG2 = read("src/components/ProRequiredDialog.tsx");

  // The owner's report was that the popup on the phone was not the popup on the
  // computer. It is now: this dialog renders ProOffer, and so does the Add card
  // sheet, so neither can drift from the other or from itself across platforms.
  // Parity and the two App Store rules (no hardcoded price in the shell, no web
  // purchase link in the shell) are measured on RENDERED OUTPUT in
  // tests/render/pro-offer-parity.test.ts — a stronger check than the copy
  // strings this file used to scan for.
  it("renders the shared offer rather than its own", () => {
    expect(DLG2).toContain("ProOfferBlock");
    expect(DLG2).toContain("ProOfferCta");
  });

  it("decides nothing about the platform itself", () => {
    // Every platform branch lives in ProOffer now. A `native` check creeping
    // back in here is how the two sheets diverged in the first place.
    expect(DLG2).not.toContain("useIsNativeApp");
    expect(DLG2).not.toMatch(/\{!native && \(/);
  });

  it("hardcodes no price and no checkout link of its own", () => {
    // Comments stripped: the file legitimately EXPLAINS the pricing history,
    // and matching prose about a price as if it were a rendered price is how a
    // guard cries wolf.
    const src = DLG2.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/\$\{?\d/);
    expect(src).not.toContain("PLAN_PRICES");
    expect(src).not.toContain("/checkout");
    expect(src).not.toContain("/upgrade");
  });
});
