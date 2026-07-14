import { describe, it, expect } from "vitest";
import { isUpgrade } from "@/lib/subscription";

// isUpgrade decides WHEN money moves: true → invoice immediately (they get the
// bigger plan now, so they pay now); false → let the credit ride the next
// invoice (never a cash refund). Getting this backwards either gives Office away
// free until the next billing date, or bills someone for a downgrade.

const pro = { plan: "pro", interval: "monthly" } as const;
const proAnnual = { plan: "pro", interval: "annual" } as const;
const office = { plan: "office", interval: "monthly" } as const;
const officeAnnual = { plan: "office", interval: "annual" } as const;

describe("isUpgrade — Pro ↔ Office", () => {
  it("Pro → Office is an upgrade (charge now)", () => {
    expect(isUpgrade(pro, office)).toBe(true);
  });

  it("Office → Pro is NOT an upgrade (credit next invoice, no refund)", () => {
    expect(isUpgrade(office, pro)).toBe(false);
  });

  it("Pro annual → Office monthly is still an upgrade — plan outranks interval", () => {
    expect(isUpgrade(proAnnual, office)).toBe(true);
  });

  it("Office annual → Pro annual is a downgrade", () => {
    expect(isUpgrade(officeAnnual, proAnnual)).toBe(false);
  });
});

describe("isUpgrade — interval within the same plan", () => {
  it("monthly → annual is an upgrade (bigger commitment, charged now)", () => {
    expect(isUpgrade(pro, proAnnual)).toBe(true);
    expect(isUpgrade(office, officeAnnual)).toBe(true);
  });

  it("annual → monthly is a downgrade", () => {
    expect(isUpgrade(proAnnual, pro)).toBe(false);
    expect(isUpgrade(officeAnnual, office)).toBe(false);
  });

  it("same plan + same interval is not an upgrade (seat changes are handled separately)", () => {
    expect(isUpgrade(pro, pro)).toBe(false);
    expect(isUpgrade(office, office)).toBe(false);
  });
});

describe("isUpgrade — unknown current plan", () => {
  it("treats an unrecognised current price as an upgrade, so we never hand out free access", () => {
    expect(isUpgrade(null, office)).toBe(true);
    expect(isUpgrade(undefined, pro)).toBe(true);
  });
});
