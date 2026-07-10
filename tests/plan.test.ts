import { describe, it, expect } from "vitest";
import {
  PLAN_PRICES,
  PLAN_LIMITS,
  isPaidPlan,
  isOfficePlan,
  sanitizeCustomizationForPlan,
  PRO_CUSTOMIZATION_KEYS,
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

describe("sanitizeCustomizationForPlan", () => {
  it("strips Pro-only design keys for a free account", () => {
    const input = { accentColor: "#ff0000", font: "serif", about: "hi", links: [1, 2] };
    const out = sanitizeCustomizationForPlan(input, false);
    for (const k of PRO_CUSTOMIZATION_KEYS) expect(out).not.toHaveProperty(k);
    // Free-baseline keys survive.
    expect(out.about).toBe("hi");
    expect(out.links).toEqual([1, 2]);
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
