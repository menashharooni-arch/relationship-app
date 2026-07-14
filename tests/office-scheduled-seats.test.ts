import { describe, it, expect } from "vitest";
import { applicableTarget } from "@/lib/office-scheduled-seats";
import { PLAN_LIMITS } from "@/lib/plan";

describe("applicableTarget — a scheduled reduction never strands anyone", () => {
  it("applies the scheduled target when the team fits", () => {
    expect(applicableTarget(3, 2)).toBe(3); // scheduled 3, only 2 in use → 3
  });

  it("never reduces below what's in use at apply-time (team grew after scheduling)", () => {
    // Scheduled down to 3, but 5 seats are now in use → apply 5, not 3.
    expect(applicableTarget(3, 5)).toBe(5);
  });

  it("honors the 2-seat minimum", () => {
    expect(applicableTarget(1, 1)).toBe(PLAN_LIMITS.OFFICE_MIN_SEATS);
    expect(applicableTarget(0, 0)).toBe(PLAN_LIMITS.OFFICE_MIN_SEATS);
  });

  it("takes the max of scheduled, in-use, and the minimum", () => {
    expect(applicableTarget(4, 6)).toBe(6);
    expect(applicableTarget(10, 3)).toBe(10);
    expect(applicableTarget(2, 2)).toBe(2);
  });
});
