import { describe, it, expect } from "vitest";
import { computeConversionRate, pctChange, fillDateRange, defaultEmployeeSort } from "@/lib/office-analytics-metrics";

describe("computeConversionRate — leads ÷ views", () => {
  it("computes a normal ratio", () => {
    expect(computeConversionRate(5, 20)).toBe(0.25);
  });

  it("returns null (not 0 or Infinity) when there are zero views — nothing to convert from", () => {
    expect(computeConversionRate(0, 0)).toBeNull();
    expect(computeConversionRate(3, 0)).toBeNull();
  });

  it("stays bounded and correct even when leads exceed views (edge case, not an error)", () => {
    expect(computeConversionRate(10, 4)).toBe(2.5);
  });

  it("zero leads over real views is a real 0, not null", () => {
    expect(computeConversionRate(0, 50)).toBe(0);
  });
});

describe("pctChange — period-over-period delta", () => {
  it("computes a normal percentage change", () => {
    expect(pctChange(150, 100)).toBeCloseTo(0.5);
    expect(pctChange(50, 100)).toBeCloseTo(-0.5);
  });

  it("returns 0 when both periods are zero (no change, not 'new')", () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  it("returns null (not +Infinity) when there's no prior-period baseline but current > 0", () => {
    expect(pctChange(10, 0)).toBeNull();
  });
});

describe("fillDateRange — zero-fills missing UTC days for the chart", () => {
  it("fills every day in range when the RPC only returned rows with data", () => {
    const rows = [{ date: "2026-01-02", views: 5 }];
    const filled = fillDateRange(rows, "2026-01-01T00:00:00.000Z", "2026-01-04T00:00:00.000Z");
    expect(filled).toEqual([
      { date: "2026-01-01", views: 0 },
      { date: "2026-01-02", views: 5 },
      { date: "2026-01-03", views: 0 },
    ]);
  });

  it("preserves existing counts exactly, doesn't just zero everything", () => {
    const rows = [
      { date: "2026-01-01", views: 3 },
      { date: "2026-01-02", views: 7 },
    ];
    const filled = fillDateRange(rows, "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    expect(filled).toEqual([
      { date: "2026-01-01", views: 3 },
      { date: "2026-01-02", views: 7 },
    ]);
  });

  it("handles a single-day range", () => {
    const filled = fillDateRange([], "2026-03-05T00:00:00.000Z", "2026-03-06T00:00:00.000Z");
    expect(filled).toEqual([{ date: "2026-03-05", views: 0 }]);
  });

  it("stays UTC-pure — a row dated across a DST-adjacent boundary still lands on the right UTC day", () => {
    const rows = [{ date: "2026-03-08", views: 2 }];
    const filled = fillDateRange(rows, "2026-03-07T00:00:00.000Z", "2026-03-09T00:00:00.000Z");
    expect(filled.map((f) => f.date)).toEqual(["2026-03-07", "2026-03-08"]);
    expect(filled[1].views).toBe(2);
  });
});

describe("defaultEmployeeSort — leads first, never raw views first", () => {
  it("ranks by leads descending as the primary key", () => {
    const rows = [
      { name: "Low leads", leads: 1, contactsSaved: 0 },
      { name: "High leads", leads: 9, contactsSaved: 0 },
    ];
    expect(defaultEmployeeSort(rows).map((r) => r.name)).toEqual(["High leads", "Low leads"]);
  });

  it("breaks a leads tie by contacts saved descending", () => {
    const rows = [
      { name: "Fewer saves", leads: 2, contactsSaved: 1 },
      { name: "More saves", leads: 2, contactsSaved: 5 },
    ];
    expect(defaultEmployeeSort(rows).map((r) => r.name)).toEqual(["More saves", "Fewer saves"]);
  });

  it("breaks a full tie by name ascending", () => {
    const rows = [
      { name: "Zed", leads: 0, contactsSaved: 0 },
      { name: "Anna", leads: 0, contactsSaved: 0 },
    ];
    expect(defaultEmployeeSort(rows).map((r) => r.name)).toEqual(["Anna", "Zed"]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      { name: "B", leads: 1, contactsSaved: 0 },
      { name: "A", leads: 2, contactsSaved: 0 },
    ];
    const copy = [...rows];
    defaultEmployeeSort(rows);
    expect(rows).toEqual(copy);
  });
});
