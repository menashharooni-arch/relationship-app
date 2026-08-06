import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceGrantsFreeMonth } from "@/lib/referral";

// Two ways to get free Pro for nothing, both shipped.

const root = process.cwd();
const code = (p: string) =>
  readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// The grant rule, extracted exactly as the route now computes it, so the truth
// table below tests behaviour rather than a string match.
const grants = (referrer: boolean, status: string, source: string) =>
  referrer && status === "signed_up" && sourceGrantsFreeMonth(source);

describe("referral free month requires a real, clean referral", () => {
  it("grants for an ordinary referred signup", () => {
    expect(grants(true, "signed_up", "referral")).toBe(true);
  });

  it.each([
    ["same_ip_as_referrer", "flagged"],
    ["same_device_as_referrer", "flagged"],
    ["ip_signup_volume", "flagged"],
  ])("refuses a %s signup (status %s)", (_reason, status) => {
    // The old expression was `sourceGrantsFreeMonth(source) || (...)`. source is
    // "referral" for any signup carrying a code, and a flagged one keeps it, so
    // the left side short-circuited and every fraud check below was dead.
    expect(grants(true, status, "referral")).toBe(false);
  });

  it("refuses a self-referral", () => {
    // Self-referral also resets source to "direct" and drops the referrer.
    expect(grants(false, "self_referral", "direct")).toBe(false);
  });

  it("refuses a spoofed source with no referrer behind it", () => {
    // source comes from a COOKIE (onboarding reads SRC_COOKIE), so it is
    // client-controlled. On its own it used to grant a month with no code, no
    // referrer and no fraud check run at all.
    expect(grants(false, "signed_up", "referral")).toBe(false);
  });

  it("refuses every non-referral source", () => {
    for (const s of ["direct", "save_contact", "share_info", "badge", "follow_up"]) {
      expect(grants(true, "signed_up", s), `${s} granted a free month`).toBe(false);
    }
  });

  it("the route computes the grant with AND, not the old short-circuiting OR", () => {
    const c = code("src/lib/referral-server.ts");
    expect(c).toMatch(
      /grantsFreeMonth =\s*!!referrer && status === "signed_up" && sourceGrantsFreeMonth\(source\)/,
    );
    expect(c, "the OR is back — status is decided before it is read").not.toMatch(
      /sourceGrantsFreeMonth\(source\) \|\|/,
    );
  });
});

describe("a promo code can only pay out once", () => {
  const CHECKOUT = "src/app/api/stripe/checkout/route.ts";
  const WEBHOOK = "src/app/api/stripe/webhook/route.ts";

  it("checkout requires an UNCONSUMED redemption, not merely an existing row", () => {
    const c = code(CHECKOUT);
    expect(c).toMatch(/consumed_at/);
    expect(c).toMatch(/if \(redemption && !redemption\.consumed_at\)/);
  });

  it("checkout carries the redemption id to the webhook", () => {
    expect(code(CHECKOUT)).toMatch(/promo_redemption_id: promoRedemptionId/);
  });

  it("the webhook spends it on completed checkout", () => {
    const c = code(WEBHOOK);
    expect(c).toMatch(/promo_code_redemptions/);
    expect(c).toMatch(/consumed_at: new Date\(\)\.toISOString\(\)/);
  });

  it("consuming is idempotent, so a redelivered Stripe event can't re-stamp", () => {
    expect(code(WEBHOOK)).toMatch(/\.is\("consumed_at", null\)/);
  });

  it("is spent on checkout completion, NOT on a paid invoice", () => {
    // The exploit is to cancel before the first bill. Keying consumption to a
    // successful invoice would leave it wide open in exactly that case.
    const c = code(WEBHOOK);
    const idx = c.indexOf("promo_code_redemptions");
    const completedIdx = c.indexOf('event.type === "checkout.session.completed"');
    expect(completedIdx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeGreaterThan(completedIdx);
    // and before the invoice handling further down
    const invoiceIdx = c.indexOf('invoice.payment_succeeded');
    if (invoiceIdx >= 0) expect(idx).toBeLessThan(invoiceIdx);
  });
});
