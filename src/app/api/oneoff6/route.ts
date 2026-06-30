import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// TEMPORARY diagnostic: report the current Stripe price amounts behind the pricing page.
const TOKEN = "sc-oneoff-6b4t9x2w";

const IDS: Record<string, string | undefined> = {
  pro_monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  pro_annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
  office_monthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  office_annual: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
};

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }
  const stripe = getStripe();
  const out: Record<string, unknown> = {};
  for (const [name, id] of Object.entries(IDS)) {
    if (!id) { out[name] = { id: null }; continue; }
    try {
      const p = await stripe.prices.retrieve(id);
      out[name] = {
        id,
        unit_amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval,
        product: typeof p.product === "string" ? p.product : p.product?.id,
        livemode: p.livemode,
      };
    } catch (e) {
      out[name] = { id, error: (e as Error).message };
    }
  }
  return NextResponse.json(out);
}
