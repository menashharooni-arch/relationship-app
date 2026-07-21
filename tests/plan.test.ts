import { describe, it, expect } from "vitest";
import {
  PLAN_PRICES,
  PLAN_LIMITS,
  isPaidPlan,
  isOfficePlan,
  sanitizeCustomizationForPlan,
} from "@/lib/plan";

describe("plan gating", () => {
  it("treats pro and enterprise as paid, everything else as free", () => {
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("enterprise")).toBe(true);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
    expect(isPaidPlan("PRO")).toBe(false); // case-sensitive on purpose
  });

  it("treats only enterprise as an Office plan", () => {
    expect(isOfficePlan("enterprise")).toBe(true);
    expect(isOfficePlan("pro")).toBe(false);
    expect(isOfficePlan("free")).toBe(false);
  });
});

describe("PLAN_PRICES sanity (guards against a silent pricing drift)", () => {
  it("annual pro is a real discount on 12 months, roughly 10% (rounded to $54)", () => {
    const monthlyYear = PLAN_PRICES.PRO_MONTHLY_CENTS * 12;
    expect(PLAN_PRICES.PRO_ANNUAL_CENTS).toBeLessThan(monthlyYear);
    const discount = 1 - PLAN_PRICES.PRO_ANNUAL_CENTS / monthlyYear;
    expect(discount).toBeGreaterThan(0.05);
    expect(discount).toBeLessThan(0.15);
  });

  it("annual office-per-seat is a 10% discount on 12 months, floored", () => {
    expect(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS).toBe(
      Math.floor(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS * 12 * 0.9)
    );
  });

  it("office per-seat is cheaper than pro (the '$1 cheaper per user' promise)", () => {
    expect(PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS).toBeLessThan(PLAN_PRICES.PRO_MONTHLY_CENTS);
  });

  it("office minimum is at least 2 seats", () => {
    expect(PLAN_LIMITS.OFFICE_MIN_SEATS).toBeGreaterThanOrEqual(2);
  });
});

// The Free numbers are quoted verbatim in plan-content.ts (which drives
// /pricing, /upgrade and the in-product plan cards), in the AI sales/help
// prompts, and in the admin plan matrix. Pin them here so changing a limit is
// a deliberate act that forces the copy to be revisited, rather than a silent
// drift between what we promise and what we enforce.
describe("PLAN_LIMITS — Free plan (keep in sync with plan-content.ts)", () => {
  it("Free gets 1 card", () => {
    expect(PLAN_LIMITS.FREE_CARD_LIMIT).toBe(1);
  });

  it("Free gets 2 additional Swift Links buttons", () => {
    expect(PLAN_LIMITS.FREE_MAX_LINKS).toBe(2);
  });

  it("Free gets 5 leads and 3 AI drafts a month", () => {
    expect(PLAN_LIMITS.FREE_LEADS_PER_MONTH).toBe(5);
    expect(PLAN_LIMITS.FREE_AI_DRAFTS_PER_MONTH).toBe(3);
  });

  it("has no free scan allowance — the card scanner is Pro-only", () => {
    expect(PLAN_LIMITS).not.toHaveProperty("FREE_SCANS_PER_MONTH");
  });
});

describe("sanitizeCustomizationForPlan", () => {
  it("snaps Pro-only colors to the nearest Free-safe preset (never deletes them outright) and caps Swift Links for a free account", () => {
    // Always start OVER the cap (whatever the cap currently is) so this proves
    // the trim rather than the input length. It previously hardcoded a 2-item
    // list against a cap of 1 and would silently stop testing the trim the
    // moment FREE_MAX_LINKS changed.
    const overCap = Array.from({ length: PLAN_LIMITS.FREE_MAX_LINKS + 2 }, (_, i) => i + 1);
    const input = { accentColor: "#ff0000", font: "serif", about: "hi", links: overCap };
    const out = sanitizeCustomizationForPlan(input, false);
    // `font` has no preset mapping and is dropped; `accentColor` is a real
    // design key that gets SNAPPED (still present) rather than deleted.
    expect(out).not.toHaveProperty("font");
    expect(out).toHaveProperty("accentColor");
    expect(typeof out.accentColor).toBe("string");
    // Free-baseline keys survive; Swift Links are trimmed to the Free cap.
    expect(out.about).toBe("hi");
    expect(out.links).toEqual(overCap.slice(0, PLAN_LIMITS.FREE_MAX_LINKS));
    expect(out.links).toHaveLength(PLAN_LIMITS.FREE_MAX_LINKS);
  });

  it("keeps a free account's links when it is exactly at the cap", () => {
    const atCap = Array.from({ length: PLAN_LIMITS.FREE_MAX_LINKS }, (_, i) => i + 1);
    const out = sanitizeCustomizationForPlan({ links: atCap }, false);
    expect(out.links).toEqual(atCap);
  });

  it("keeps all Swift Links for a paid account", () => {
    const out = sanitizeCustomizationForPlan({ links: [1, 2, 3] }, true);
    expect(out.links).toEqual([1, 2, 3]);
  });

  it("passes a paid account's customization through untouched", () => {
    const input = { accentColor: "#ff0000", font: "serif" };
    expect(sanitizeCustomizationForPlan(input, true)).toEqual(input);
  });

  it("never mutates the input object", () => {
    const input = { accentColor: "#ff0000", about: "hi" };
    sanitizeCustomizationForPlan(input, false);
    expect(input).toHaveProperty("accentColor"); // original still intact
  });

  it("handles null/undefined without throwing", () => {
    expect(sanitizeCustomizationForPlan(null, false)).toEqual({});
    expect(sanitizeCustomizationForPlan(undefined, true)).toEqual({});
  });
});
