import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unsubUrl, marketingHeaders } from "@/lib/email-templates";

// No account ever had an email_preferences row. The only writer was POST
// /api/welcome, which nothing calls. With no row there is no
// unsubscribe_token, so unsubUrl() returns undefined, the footer link degrades
// to a plain sentence, the RFC 8058 List-Unsubscribe header pair is dropped,
// and /api/unsubscribe has no token to match the recipient by.
//
// Verified against the live database before the fix: 4 profiles, 0 preference
// rows. Every account. After the backfill: 4 rows, 4 distinct tokens, 0 opted
// out, 0 missing.

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("unsubUrl is the thing that has to exist", () => {
  it("is undefined without a token — which is why sending must stop", () => {
    expect(unsubUrl("")).toBeUndefined();
    expect(unsubUrl("   ")).toBeUndefined();
    expect(unsubUrl(null as unknown as string)).toBeUndefined();
  });

  it("builds a one-click URL from a real token", () => {
    const u = unsubUrl("abc-123");
    expect(u).toContain("/api/unsubscribe?token=abc-123");
  });

  it("percent-encodes the token rather than splicing it in raw", () => {
    expect(unsubUrl("a b&c=d")).toContain(`token=${encodeURIComponent("a b&c=d")}`);
  });

  it("the header pair is what makes it one-click for Gmail/Yahoo", () => {
    const h = marketingHeaders("https://swiftcard.me/api/unsubscribe?token=t");
    expect(h["List-Unsubscribe"]).toBe("<https://swiftcard.me/api/unsubscribe?token=t>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("every account gets a preferences row at provisioning", () => {
  it("the signup path mints one", () => {
    const c = code("src/app/onboarding/page.tsx");
    expect(c).toMatch(/ensureEmailPreferences\(user\.id, admin\)/);
  });

  it("the admin-created-account path mints one too", () => {
    const c = code("src/app/api/admin/create-card/route.ts");
    expect(c).toMatch(/ensureEmailPreferences\(newUserId, admin\)/);
  });

  it("the helper never resets an existing row — an opt-out must survive", () => {
    // A plain upsert would rewrite marketing_emails back to the column default
    // and silently re-subscribe someone who had unsubscribed.
    const c = code("src/lib/email-prefs.ts");
    expect(c).toMatch(/ignoreDuplicates: true/);
    expect(c).toMatch(/onConflict: "user_id"/);
    expect(c, "writes marketing_emails, which would clobber an opt-out").not.toMatch(
      /marketing_emails:/,
    );
  });

  it("the helper cannot break signup", () => {
    // Account provisioning must not fail because this write did.
    expect(code("src/lib/email-prefs.ts")).toMatch(/try \{[\s\S]*?\} catch/);
  });
});

describe("no marketing send without a working opt-out", () => {
  const SENDERS = [
    "src/app/api/admin/broadcast/route.ts",
    "src/app/api/admin/promo-codes/send/route.ts",
  ];

  it.each(SENDERS)("%s skips a recipient with no unsubscribe URL", (f) => {
    const c = code(f);
    expect(c, "sends anyway when unsubUrl() returned undefined").toMatch(
      /if \(!unsub\) \{[\s\S]{0,400}?continue;/,
    );
  });

  it.each(SENDERS)("%s still honours an explicit opt-out", (f) => {
    expect(code(f)).toMatch(/marketing_emails === false/);
  });

  it("the cron's lifecycle mail is gated the same way", () => {
    const c = code("src/app/api/reminders/route.ts");
    // Downgrade notice: bare guard. Expiry pitch: folded into its condition.
    expect(c).toMatch(/if \(!unsub\) continue;/);
    expect(c).toMatch(/if \(marketingOk && unsub\)/);
  });

  it("/api/unsubscribe reports failure when a token matches nothing", () => {
    // A PostgREST UPDATE matching zero rows is not an error — branching on
    // `error` alone would report success for a bogus or purged token.
    const c = code("src/app/api/unsubscribe/route.ts");
    expect(c).toMatch(/\.select\("user_id"\)/);
    expect(c).toMatch(/return !error && !!data\?\.length;/);
  });
});
