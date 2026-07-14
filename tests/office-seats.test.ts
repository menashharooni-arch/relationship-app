import { describe, it, expect } from "vitest";
import { computeSeatUsage } from "@/lib/office-seats";
import { PLAN_LIMITS } from "@/lib/plan";

describe("computeSeatUsage — owner counts as seat 1, pending reserves a seat", () => {
  it("a fresh 5-seat office: owner uses 1, 4 available for invites", () => {
    const u = computeSeatUsage(5, 0, 0);
    expect(u).toMatchObject({ purchased: 5, ownerSeats: 1, active: 0, pending: 0, used: 1, available: 4 });
  });

  it("pending invitations reserve seats", () => {
    const u = computeSeatUsage(5, 1, 2); // owner + 1 active + 2 pending = 4 used
    expect(u.used).toBe(4);
    expect(u.available).toBe(1);
  });

  it("a full office has zero available (owner + 4 members = 5)", () => {
    const u = computeSeatUsage(5, 4, 0);
    expect(u.used).toBe(5);
    expect(u.available).toBe(0);
  });

  it("never goes negative when over-provisioned", () => {
    const u = computeSeatUsage(5, 6, 0); // shouldn't happen, but clamp
    expect(u.available).toBe(0);
    expect(u.used).toBe(7);
  });

  it("enforces the 2-seat minimum and floors fractional inputs", () => {
    expect(computeSeatUsage(1, 0, 0).purchased).toBe(PLAN_LIMITS.OFFICE_MIN_SEATS);
    expect(computeSeatUsage(0, 0, 0).purchased).toBe(PLAN_LIMITS.OFFICE_MIN_SEATS);
    expect(computeSeatUsage(7.9, 0, 0).purchased).toBe(7);
  });

  it("the 5-user example from the spec: owner + 4 employee invitations", () => {
    // 'A 5-user Office Plan includes 1 owner card + up to 4 employee cards/invites'
    const fresh = computeSeatUsage(5, 0, 0);
    expect(fresh.available).toBe(4); // 4 invitations possible
    // after inviting 4 (all pending), none available
    const invited = computeSeatUsage(5, 0, 4);
    expect(invited.available).toBe(0);
    expect(invited.used).toBe(5);
  });

  it("clamps negative active/pending to zero", () => {
    const u = computeSeatUsage(5, -3, -1);
    expect(u).toMatchObject({ active: 0, pending: 0, used: 1, available: 4 });
  });
});
