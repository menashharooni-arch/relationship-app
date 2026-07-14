import { describe, it, expect } from "vitest";
import { formatCents, formatUsd, seatSubtotalCents, perMonthCents } from "@/lib/currency";
import { PLAN_PRICES } from "@/lib/plan";

describe("formatCents — always exactly two decimals, no float artifacts", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatCents(0)).toBe("0.00");
    expect(formatCents(399)).toBe("3.99");
    expect(formatCents(7980)).toBe("79.80");   // 20 × $3.99 — the reported bug
    expect(formatCents(19950)).toBe("199.50");  // 50 × $3.99
    expect(formatCents(100)).toBe("1.00");
  });
  it("rounds sub-cent inputs to whole cents", () => {
    expect(formatCents(359.0833333)).toBe("3.59"); // 4309/12
    expect(formatCents(7980.4)).toBe("79.80");
  });
  it("formatUsd prepends the dollar sign", () => {
    expect(formatUsd(7980)).toBe("$79.80");
  });
});

describe("seatSubtotalCents — integer cents, matches Stripe unit_amount × quantity", () => {
  const MO = PLAN_PRICES.OFFICE_MONTHLY_PER_SEAT_CENTS; // 399
  const YR = PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS;  // 4309

  it("handles every preset + custom seat count with no float error", () => {
    // seats → expected monthly "$X.XX"
    const cases: Array<[number, string]> = [
      [2, "$7.98"], [3, "$11.97"], [7, "$27.93"], [20, "$79.80"],
      [25, "$99.75"], [50, "$199.50"], [100, "$399.00"], [137, "$546.63"],
    ];
    for (const [seats, expected] of cases) {
      expect(formatUsd(seatSubtotalCents(MO, seats))).toBe(expected);
    }
  });

  it("no result ever contains a floating-point tail", () => {
    for (let seats = 2; seats <= 500; seats++) {
      const s = formatUsd(seatSubtotalCents(MO, seats));
      expect(s).toMatch(/^\$\d[\d,]*\.\d{2}$/); // exactly 2 decimals, nothing else
    }
  });

  it("annual subtotals are exact too", () => {
    expect(formatUsd(seatSubtotalCents(YR, 2))).toBe("$86.18");
    expect(formatUsd(seatSubtotalCents(YR, 20))).toBe("$861.80");
    expect(formatUsd(seatSubtotalCents(YR, 25))).toBe("$1,077.25");
  });

  it("floors fractional and clamps negative seats", () => {
    expect(seatSubtotalCents(MO, 3.9)).toBe(399 * 3);
    expect(seatSubtotalCents(MO, -5)).toBe(0);
  });
});

describe("perMonthCents — annual → monthly-equivalent display", () => {
  it("computes the per-month figure for the annual per-seat price", () => {
    expect(formatUsd(perMonthCents(PLAN_PRICES.OFFICE_ANNUAL_PER_SEAT_CENTS))).toBe("$3.59");
    expect(formatUsd(perMonthCents(PLAN_PRICES.PRO_ANNUAL_CENTS))).toBe("$4.50"); // 5400/12
  });
});
