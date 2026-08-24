// Identifiers shared by the client SDK wrapper (lib/iap.ts, "use client") and
// the server routes (api/iap/*). Must match RevenueCat and App Store Connect
// exactly; the ASC products are created by scripts/asc-iap-setup.mjs.

export const IAP_ENTITLEMENT = "pro";
export const IAP_PRODUCT_MONTHLY = "me.swiftcard.app.pro.monthly";
export const IAP_PRODUCT_ANNUAL = "me.swiftcard.app.pro.annual";
