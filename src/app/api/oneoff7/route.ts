import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// TEMPORARY one-off: create Stripe prices matching the displayed pricing. Token-guarded.
const TOKEN = "sc-oneoff-2q7m9c4h";
const PRO_PRODUCT = "prod_UkmMhdKzJRWWbc";
const OFFICE_PRODUCT = "prod_UkoFR2DnW0cytT";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const stripe = getStripe();
  const mk = (product: string, unit_amount: number, interval: "month" | "year") =>
    stripe.prices.create({ product, currency: "usd", unit_amount, recurring: { interval } });

  const pro_monthly = await mk(PRO_PRODUCT, 499, "month");
  const pro_annual = await mk(PRO_PRODUCT, 5400, "year");
  const office_monthly = await mk(OFFICE_PRODUCT, 399, "month");
  const office_annual = await mk(OFFICE_PRODUCT, 4309, "year");

  return NextResponse.json({
    NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID: pro_monthly.id,
    NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID: pro_annual.id,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: office_monthly.id,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID: office_annual.id,
    livemode: pro_monthly.livemode,
  });
}
