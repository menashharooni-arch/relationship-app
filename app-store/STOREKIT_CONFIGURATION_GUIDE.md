# StoreKit / Payments Posture — Decision Record & Future Guide

## v1 decision: the app sells NOTHING (no StoreKit, no external links)

**This is deliberate and compliant.** Verified against the July 2026 App
Review Guidelines:

- **3.1.1** requires in-app purchase only "if you want to unlock features or
  functionality within your app." SwiftCard's iOS app unlocks nothing: free
  accounts are fully functional (create a card, share, capture leads), and
  paid tiers are sold exclusively on the website with every selling surface
  suppressed in the shell. No IAP obligation is triggered.
- **3.1.3(b) multiplatform services** lets users access content/subscriptions
  acquired on other platforms. A web-Pro subscriber signs in and simply has
  Pro features — the long-accepted Netflix/Spotify "you can't sign up here"
  posture, minus even a mention of where to buy.
- **US external-link option (post-Epic, 3.1.1(a))**: external purchase links
  are currently permitted on the US storefront without an entitlement, BUT
  the Dec 2025 appeals ruling restored Apple's ability to commission those
  purchases (rate pending). Adding a link buys review complexity, commission
  exposure, and reporting duties for zero v1 benefit. **Do not add one.**

### What this means operationally

- Never create IAP products in App Store Connect for this app version.
- The reviewer notes state plainly: "There are none" (purchases).
- Web Stripe billing continues untouched for web users; the app's suppression
  layer (PlanGate/NativeHidden/useIsNativeApp + render guards on /pricing,
  /upgrade, /checkout + server AI guardrails) keeps every price and purchase
  path out of the shell. Guard tests: `tests/ios-final-audit.test.ts`,
  `tests/native-suppression.test.ts`, `tests/plan-gate*.test.ts`.
- **No double-billing risk exists** because there is exactly one biller
  (Stripe, web). Nothing to reconcile.

### Office / Teams in v1

Office is organization-purchased on the web (3.1.3(b) enterprise-style
access). Members and owners use team features in-app; seat purchase, seat
removal pricing, proration, and the Stripe portal are all web-only and
native-suppressed. Document to reviewer as "team billing is website-only."

## If/when IAP is added later (v2+): the correct architecture

Do NOT bolt StoreKit into the webview. The remote-URL shell cannot ship
untestable purchase code; a future IAP release requires:

1. **App Store Connect products** (create first — code needs real ids):
   - `me.swiftcard.app.pro.monthly` — auto-renewable, group "SwiftCard Pro"
   - `me.swiftcard.app.pro.annual` — same group, annual
   (Office seats should stay web-sold; per-seat quantities don't map to
   Apple subscription groups without one-product-per-seat-count hacks.)
2. **Native purchase bridge**: a small Capacitor plugin (Swift, StoreKit 2)
   exposing loadProducts / purchase / restore / currentEntitlements to the
   webview; UI stays in the web layer but ONLY the native branch renders it.
3. **Server-side truth**: App Store Server API + App Store Server
   Notifications V2 endpoint → verify signed transactions (JWS) server-side →
   map `appAccountToken` (set to the Supabase user id at purchase) →
   entitlement rows in Supabase. Never trust a client "paid" flag.
4. **Coexistence rules** (prevents double billing):
   - A user with an active web Stripe sub sees no Apple purchase UI (server
     flag drives the native UI).
   - A user with an Apple sub manages it via Apple's manage-subscription
     sheet; the web billing page shows "billed through Apple" and hides
     Stripe actions for them.
   - Entitlement resolution order: active Stripe sub OR active Apple sub →
     Pro; never both purchasable simultaneously.
5. **Deletion**: 5.1.1 notice — deleting the account does not cancel an Apple
   subscription; deletion flow must tell Apple-billed users to cancel in
   Settings → Apple ID → Subscriptions (add this string only when IAP ships).
6. **Testing**: .storekit configuration file in the Xcode project +
   StoreKitTest unit tests + sandbox account passes BEFORE review.

Until every item above is done and device-tested, IAP stays out of the app —
shipping a half-wired StoreKit flow is a guaranteed 2.1 rejection, far worse
than selling nothing.
