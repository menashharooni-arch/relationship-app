import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ProTrialPrice from "@/components/ProTrialPrice";
import { TRIAL_DAYS } from "@/lib/plan";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// The Pro card's price block IS the trial offer since 2026-08-19 (owner
// approved after a mockup round): "Free for your first 14 days, then $X /
// month · cancel anytime". Big plain white "Free" — deliberately NOT a green
// badge or a strikethrough ("I don't want this to look like a scam") — with
// the real price stated plainly right under it.
//
// What's pinned here is the thing that decays: the block reaching ALL THREE
// plan surfaces identically, staying honest (real price always adjacent),
// and never being shown to someone who won't actually get a trial.

const PLAN_SURFACES = [
  "src/app/pricing/page.tsx", // public pricing
  "src/components/PlanCards.tsx", // account creation: card wizard + /welcome
  "src/app/upgrade/UpgradeClient.tsx", // in-product Free → Pro
];

describe("every plan surface prices Pro with the Free-first block", () => {
  for (const f of PLAN_SURFACES) {
    const src = read(f);
    it(`${f} renders ProTrialPrice`, () => {
      expect(src).toMatch(/import ProTrialPrice from "@\/components\/ProTrialPrice"/);
      expect(src).toMatch(/<ProTrialPrice/);
    });
    it(`${f} passes the REAL price into the block ("then …")`, () => {
      // The honesty half of the design: "Free" may never appear without the
      // actual price beside it. Every usage must supply `then`.
      expect(src).toMatch(/<ProTrialPrice[\s\S]{0,200}?then=/);
    });
  }
});

describe("the price block itself", () => {
  const out = renderToStaticMarkup(h(ProTrialPrice, { then: "$4.99 / month" }));

  it("reads as one honest sentence", () => {
    expect(out).toContain("Free");
    expect(out).toContain(`for your first ${TRIAL_DAYS} days`);
    expect(out).toContain("then $4.99 / month");
    expect(out).toContain("cancel anytime");
  });

  it("no green badge, no strikethrough — the owner's no-scam rule", () => {
    const src = read("src/components/ProTrialPrice.tsx").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/emerald|green-\d/);
    expect(src).not.toMatch(/line-through/);
  });

  it("reads the day count from TRIAL_DAYS, never a hardcoded 14", () => {
    // Comments stripped: the file's own docs quote the approved copy ("14
    // days") by name; what must never hardcode the count is the MARKUP.
    const src = read("src/components/ProTrialPrice.tsx").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/14 days|14-day/);
    expect(src).toMatch(/TRIAL_DAYS/);
  });

  it("is static text — it never becomes its own competing CTA", () => {
    expect(out).not.toMatch(/<a[\s>]/i);
    expect(out).not.toMatch(/<button/i);
  });
});

describe("the offer is never shown to someone who won't get it", () => {
  it("/upgrade gates the block on trialEligible", () => {
    const src = read("src/app/upgrade/UpgradeClient.tsx");
    const block = src.indexOf("<ProTrialPrice");
    // An ex-subscriber is billed immediately (their href carries trial=0), so
    // showing them "Free for your first 14 days" is a promise checkout breaks.
    expect(block).toBeGreaterThan(-1);
    expect(src.slice(0, block)).toMatch(/\{trialEligible \? \($/m);
  });

  it("the public surfaces keep the new-customers qualifier in the fine print", () => {
    // Checkout grants a trial only to customers with no prior Stripe
    // subscription. The headline can be short; the condition cannot vanish.
    for (const f of ["src/app/pricing/page.tsx", "src/components/PlanCards.tsx"]) {
      expect(read(f)).toMatch(/days free for new customers/);
    }
  });

  it("PlanCards still returns the free-only branch before any Pro card on native", () => {
    // App Review 3.1.1: the iOS shell must not render a selling surface, and
    // "Free for your first 14 days, then $4.99" is selling.
    const src = read("src/components/PlanCards.tsx");
    expect(src.indexOf("if (native) {")).toBeLessThan(src.indexOf("<ProTrialPrice"));
  });
});
