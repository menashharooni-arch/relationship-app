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

  // The platform rule is no longer hand-rolled here. The offer is a PlanGate,
  // which owns it for every locked surface in the app — so the assertion is
  // that this dialog USES the gate rather than deciding for itself, plus the
  // one piece it still gates by hand: the checkout link in the pinned footer.
  it("the offer goes through PlanGate, not a hand-rolled platform check", () => {
    expect(DLG).toContain('import { PlanGate }');
    expect(DLG).toMatch(/<PlanGate\s+feature="card-pro-design"/);
    expect(DLG).toContain("nativeCopy=");
  });

  it("the price sits inside the gate, which never renders it on native", () => {
    const open = DLG.indexOf("<PlanGate");
    const close = DLG.indexOf("</PlanGate>");
    const price = DLG.indexOf("PLAN_PRICES.PRO_MONTHLY_CENTS");
    expect({ open: open > -1, close: close > -1, price: price > -1 }).toMatchObject({ open: true, close: true, price: true });
    expect(price).toBeGreaterThan(open);
    expect(price).toBeLessThan(close);
  });

  it("the checkout link is still gated by hand, because it lives outside the gate", () => {
    // The CTA is pinned in the sheet's footer, not in the scrolling body the
    // PlanGate wraps, so it carries its own !native guard.
    const at = DLG.indexOf("/checkout?plan=pro");
    expect(at).toBeGreaterThan(-1);
    const guard = DLG.lastIndexOf("{!native && (", at);
    const close = DLG.indexOf(")}", guard);
    expect({ insideGuard: guard > -1 && close > at }).toMatchObject({ insideGuard: true });
  });

  it("never links the shell to the website's checkout", () => {
    // The gate's own tests forbid a link on native; this forbids the specific
    // one this dialog owns from ever escaping its guard.
    expect(DLG).not.toMatch(/href="\/upgrade"/);
  });

  it("still explains itself on native, and still offers the way out", () => {
    expect(DLG).toContain("useIsNativeApp");
    // "Save without them" is outside every !native guard.
    const at = DLG.indexOf("Save without them");
    const guard = DLG.lastIndexOf("{!native && (", at);
    const close = guard > -1 ? DLG.indexOf(")}", guard) : -1;
    expect(close).toBeLessThan(at);
  });

  // THE OFFER IS THE TRIAL (owner, 2026-09-11): 14 days free, then $4.99 — and
  // the button has to create the session that actually does that.
  it("offers the free trial to a first-time subscriber", () => {
    expect(DLG).toContain("TRIAL_DAYS");
    expect(DLG).toMatch(/trialEligible \? `Start my \$\{TRIAL_DAYS\} days free`/);
    expect(DLG).toMatch(/\{TRIAL_DAYS\} days free/);
  });

  // The promise and the Stripe session must not drift. An eligible user goes to
  // the plain checkout (which grants trial_period_days); an ex-subscriber
  // carries trial=0, exactly as /upgrade does, so the checkout page's copy
  // matches what it will charge.
  it("sends the eligible to a trial checkout and everyone else to trial=0", () => {
    expect(DLG).toMatch(/trialEligible\s*\?\s*"\/checkout\?plan=pro&interval=monthly"\s*:\s*"\/checkout\?plan=pro&interval=monthly&trial=0"/);
  });

  it("eligibility is decided on the server, never guessed in the browser", () => {
    const PAGE = read("src/app/cards/[id]/edit/page.tsx");
    expect(PAGE).toContain("isProTrialEligible");
    expect(PAGE).toContain("trialEligible={trialEligible}");
    // The dialog only ever receives it.
    expect(DLG).not.toContain("isProTrialEligible");
  });
});
