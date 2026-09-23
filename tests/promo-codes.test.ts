import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  promoFitsPurchase, describePromo, scopeLabel, durationLabel, promoLabel,
  isFreeDays, isAppliesTo, isIntervalTarget, isPromoDuration, isAudience,
} from "@/lib/promo";

// Promo codes, rebuilt 2026-09-17 (owner: "I can create a promo code but what
// am I creating it for, the pro plan or the office plan?"). A code now carries
// the plan, the billing period, how long money off lasts and who may redeem —
// and every one of those is enforced where the money is, not just in the form.

describe("what a code is for", () => {
  it("an Office-only code never applies to a Pro purchase, and the other way round", () => {
    const office = { applies_to: "office", interval_target: "any" };
    expect(promoFitsPurchase(office, { plan: "office", interval: "monthly" })).toBe(true);
    expect(promoFitsPurchase(office, { plan: "pro", interval: "monthly" })).toBe(false);
    const pro = { applies_to: "pro", interval_target: "any" };
    expect(promoFitsPurchase(pro, { plan: "office", interval: "annual" })).toBe(false);
  });

  it("an annual-only code never applies to monthly billing", () => {
    const annual = { applies_to: "any", interval_target: "annual" };
    expect(promoFitsPurchase(annual, { plan: "pro", interval: "annual" })).toBe(true);
    expect(promoFitsPurchase(annual, { plan: "pro", interval: "monthly" })).toBe(false);
  });

  it("a code from before this existed still applies to everything", () => {
    // Rows written before supabase/promo-targeting.sql have no targeting
    // columns at all; they must keep working exactly as they did.
    expect(promoFitsPurchase({}, { plan: "pro", interval: "monthly" })).toBe(true);
    expect(promoFitsPurchase({}, { plan: "office", interval: "annual" })).toBe(true);
  });

  it("describes the whole offer in one sentence", () => {
    expect(describePromo({
      discount_type: "percent", discount_percent: 30, duration: "repeating", duration_months: 3,
      applies_to: "office", interval_target: "annual", plan_target: "all", max_uses: 50,
    })).toBe("30% off on office only, annual only · the first 3 months · 50 redemptions");
    expect(promoLabel({ discount_type: "free_time", free_days: 30 })).toBe("One month free");
    expect(scopeLabel({ applies_to: "pro", interval_target: "monthly" })).toBe("Pro only, monthly only");
    expect(durationLabel({ discount_type: "percent", duration: "forever" })).toBe("every payment");
    expect(durationLabel({ discount_type: "free_time", free_days: 7 })).toBe("");
  });

  it("accepts any sane free period, and refuses the rest", () => {
    for (const ok of [1, 7, 45, 365]) expect(isFreeDays(ok), String(ok)).toBe(true);
    for (const bad of [0, -3, 366, 7.5, "30"]) expect(isFreeDays(bad), String(bad)).toBe(false);
    expect(isAppliesTo("office")).toBe(true);
    expect(isAppliesTo("enterprise")).toBe(false);
    expect(isIntervalTarget("annual")).toBe(true);
    expect(isPromoDuration("repeating")).toBe(true);
    expect(isAudience("free")).toBe(true);
  });
});

// ── The create route, driven for real with Stripe and the DB mocked ────────
const stripeCalls: Record<string, unknown[]> = { coupons: [], promotionCodes: [], prices: [] };
let inserted: Record<string, unknown> | null = null;
let existingCode: { id: string; active: boolean } | null = null;

vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ({ id: "admin", email: "hello@swiftcard.me" }) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    prices: { retrieve: async (id: string) => { stripeCalls.prices.push(id); return { product: `prod_for_${id}` }; } },
    coupons: { create: async (args: Record<string, unknown>) => { stripeCalls.coupons.push(args); return { id: "coupon_1" }; } },
    promotionCodes: { create: async (args: Record<string, unknown>) => { stripeCalls.promotionCodes.push(args); return { id: "promo_1" }; } },
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingCode }) }) }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { inserted = row; return { data: { id: "row_1", ...row }, error: null }; } }),
      }),
    }),
  }),
}));

import { POST } from "@/app/api/admin/promo-codes/route";

