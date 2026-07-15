import { describe, it, expect } from "vitest";
import {
  FREE_PERIODS,
  isFreeDays,
  freeDaysLabel,
  promoLabel,
  isDiscountType,
} from "@/lib/promo";

describe("FREE_PERIODS — the four offers, as exact day counts", () => {
  it("is exactly one week / two weeks / one month / two months", () => {
    expect(FREE_PERIODS.map((p) => [p.label, p.days])).toEqual([
      ["One week", 7],
      ["Two weeks", 14],
      ["One month", 30],
      ["Two months", 60],
    ]);
  });

  it("uses DAYS, because a Stripe coupon cannot express a week", () => {
    // The two short offers are the whole reason free time is a trial
    // (trial_period_days) rather than a coupon (duration_in_months).
    expect(FREE_PERIODS.filter((p) => p.days < 30).map((p) => p.days)).toEqual([7, 14]);
  });
});

describe("isFreeDays — the server's allow-list", () => {
  it("accepts only the four published periods", () => {
    for (const p of FREE_PERIODS) expect(isFreeDays(p.days)).toBe(true);
  });

  it("rejects anything else, including plausible-looking values", () => {
    for (const bad of [0, -7, 1, 31, 90, 365, 366, 3650, NaN, Infinity]) {
      expect(isFreeDays(bad), `${bad} must not be grantable`).toBe(false);
    }
    expect(isFreeDays("30")).toBe(false); // a string from a form body isn't a period
    expect(isFreeDays(null)).toBe(false);
    expect(isFreeDays(undefined)).toBe(false);
  });
});

describe("freeDaysLabel", () => {
  it("names the four periods", () => {
    expect(freeDaysLabel(7)).toBe("One week");
    expect(freeDaysLabel(14)).toBe("Two weeks");
    expect(freeDaysLabel(30)).toBe("One month");
    expect(freeDaysLabel(60)).toBe("Two months");
  });

  it("falls back to a day count for a legacy/unknown value rather than showing nothing", () => {
    expect(freeDaysLabel(45)).toBe("45 days");
  });

  it("is empty for no value", () => {
    expect(freeDaysLabel(null)).toBe("");
    expect(freeDaysLabel(undefined)).toBe("");
  });
});

describe("promoLabel — one description, shared by admin and /pricing", () => {
  it("describes a free-time code by its period", () => {
    expect(promoLabel({ discount_type: "free_time", free_days: 7 })).toBe("One week free");
    expect(promoLabel({ discount_type: "free_time", free_days: 60 })).toBe("Two months free");
  });

  it("still describes the legacy percent/fixed codes", () => {
    expect(promoLabel({ discount_type: "percent", discount_percent: 20 })).toBe("20% off");
    expect(promoLabel({ discount_type: "fixed", discount_amount: 500 })).toBe("$5.00 off");
  });

  it("never claims free time when free_days is missing", () => {
    // A free_time row with no period is broken data — it must not render as
    // "undefined free" or silently imply a grant.
    expect(promoLabel({ discount_type: "free_time", free_days: null })).toBe("Discount applied");
  });

  it("falls back rather than rendering an empty string", () => {
    expect(promoLabel({})).toBe("Discount applied");
  });
});

describe("isDiscountType", () => {
  it("accepts the three real types", () => {
    expect(isDiscountType("percent")).toBe(true);
    expect(isDiscountType("fixed")).toBe(true);
    expect(isDiscountType("free_time")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isDiscountType("free")).toBe(false);
    expect(isDiscountType("")).toBe(false);
    expect(isDiscountType(null)).toBe(false);
  });
});
