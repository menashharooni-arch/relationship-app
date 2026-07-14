import { describe, it, expect } from "vitest";
import { planForPriceId, priceIdFor } from "@/lib/subscription";
import { PLAN_PRICES } from "@/lib/plan";

// A representative price table (mirrors what buildPrices() produces from env).
const PRICES = [
  { id: "price_pro_m", plan: "pro" as const, interval: "monthly" as const, cents: PLAN_PRICES.PRO_MONTHLY_CENTS },
  { id: "price_pro_y", plan: "pro" as const, interval: "annual" as const, cents: PLAN_PRICES.PRO_ANNUAL_CENTS },
  { id: "price_office_m", plan: "office" as const, interval: "monthly" as const, cents: PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS },
  { id: "price_office_y", plan: "office" as const, interval: "annual" as const, cents: PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS },
];

describe("planForPriceId — price → plan mapping", () => {
  it("maps every Pro and Office price to the right plan + interval", () => {
    expect(planForPriceId("price_pro_m", PRICES)).toEqual({ plan: "pro", interval: "monthly" });
    expect(planForPriceId("price_pro_y", PRICES)).toEqual({ plan: "pro", interval: "annual" });
    expect(planForPriceId("price_office_m", PRICES)).toEqual({ plan: "office", interval: "monthly" });
    // The regression: annual Office must NOT be misread as Pro.
    expect(planForPriceId("price_office_y", PRICES)).toEqual({ plan: "office", interval: "annual" });
  });

  it("returns null for an unknown / missing price", () => {
    expect(planForPriceId("price_unknown", PRICES)).toBeNull();
    expect(planForPriceId(null, PRICES)).toBeNull();
    expect(planForPriceId(undefined, PRICES)).toBeNull();
  });
});

describe("priceIdFor — plan → price mapping (round-trips)", () => {
  it("resolves the price id for each plan+interval", () => {
    expect(priceIdFor("pro", "monthly", PRICES)).toBe("price_pro_m");
    expect(priceIdFor("pro", "annual", PRICES)).toBe("price_pro_y");
    expect(priceIdFor("office", "monthly", PRICES)).toBe("price_office_m");
    expect(priceIdFor("office", "annual", PRICES)).toBe("price_office_y");
  });

  it("round-trips price → plan → price", () => {
    for (const p of PRICES) {
      const mapped = planForPriceId(p.id, PRICES)!;
      expect(priceIdFor(mapped.plan, mapped.interval, PRICES)).toBe(p.id);
    }
  });

  it("returns null when a price isn't configured", () => {
    expect(priceIdFor("office", "annual", PRICES.slice(0, 2))).toBeNull();
  });
});
