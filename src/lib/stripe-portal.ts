import { getStripe } from "@/lib/stripe";

// ── Stripe portal, scoped to payment method + invoices ───────────────────────
// The portal used to open with Stripe's DEFAULT configuration, which offers
// cancel and plan-change on top of payment methods. That made three buttons in
// Settings > Billing do overlapping things — but the real cost was that a cancel
// inside the portal SKIPS our cancel flow entirely: no reason prompt, no 50%
// retention offer, no Office→Pro save, and _retentionUsed never gets recorded.
// The cheapest path out was the one that never tried to keep the customer.
//
// So the portal is narrowed to the two jobs its own copy is actually good at —
// updating a card and reading invoices. Changing a plan and cancelling stay in
// our native UI, which is the only place those flows are implemented properly.

const CONFIG_METADATA_KEY = "swiftcard_portal";
const CONFIG_METADATA_VALUE = "payments-only";

// Configurations are account-level and long-lived, so resolve once per process
// rather than paying a list/create round-trip on every portal open.
let cachedId: string | null = null;

export async function getPortalConfigurationId(): Promise<string | null> {
  // An explicitly configured one always wins — lets billing be re-scoped from
  // the Stripe dashboard without a deploy.
  const fromEnv = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (fromEnv) return fromEnv;
  if (cachedId) return cachedId;

  const stripe = getStripe();

  // Reuse the one we made earlier if it's still there. Metadata isn't a
  // filterable field on this endpoint, so match in memory — the list is tiny.
  const existing = await stripe.billingPortal.configurations.list({ limit: 100, active: true });
  const hit = existing.data.find((c) => c.metadata?.[CONFIG_METADATA_KEY] === CONFIG_METADATA_VALUE);
  if (hit) {
    cachedId = hit.id;
    return cachedId;
  }

  const created = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "SwiftCard — payment method & invoices",
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      // Deliberately off — both live in our own UI. subscription_cancel here
      // would bypass the retention flow; subscription_update would let someone
      // change price/quantity without the seat accounting the app depends on.
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
    },
    metadata: { [CONFIG_METADATA_KEY]: CONFIG_METADATA_VALUE },
  });
  cachedId = created.id;
  return cachedId;
}
