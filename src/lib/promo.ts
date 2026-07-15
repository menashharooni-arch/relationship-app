// ── Promo codes: the free-period vocabulary ─────────────────────────────────
// ONE definition of what a free-time promo can be, shared by the admin form,
// the admin API, the redeem route and the checkout route — so a period can't be
// offered in the UI that the server won't honour, or vice versa.
//
// Why DAYS and not months: Stripe coupons can only express whole months
// (duration_in_months), so "one week free" is impossible to build as a coupon.
// Free time is therefore a TRIAL (subscription_data.trial_period_days), which
// takes an exact day count — and all four offers map cleanly onto it.
//
// The trade-off that buys: a trial can't be typed on Stripe's own checkout page
// (Stripe promotion codes resolve to coupons, not trials), so a free-time code
// must be entered in the SwiftCard promo box on /pricing. That box already
// exists and already round-trips through /api/promo/redeem.

export const FREE_PERIODS = [
  { days: 7, label: "One week" },
  { days: 14, label: "Two weeks" },
  { days: 30, label: "One month" },
  { days: 60, label: "Two months" },
] as const;

export type FreeDays = (typeof FREE_PERIODS)[number]["days"];

export const FREE_DAYS_VALUES: readonly number[] = FREE_PERIODS.map((p) => p.days);

export function isFreeDays(v: unknown): v is FreeDays {
  return typeof v === "number" && FREE_DAYS_VALUES.includes(v);
}

/** "One month" for 30, etc. Falls back to a plain day count for legacy rows. */
export function freeDaysLabel(days: number | null | undefined): string {
  if (days == null) return "";
  return FREE_PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;
}

export type DiscountType = "percent" | "fixed" | "free_time";

export function isDiscountType(v: unknown): v is DiscountType {
  return v === "percent" || v === "fixed" || v === "free_time";
}

// What the customer is told they're getting. Used on /pricing after redeem, and
// in the admin list, so both describe a code the same way.
export function promoLabel(promo: {
  discount_type?: string | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  free_days?: number | null;
}): string {
  if (promo.discount_type === "free_time" && promo.free_days) {
    return `${freeDaysLabel(promo.free_days)} free`;
  }
  if (promo.discount_percent) return `${promo.discount_percent}% off`;
  if (promo.discount_amount) return `$${(promo.discount_amount / 100).toFixed(2)} off`;
  return "Discount applied";
}
