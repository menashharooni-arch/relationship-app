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

// ── Owner-requested complete deletion (2026-09-24) ──────────────────────────
import { readFileSync as read_ } from "node:fs";
import { join as join_ } from "node:path";

describe("purge now: no reopen window, and billing never outlives the account", () => {
  const src = read_(join_(process.cwd(), "src/lib/account-purge.ts"), "utf8").replace(/\r\n/g, "\n");

  it("an account flagged purgeNow is due at once, whatever its date", () => {
    const now = Date.now();
    expect(isPurgeDue(new Date(now).toISOString(), now, true)).toBe(true);
    expect(isPurgeDue(new Date(now).toISOString(), now, false)).toBe(false);
    expect(src).toContain("isPurgeDue(cust._deletion?.at, nowMs, cust._deletion?.purgeNow === true)");
  });

  it("a live subscription is cancelled BEFORE anything is deleted, and a failed cancel stops the purge", () => {
    const body = src.slice(src.indexOf("export async function purgeUserData"));
    const stop = body.indexOf("await stopSubscription(subId)");
    const firstDelete = body.indexOf(".delete()");
    expect(stop).toBeGreaterThan(-1);
    expect(stop).toBeLessThan(firstDelete);
    expect(body).toMatch(/if \(result === "failed"\) \{[\s\S]{0,300}return false;/);
    expect(src).toContain("if (await purgeUserData(admin, row.id as string)) purged++;");
  });

  it("the tables with no foreign key to the account are cleared too", () => {
    expect(src).toContain('admin.from("signup_invite_uses").delete().eq("user_id", userId)');
    expect(src).toContain('admin.from("audit_logs").delete().or(`actor_id.eq.${userId},target_id.eq.${userId}`)');
  });

  it("runs hourly from the GitHub schedule, behind the cron secret", () => {
    const route = read_(join_(process.cwd(), "src/app/api/account/purge-due/route.ts"), "utf8");
    expect(route).toContain("accepted.length > 0 && !!auth && accepted.includes(auth)");
    expect(route).toContain("await purgeExpiredDeletedAccounts()");
    const wf = read_(join_(process.cwd(), ".github/workflows/push-catchup.yml"), "utf8");
    expect(wf).toContain("https://swiftcard.me/api/account/purge-due");
  });
});
