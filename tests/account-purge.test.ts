import { describe, it, expect } from "vitest";
import { isPurgeDue, PURGE_GRACE_DAYS } from "@/lib/account-purge";

const DAY = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000; // fixed reference

describe("isPurgeDue — permanent-deletion gate", () => {
  it("keeps an account still inside the 30-day reopen window", () => {
    const deletedAt = new Date(now - (PURGE_GRACE_DAYS - 1) * DAY).toISOString();
    expect(isPurgeDue(deletedAt, now)).toBe(false);
  });

  it("purges an account past the reopen window", () => {
    const deletedAt = new Date(now - (PURGE_GRACE_DAYS + 1) * DAY).toISOString();
    expect(isPurgeDue(deletedAt, now)).toBe(true);
  });

  it("purges exactly at the window boundary", () => {
    const deletedAt = new Date(now - PURGE_GRACE_DAYS * DAY).toISOString();
    expect(isPurgeDue(deletedAt, now)).toBe(true);
  });

  it("treats a missing/blank/invalid timestamp as due (legacy soft-deletes never linger)", () => {
    expect(isPurgeDue(undefined, now)).toBe(true);
    expect(isPurgeDue(null, now)).toBe(true);
    expect(isPurgeDue("", now)).toBe(true);
    expect(isPurgeDue("not-a-date", now)).toBe(true);
  });

  it("a just-deleted account is not purged", () => {
    expect(isPurgeDue(new Date(now).toISOString(), now)).toBe(false);
  });
});
