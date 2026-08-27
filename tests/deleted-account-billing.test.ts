import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// A DELETED ACCOUNT MUST NOT KEEP BILLING.
//
// The delete route cancelled Stripe inside `try { … } catch { /* ignore */ }`
// and then deleted the account regardless. If that call failed — expired key,
// Stripe incident, rate limit — a real card kept being charged for an account
// whose owner could no longer log in, cancel, or even see it happening, and
// nothing logged it, so nobody would ever find out.
//
// Deletion still always proceeds (blocking it would breach Apple §5.1.1(v)).
// What changed is that the failure is now loud and self-healing.
// ─────────────────────────────────────────────────────────────────────────────

const del = read("src/app/api/account/delete/route.ts");
const purge = read("src/lib/account-purge.ts");
const cron = read("src/app/api/reminders/route.ts");

describe("cancelling on delete", () => {
  it("no longer swallows the Stripe failure", () => {
    // Comments stripped: the file names the old `catch { /* ignore */ }` in
    // prose, and the point is that no such catch survives in the CODE.
    const code = del.replace(/\/\/.*$/gm, "");
    // End marker must survive comment-stripping — "Soft-delete" only exists in
    // a comment, so slicing to it silently ran to end-of-file.
    const billing = code.slice(code.indexOf("stopSubscription("), code.indexOf("_deleted: true"));
    expect(billing).not.toMatch(/catch/);
    expect(del).toMatch(/stopSubscription\(profile\.stripe_subscription_id\)/);
    expect(del).toMatch(/reportError\("billing\.cancel-on-delete-failed"/);
  });

  it("still deletes the account when Stripe is down — deletion is never blocked", () => {
    // No early return / throw between the billing attempt and the soft-delete.
    const between = del.slice(del.indexOf("stopSubscription("), del.indexOf("_deleted: true"));
    expect(between).not.toMatch(/return NextResponse|throw /);
  });

  it("keeps the subscription id when the money did NOT stop, so it can be retried", () => {
    // Cleared only on the success branch.
    expect(del).toMatch(/if \(result === "failed"\)[\s\S]{0,400}\} else \{[\s\S]{0,200}stripe_subscription_id: null/);
  });
});

describe("the daily sweep closes the loop", () => {
  it("stopSubscription treats already-cancelled and missing as done, not as failure", () => {
    expect(purge).toMatch(/status === "canceled" \|\| sub\.status === "incomplete_expired"/);
    expect(purge).toMatch(/resource_missing/);
  });

  it("reconcile only looks at deleted accounts that still carry a subscription", () => {
    expect(purge).toMatch(/\.eq\("customization->>_deleted", "true"\)/);
    expect(purge).toMatch(/\.not\("stripe_subscription_id", "is", null\)/);
  });

  it("a still-billing deleted account is reported, not silently skipped", () => {
    expect(purge).toMatch(/billing\.deleted-account-still-billing/);
  });

  it("the cron runs it every day and reports the count", () => {
    expect(cron).toMatch(/reconcileDeletedSubscriptions\(\)/);
    expect(cron).toMatch(/subscriptionsStopped/);
  });
});
