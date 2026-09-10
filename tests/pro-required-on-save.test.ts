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

describe("the iOS shell may not sell (App Store 3.1.1)", () => {
  const DLG = read("src/components/ProRequiredDialog.tsx");

  it("price, upgrade CTA and the link are all behind !native", () => {
    // Everything that sells sits inside a `{!native && (` block.
    for (const needle of ["PLAN_PRICES.PRO_MONTHLY_CENTS", 'href="/upgrade"', "Upgrade to Pro"]) {
      const at = DLG.indexOf(needle);
      expect({ needle, found: at > -1 }).toMatchObject({ found: true });
      const guard = DLG.lastIndexOf("{!native && (", at);
      const close = DLG.indexOf(")}", guard);
      expect({ needle, insideGuard: guard > -1 && close > at }).toMatchObject({ insideGuard: true });
    }
  });

  it("still explains itself on native, and still offers the way out", () => {
    expect(DLG).toContain("useIsNativeApp");
    // "Save without them" is outside every !native guard.
    const at = DLG.indexOf("Save without them");
    const guard = DLG.lastIndexOf("{!native && (", at);
    const close = guard > -1 ? DLG.indexOf(")}", guard) : -1;
    expect(close).toBeLessThan(at);
  });

  it("offers the upgrade, not another trial", () => {
    // The build wizard pitches the 14-day trial; the owner's call is that this
    // moment is a straight upgrade. Comments are stripped first — the file
    // legitimately EXPLAINS the difference, and matching prose that says "not
    // the trial" as if it were a trial pitch is how a guard cries wolf.
    const code = DLG.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/TRIAL_DAYS|free trial|14-day/i);
    expect(code).not.toContain("FreeDesignChoice");
  });
});