const post = (body: Record<string, unknown>) =>
  POST(new Request("https://swiftcard.me/api/admin/promo-codes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) as never);

beforeEach(() => {
  stripeCalls.coupons = []; stripeCalls.promotionCodes = []; stripeCalls.prices = [];
  inserted = null; existingCode = null;
  process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID = "price_pro_m";
  process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID = "price_pro_y";
  process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID = "price_office_m";
  process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID = "price_office_y";
});

describe("creating a code", () => {
  it("money off becomes a Stripe coupon with the right duration, restricted to the chosen plan", async () => {
    const res = await post({
      code: "office50", discount_type: "percent", discount_percent: 50,
      duration: "repeating", duration_months: 3,
      applies_to: "office", interval_target: "any", plan_target: "all", max_uses: 25,
    });
    expect(res.status).toBe(200);
    expect(stripeCalls.coupons[0]).toMatchObject({ percent_off: 50, duration: "repeating", duration_in_months: 3 });
    // Only the OFFICE products — a code typed on Stripe's own page can't be
    // used against Pro.
    expect(stripeCalls.coupons[0]).toMatchObject({ applies_to: { products: ["prod_for_price_office_m", "prod_for_price_office_y"] } });
    expect(stripeCalls.promotionCodes[0]).toMatchObject({ code: "OFFICE50", max_redemptions: 25 });
    expect(inserted).toMatchObject({ code: "OFFICE50", applies_to: "office", duration: "repeating", duration_months: 3, discount_percent: 50 });
  });

  it("a new-accounts-only code is restricted at Stripe too", async () => {
    await post({ code: "WELCOME10", discount_type: "fixed", discount_amount: 1000, applies_to: "pro", plan_target: "free" });
    expect(stripeCalls.promotionCodes[0]).toMatchObject({ restrictions: { first_time_transaction: true } });
    expect(stripeCalls.coupons[0]).toMatchObject({ amount_off: 1000, currency: "usd", duration: "once" });
  });

  it("free time makes NO coupon — it is a trial, which a coupon cannot express", async () => {
    const res = await post({ code: "FREEMONTH", discount_type: "free_time", free_days: 30, applies_to: "pro" });
    expect(res.status).toBe(200);
    expect(stripeCalls.coupons.length).toBe(0);
    expect(inserted).toMatchObject({ free_days: 30, discount_type: "free_time", duration: "once" });
  });

  it("refuses the mistakes that would cost money or confuse a customer", async () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ code: "A B", discount_type: "free_time", free_days: 30 }, /letters, numbers and dashes/i],
      [{ code: "TOOLONG", discount_type: "free_time", free_days: 400 }, /1–365/],
      [{ code: "BADPLAN", discount_type: "free_time", free_days: 30, applies_to: "enterprise" }, /plan this code is for/i],
      [{ code: "BADMONTHS", discount_type: "percent", discount_percent: 20, duration: "repeating" }, /1–36 months/],
      [{ code: "PAST", discount_type: "free_time", free_days: 30, expires_at: "2020-01-01" }, /in the past/i],
      [{ code: "HUGE", discount_type: "percent", discount_percent: 150 }, /between 1 and 100/i],
    ];
    for (const [body, message] of cases) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error, JSON.stringify(body)).toMatch(message);
    }
  });

  it("refuses a code string that already exists", async () => {
    existingCode = { id: "old", active: true };
    const res = await post({ code: "TAKEN", discount_type: "free_time", free_days: 30 });
    expect(res.status).toBe(409);
  });
});

describe("the rules are enforced where the money is", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  it("checkout drops a code that doesn't fit the plan being bought", () => {
    // Judged in lib/promo-check (shared with the order page box) against the
    // purchase checkout actually makes…
    expect(read("src/lib/promo-check.ts")).toContain("if (!promoFitsPurchase(promo, input.purchase)) return { ok: false, reason: promoScopeMessage(promo) };");
    const src = read("src/app/api/stripe/checkout/route.ts");
    expect(src).toContain('purchase: { plan: isOffice ? "office" : "pro", interval },');
    // …and it is resolved AFTER the plan is known, or it could not be judged.
    expect(src.indexOf("const isOffice = OFFICE_PRICE_IDS")).toBeLessThan(src.indexOf("checkPromoForPurchase({"));
  });
  it("the pricing page only advertises a code on the plan it covers", () => {
    const src = read("src/app/pricing/page.tsx");
    expect(src).toContain("const promoOnPro = ");
    expect(src).toContain("const promoOnOffice = ");
    expect(src).toContain("{loading === \"pro\" ? \"Loading…\" : promoOnPro ?");
  });
});
