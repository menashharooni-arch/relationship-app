import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ProTrialCallout from "@/components/ProTrialCallout";
import { TRIAL_DAYS } from "@/lib/plan";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The trial is the strongest reason a Free user becomes a paying one, and it
// used to be stated only in the button label and an 11px line UNDER the button
// — both of which lose to the price. ProTrialCallout moves it directly beneath
// the price on every surface where plans are shown.
//
// What's pinned here is the thing that decays: the callout reaching ALL THREE
// plan surfaces. Each has its own hand-written Pro card, so it is entirely
// possible to restyle one and leave the others with the old quiet treatment —
// which is the exact state this change fixed.

const PLAN_SURFACES = [
  "src/app/pricing/page.tsx", // public pricing
  "src/components/PlanCards.tsx", // account creation: card wizard + /welcome
  "src/app/upgrade/UpgradeClient.tsx", // in-product Free → Pro
];

describe("every plan surface shows the trial where the price is", () => {
  for (const f of PLAN_SURFACES) {
    const src = read(f);

    it(`${f} renders ProTrialCallout`, () => {
      expect(src).toMatch(/import ProTrialCallout from "@\/components\/ProTrialCallout"/);
      expect(src).toMatch(/<ProTrialCallout/);
    });

    it(`${f} puts it ABOVE the CTA, not under it`, () => {
      // The whole point of the change: the offer has to be read on the way
      // DOWN to the button. Moving it back under the CTA is the old, invisible
      // treatment, and that is what this catches.
      const callout = src.indexOf("<ProTrialCallout");
      const cta = src.indexOf("free trial →");
      expect(callout).toBeGreaterThan(-1);
      expect(cta, "no Pro trial CTA found — re-check this test").toBeGreaterThan(-1);
      expect(callout, "callout must come before the Pro CTA").toBeLessThan(cta);
    });
  }
});

describe("the callout itself", () => {
  const out = renderToStaticMarkup(h(ProTrialCallout, {}));

  it("leads with the free days and answers what it costs today", () => {
    expect(out).toContain(`First ${TRIAL_DAYS} days free`);
    expect(out).toContain("Nothing to pay today");
    expect(out).toContain("cancel anytime");
  });

  it("does NOT reprint the price — it sits directly under a 2.4rem one", () => {
    // The old version printed "then $4.99/month" forty pixels below a 2.4rem
    // "$4.99 / month". Saying the number twice in one glance is what made the
    // offer read as fine print instead of an offer.
    expect(out).not.toMatch(/\$\d/);
  });

  it("uses the page's own savings colour and badge shape, at full strength", () => {
    // bolder: the surrounding card already says "saves you money" in emerald
    // (SAVE 10%) and states conviction in solid fills (the white CTA). The old
    // bg-white/[0.16] wash opted out of both and read as a disabled container.
    // Comments stripped: the file explains the old bg-white/16 wash by name,
    // and the point is that no such class survives in the MARKUP.
    const src = read("src/components/ProTrialCallout.tsx").replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/bg-emerald-400/);
    expect(src).toMatch(/rounded-full/);
    expect(src, "a translucent wash is what made it look disabled").not.toMatch(/bg-white\//);
    // Hugs its content: a full-width band reads as a row, not a stamp.
    expect(src).toMatch(/w-fit/);
  });

  it("reads the day count from TRIAL_DAYS, never a hardcoded 14", () => {
    // A second source of truth for the trial length is how copy goes stale the
    // day the offer changes.
    const src = read("src/components/ProTrialCallout.tsx");
    // Not a bare /\b14\b/ — the sparkle SVG's path data legitimately contains
    // "14.6". What must never appear is the day count written into the COPY.
    expect(src).not.toMatch(/14 days|14-day/);
    expect(src).toMatch(/TRIAL_DAYS/);
  });

  it("is static text — it never becomes its own competing CTA", () => {
    expect(out).not.toMatch(/<a[\s>]/i);
    expect(out).not.toMatch(/<button/i);
  });
});

describe("the offer is never shown to someone who won't get it", () => {
  it("/upgrade gates the callout on trialEligible", () => {
    const src = read("src/app/upgrade/UpgradeClient.tsx");
    const callout = src.indexOf("<ProTrialCallout");
    // The nearest preceding conditional must be the eligibility check — an
    // ex-subscriber is billed immediately (their href carries trial=0), so
    // showing them a trial is a promise checkout then breaks.
    expect(src.slice(0, callout)).toMatch(/\{trialEligible && \($/m);
  });

  it("the public surfaces keep the new-customers qualifier in the fine print", () => {
    // Checkout grants a trial only to customers with no prior Stripe
    // subscription. The headline can be short; the condition cannot vanish.
    // (copy-truth.test.ts pins this too — repeated here because the callout is
    // what made the headline short enough to be tempting to drop it.)
    for (const f of ["src/app/pricing/page.tsx", "src/components/PlanCards.tsx"]) {
      expect(read(f)).toMatch(/days free for new customers/);
    }
  });

  it("PlanCards still returns the free-only branch before any Pro card on native", () => {
    // App Review 3.1.1: the iOS shell must not render a selling surface, and
    // the callout is selling. The native early-return has to stay AHEAD of it.
    const src = read("src/components/PlanCards.tsx");
    expect(src.indexOf("if (native) {")).toBeLessThan(src.indexOf("<ProTrialCallout"));
  });
});
