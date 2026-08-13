import { describe, it, expect } from "vitest";
import { resolveDateRange, previousPeriod } from "@/lib/office-analytics-dates";

// A fixed "now" so every test is deterministic regardless of when it runs.
const NOW = new Date("2026-03-15T14:32:00.000Z"); // mid-afternoon UTC, on purpose

describe("resolveDateRange — UTC calendar-day boundaries", () => {
  it("7d: exactly 7 calendar days INCLUDING today — Mar 9 through Mar 15", () => {
    const r = resolveDateRange("7d", NOW);
    // Not Mar 8: since = todayStart - 7d covered EIGHT days, so the "7 days"
    // label overstated its own window.
    expect(r.since).toBe("2026-03-09T00:00:00.000Z");
    expect(r.until).toBe("2026-03-16T00:00:00.000Z");
    expect((new Date(r.until).getTime() - new Date(r.since).getTime()) / 86400000).toBe(7);
  });

  it("30d and 90d cover exactly their labeled number of days", () => {
    for (const [preset, days] of [["30d", 30], ["90d", 90]] as const) {
      const r = resolveDateRange(preset, NOW);
      expect((new Date(r.until).getTime() - new Date(r.since).getTime()) / 86400000).toBe(days);
    }
  });

  it("until never carries a time-of-day component — always a UTC midnight", () => {
    for (const preset of ["7d", "30d", "90d"] as const) {
      const r = resolveDateRange(preset, NOW);
      expect(r.until.endsWith("T00:00:00.000Z")).toBe(true);
      expect(r.since.endsWith("T00:00:00.000Z")).toBe(true);
    }
  });

  it("custom: resolves an inclusive since-day through the day AFTER the until-day (exclusive)", () => {
    const r = resolveDateRange("custom", NOW, { since: "2026-01-01", until: "2026-01-05" });
    expect(r.since).toBe("2026-01-01T00:00:00.000Z");
    expect(r.until).toBe("2026-01-06T00:00:00.000Z"); // the day AFTER Jan 5, exclusive
  });

  it("custom: a backwards range (since after until) clamps to a single day on `since`, not an inverted/empty window", () => {
    const r = resolveDateRange("custom", NOW, { since: "2026-01-10", until: "2026-01-01" });
    expect(r.since).toBe("2026-01-10T00:00:00.000Z");
    expect(r.until).toBe("2026-01-11T00:00:00.000Z");
  });

  it("custom with no custom range supplied falls back to 30d", () => {
    const r = resolveDateRange("custom", NOW);
    expect(r).toEqual(resolveDateRange("30d", NOW));
  });
});

describe("previousPeriod — same-length immediately-prior window", () => {
  it("shifts back by exactly the range's own length", () => {
    const range = resolveDateRange("7d", NOW);
    const prev = previousPeriod(range);
    expect(prev.until).toBe(range.since);
    expect(new Date(range.until).getTime() - new Date(range.since).getTime())
      .toBe(new Date(prev.until).getTime() - new Date(prev.since).getTime());
  });
});
