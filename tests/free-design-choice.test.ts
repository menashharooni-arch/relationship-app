import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeFreeDesignChanges, convertCustomizationToFreeClosest } from "@/lib/plan";
import { META } from "@/lib/template-style-presets";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("describeFreeDesignChanges names what actually changes", () => {
  it("says nothing at all when nothing changes", () => {
    // The whole moment is built on this: a Free Look, a font, a preset swatch
    // must never raise a panel telling someone their design is about to be
    // replaced. Checked across every curated Look on every template.
    for (const [id, meta] of Object.entries(META)) {
      for (const look of meta.looks) {
        if (look.finish && look.finish !== "sheen" && look.finish !== "halo") continue;
        const cust: Record<string, unknown> = { bgColor: look.bg, textColor: look.text };
        if (look.font) cust.fontFamily = look.font;
        if (look.finish) cust.finish = look.finish;
        if (meta.surface && look.surface) cust.surfaceColor = look.surface;
        expect(describeFreeDesignChanges(cust, id), `${id} / ${look.name}`).toEqual([]);
      }
    }
  });

  it("names the finish by the name shown on the picker", () => {
    const lines = describeFreeDesignChanges({ finish: "brushed" }, "classic-pro");
    expect(lines).toContain("Your Brushed finish becomes Flat");
  });

  it("tells a photo from a video", () => {
    expect(describeFreeDesignChanges({ panelMedia: "https://x/y.jpg", panelMediaType: "image" }, "classic-pro"))
      .toContain("Your background photo is removed");
    expect(describeFreeDesignChanges({ panelMedia: "https://x/y.mp4", panelMediaType: "video" }, "classic-pro"))
      .toContain("Your background video is removed");
  });

  it("collapses several colour swaps into one line", () => {
    const lines = describeFreeDesignChanges(
      { bgColor: "#123456", textColor: "#654321", accentColor: "#abcdef" },
      "classic-pro",
    );
    expect(lines.filter((l) => l.toLowerCase().includes("color"))).toHaveLength(1);
    expect(lines).toContain("Your colors move to the closest free ones");
  });

  it("uses the singular when exactly one colour moves", () => {
    const meta = META["classic-pro"];
    // Every colour but one already free-safe, so only bgColor can move.
    const lines = describeFreeDesignChanges({ bgColor: "#123456", textColor: meta.text.presets[0] }, "classic-pro");
    expect(lines).toContain("One of your colors moves to the closest free one");
  });

  it("calls out the custom designer", () => {
    expect(describeFreeDesignChanges({ customLayout: { blocks: [] } }, "custom"))
      .toContain("Your custom design becomes the Classic Pro template");
  });

  it("never returns an empty list while the converter says something changed", () => {
    // A design key added later with no line of its own would otherwise raise a
    // panel headed "Your card uses Pro design" above nothing at all.
    const cases: Record<string, unknown>[] = [
      { finish: "gilt" },
      { panelDim: 0.5 },
      { font: "legacy-font" },
      { panelMedia: "https://x/y.jpg" },
      { bgColor: "#010203" },
    ];
    for (const c of cases) {
      const { changed } = convertCustomizationToFreeClosest(c, "classic-pro");
      const lines = describeFreeDesignChanges(c, "classic-pro");
      expect(lines.length > 0, `${JSON.stringify(c)} changed=${changed} but produced no lines`).toBe(changed);
    }
  });

  it("does not describe changes to the card's CONTENT", () => {
    const lines = describeFreeDesignChanges(
      { about: "hi", address: "1 Main St", links: [{ label: "a" }], finish: "carbon" },
      "classic-pro",
    );
    expect(lines).toEqual(["Your Carbon finish becomes Flat"]);
  });
});

describe("the wizard decides before it converts", () => {
  const src = read("src/app/cards/new/NewCardWizard.tsx");

  it("asks without touching the card", () => {
    // The bug this replaces: applyFreeDesignConversion() ran the moment Free
    // was clicked, so the card was already rewritten behind a panel that was
    // still asking. "Keep it exactly like this" is only a real offer if
    // nothing has been changed yet.
    const fn = src.slice(src.indexOf("function handleAuthedFirstCardFree"), src.indexOf("function confirmFreeDesignAndCreate"));
    expect(fn).toContain("freeDesignChanges()");
    expect(fn, "the conversion still runs before the question is answered").not.toContain("applyFreeDesignConversion");
  });

  it("converts only once Free is confirmed", () => {
    const fn = src.slice(src.indexOf("function confirmFreeDesignAndCreate"), src.indexOf("function keepDesignWithTrial"));
    expect(fn).toContain("applyFreeDesignConversion()");
  });

  it("asks a GUEST too, before the plan intent is written", () => {
    // A guest used to see nothing here and meet the news on /welcome, after
    // the account existed and the card had already been flattened.
    const fn = src.slice(src.indexOf("function handleGuestFree"), src.indexOf("function confirmGuestFree"));
    expect(fn).toContain("freeDesignChanges()");
    expect(fn).toContain("setPendingFreeConfirm(true)");
    expect(src).toContain("onFree={guest ? handleGuestFree : handleAuthedFirstCardFree}");
  });

  it("keeps the design by taking the SAME route a Pro pick takes", () => {
    // A guest's Pro intent is what makes the draft claim treat them as paid
    // and keep the design. A bespoke path here would silently stop matching
    // however Pro is sold next.
    const fn = src.slice(src.indexOf("function keepDesignWithTrial"), src.indexOf("function handleGuestFree"));
    expect(fn).toContain('pickPlanThenSignUp({ plan: "pro"');
    expect(fn).toContain('handleAuthedFirstCardPaid("pro"');
  });
});

describe("the plan step never offers two different things under one label", () => {
  it("the Free button does not wear the Pro trial's words", () => {
    // The Pro card's button reads "Start free →" — it starts the free TRIAL,
    // which takes a card and renews. The wizard passed the same string as the
    // Free plan's label, so this one screen had two identical buttons: one
    // genuinely free, one a paid subscription. Nothing on either told them
    // apart.
    const wizard = read("src/app/cards/new/NewCardWizard.tsx");
    const label = /freeLabel="([^"]+)"/.exec(wizard)?.[1];
    expect(label, "the wizard stopped setting a free label").toBeTruthy();
    const proLabel = /busy === "pro" \? "Loading…" : "([^"]+)"/.exec(read("src/components/PlanCards.tsx"))?.[1];
    expect(proLabel, "PlanCards' Pro button label moved").toBeTruthy();
    expect(label).not.toBe(proLabel);
  });
});

describe("the panel itself", () => {
  const src = read("src/components/FreeDesignChoice.tsx");

  it("offers a real way out, not just a way forward", () => {
    expect(src).toContain("Continue with Free");
    expect(src).toContain("onContinueFree");
  });

  it("discloses the trial's billing terms wherever it offers the trial", () => {
    expect(src).toMatch(/card required/);
    expect(src).toMatch(/renews automatically/);
    expect(src).toMatch(/cancel anytime/);
  });

  it("reads the trial length from PLAN config, never typed in", () => {
    expect(src).toContain("TRIAL_DAYS");
    expect(src, "a hardcoded day count will drift from plan.ts").not.toMatch(/\b14[- ]day/i);
  });

  it("says the content is safe on both paths", () => {
    expect(src).toMatch(/Everything you typed is saved/);
    expect(src).toMatch(/You keep your card, your link, your QR code/);
  });
});
