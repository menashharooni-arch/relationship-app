"use client";

// ── In-App Purchase, via RevenueCat ─────────────────────────────────────────
//
// The remedy for the Guideline 3.1.1 rejection of 1.0.0 (7). The previous
// posture — a link out to the default browser, per the US-storefront allowance
// in 3.1.1(a) — was implemented (see external-purchase.ts) and REJECTED anyway:
// App Review held that a subscription the app *unlocks* must also be
// purchasable in the app under 3.1.3(b), link-out or not. So Pro is now a real
// App Store subscription, and this module is the only way the web bundle
// touches StoreKit.
//
// Shape rules, all fail-closed like external-purchase.ts before it:
//   • Web and SSR: every entry point resolves to "unavailable" — the site
//     keeps its own Stripe checkout and never loads the plugin.
//   • Shell without the plugin (older build): unavailable, so callers render
//     the neutral notice rather than a dead button.
//   • No configured API key: unavailable. A paywall that cannot load real
//     StoreKit products must not render — hardcoded prices are how App Store
//     metadata drifts out of truth.
//
// Identity: RevenueCat's app_user_id is the Supabase user id, set at configure
// time. That is what lets the webhook (api/iap/revenuecat) map a purchase to a
// profile row, and what makes a purchase on iPhone unlock the same account on
// the web — the cross-platform access 3.1.3(b) is actually about.

import { detectNativeApp } from "@/lib/platform";

import { IAP_ENTITLEMENT } from "@/lib/iap-shared";
export { IAP_ENTITLEMENT, IAP_PRODUCT_MONTHLY, IAP_PRODUCT_ANNUAL } from "@/lib/iap-shared";

export type IapPackage = {
  /** RevenueCat package identifier (e.g. "$rc_monthly"). */
  identifier: string;
  /** StoreKit product id. */
  productId: string;
  /** Localized price straight from StoreKit — never hardcode around this. */
  priceString: string;
  /** "monthly" | "annual" — resolved from the package type. */
  period: "monthly" | "annual";
  /** Localized intro-offer description when present (e.g. 14-day free trial). */
  introPriceString: string | null;
};

type PurchasesPlugin = typeof import("@revenuecat/purchases-capacitor").Purchases;

let configuredFor: string | null = null;

/**
 * A paywall that silently hides is a revenue outage nobody sees. Every
 * unexpected failure in the native chain reports through /api/client-error
 * (same pipeline as window.onerror) so it lands in the structured server
 * logs. Only fired when actually running in the shell — the web returning
 * "unavailable" is by design, not an error.
 */
function reportIapFailure(stage: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `[iap:${stage}] ${msg}`.slice(0, 480), level: "error" }),
  }).catch(() => {});
}

async function plugin(): Promise<PurchasesPlugin | null> {
  if (!detectNativeApp()) return null;
  if (!process.env.NEXT_PUBLIC_RC_APPLE_API_KEY) {
    reportIapFailure("env", "NEXT_PUBLIC_RC_APPLE_API_KEY missing from bundle");
    return null;
  }
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    return mod.Purchases;
  } catch (e) {
    reportIapFailure("import", e);
    return null;
  }
}

/**
 * Configure the SDK for this signed-in user, once per user per launch.
 * Re-calling with a different uid re-identifies (account switch in the shell —
 * see AccountIsolationGuard for why that path is taken seriously).
 */
export async function ensureIapConfigured(userId: string): Promise<boolean> {
  const p = await plugin();
  if (!p) return false;
  try {
    if (configuredFor === null) {
      await p.configure({
        apiKey: process.env.NEXT_PUBLIC_RC_APPLE_API_KEY as string,
        appUserID: userId,
      });
    } else if (configuredFor !== userId) {
      await p.logIn({ appUserID: userId });
    }
    configuredFor = userId;
    return true;
  } catch (e) {
    reportIapFailure("configure", e);
    return false;
  }
}

/** Whether a purchase can actually be offered right now (native + plugin +
 *  key). Callers MUST gate on this — same fail-closed contract as
 *  canOfferExternalPurchase had. */
export async function canOfferIap(): Promise<boolean> {
  return (await plugin()) !== null;
}

/**
 * The current offering's monthly + annual packages with live StoreKit prices.
 * Returns [] when anything is missing, and the paywall then does not render a
 * purchase UI at all.
 */
export async function getIapPackages(): Promise<IapPackage[]> {
  const p = await plugin();
  if (!p) return [];
  try {
    const { current } = await p.getOfferings();
    const out: IapPackage[] = [];
    for (const pkg of current?.availablePackages ?? []) {
      const period =
        pkg.packageType === "ANNUAL" ? "annual" :
        pkg.packageType === "MONTHLY" ? "monthly" : null;
      if (!period) continue;
      out.push({
        identifier: pkg.identifier,
        productId: pkg.product.identifier,
        priceString: pkg.product.priceString,
        period,
        introPriceString: pkg.product.introPrice?.priceString === "$0.00" || pkg.product.introPrice?.price === 0
          ? "free trial"
          : pkg.product.introPrice?.priceString ?? null,
      });
    }
    return out;
  } catch (e) {
    reportIapFailure("offerings", e);
    return [];
  }
}

export type PurchaseResult = "purchased" | "cancelled" | "failed";

/**
 * Run the StoreKit purchase sheet for a package. On success, nudge the server
 * to reflect the entitlement immediately (api/iap/sync) — the RevenueCat
 * webhook is the durable path, this is the "it unlocks before your thumb
 * leaves the button" path.
 */
export async function purchaseIap(identifier: string): Promise<PurchaseResult> {
  const p = await plugin();
  if (!p) return "failed";
  try {
    const { current } = await p.getOfferings();
    const pkg = (current?.availablePackages ?? []).find((x) => x.identifier === identifier);
    if (!pkg) return "failed";
    const res = await p.purchasePackage({ aPackage: pkg });
    const active = !!res.customerInfo?.entitlements?.active?.[IAP_ENTITLEMENT];
    if (!active) return "failed";
    await fetch("/api/iap/sync", { method: "POST" }).catch(() => {});
    return "purchased";
  } catch (e) {
    const err = e as { code?: string; errorCode?: string; message?: string };
    const code = String(err?.code ?? err?.errorCode ?? "");
    const msg = String(err?.message ?? "");
    if (code === "1" || /cancel/i.test(code) || /cancel/i.test(msg)) return "cancelled";
    return "failed";
  }
}

/** Restore Purchases — required UI on any paywall (Guideline 3.1.2). */
export async function restoreIap(): Promise<boolean> {
  const p = await plugin();
  if (!p) return false;
  try {
    const res = await p.restorePurchases();
    const active = !!res.customerInfo?.entitlements?.active?.[IAP_ENTITLEMENT];
    if (active) await fetch("/api/iap/sync", { method: "POST" }).catch(() => {});
    return active;
  } catch {
    return false;
  }
}

/**
 * Open the App Store's subscription-management page. Apple-billed subs are
 * canceled there, never in the Stripe portal. The Capacitor plugin has no
 * showManageSubscriptions, so this rides the same UIApplication.open native
 * plugin the external-purchase link used — iOS hands apps.apple.com's
 * subscriptions URL to the system sheet.
 */
export async function manageIapSubscription(): Promise<void> {
  if (!detectNativeApp()) return;
  const ext = (window as unknown as {
    Capacitor?: { Plugins?: { ExternalPurchase?: { open: (o: { url: string }) => Promise<unknown> } } };
  }).Capacitor?.Plugins?.ExternalPurchase;
  await ext?.open({ url: "https://apps.apple.com/account/subscriptions" }).catch(() => {});
}
