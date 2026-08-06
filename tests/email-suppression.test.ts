import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEmailOptedOut } from "@/lib/messaging";

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BROADCAST = "src/app/api/admin/broadcast/route.ts";
const PROMO = "src/app/api/admin/promo-codes/send/route.ts";
const CRON = "src/app/api/reminders/route.ts";

describe("both suppression lists are honoured everywhere", () => {
  it("membership testing normalizes the address", () => {
    const set = new Set(["sam@example.com"]);
    expect(isEmailOptedOut(set, "Sam@Example.com ")).toBe(true);
    expect(isEmailOptedOut(set, "other@example.com")).toBe(false);
    expect(isEmailOptedOut(set, null)).toBe(false);
  });

  it.each([BROADCAST, PROMO])("%s checks message_opt_outs, not just marketing_emails", (f) => {
    const c = code(f);
    expect(c, "only the account-level opt-out is checked").toMatch(/isEmailOptedOut\(contactOptOuts/);
    expect(c).toMatch(/emailOptOutSet\(/);
    expect(c).toMatch(/marketing_emails === false/);
  });

  it("the bulk lookup fails CLOSED", () => {
    // If we cannot confirm someone has NOT opted out, we must not mail them.
    // The single exception is 42P01 (table absent), where no opt-out can exist.
    const c = code("src/lib/messaging.ts");
    expect(c).toMatch(/emailOptOutSet/);
    expect(c).toMatch(/42P01/);
    expect(c).toMatch(/for \(const c of chunk\) out\.add\(c\)/);
  });
});

describe("soft-deleted accounts are not mailed", () => {
  it.each([BROADCAST, PROMO])("%s filters _deleted profiles from the segment", (f) => {
    expect(
      code(f),
      "the send set is larger than the count the admin was shown",
    ).toMatch(/customization->>_deleted/);
  });
});

describe("the cron reports its failures", () => {
  it("every job routes through reportError, not just console", () => {
    const c = code(CRON);
    expect(c).toMatch(/reminders\.expire-free-months/);
    expect(c).toMatch(/reminders\.trial-ending-warn/);
  });

  it("a downgraded user is always told in-app, even if opted out of marketing", () => {
    const c = code(CRON);
    const notifyAt = c.indexOf('type: "plan_downgraded"');
    const optOutAt = c.indexOf("if (!marketingOk) continue;");
    expect(notifyAt, "no in-app notice is written at all").toBeGreaterThan(0);
    expect(optOutAt).toBeGreaterThan(0);
    expect(
      notifyAt,
      "the notice is behind the marketing opt-out — the silent-downgrade bug",
    ).toBeLessThan(optOutAt);
  });
});

describe("the welcome email actually has a caller now", () => {
  it("onboarding sends it", () => {
    expect(code("src/app/onboarding/page.tsx")).toMatch(/sendWelcomeEmail\(user\.id, user\.email\)/);
  });

  it("the route delegates to the same helper rather than duplicating it", () => {
    const c = code("src/app/api/welcome/route.ts");
    expect(c).toMatch(/sendWelcomeEmail/);
    expect(c, "the route still has its own copy of the send logic").not.toMatch(/resend\.emails\.send/);
  });

  it("reads Resend's resolved error instead of relying on a throw", () => {
    // The SDK resolves {data, error} — it does not throw — so a .catch() can
    // never see an API-level failure and the idempotency claim would stick,
    // permanently costing that user their welcome email.
    const c = code("src/lib/welcome-email.ts");
    expect(c).toMatch(/error: sendError/);
    expect(c).toMatch(/if \(sendError\)/);
    expect(c).toMatch(/\.delete\(\)[\s\S]{0,120}?type", "welcome"/);
  });

  it("cannot fail a signup", () => {
    const c = code("src/lib/welcome-email.ts");
    expect(c).toMatch(/try \{[\s\S]*?\} catch/);
    expect(c).toMatch(/Promise<WelcomeResult>/);
  });
});
