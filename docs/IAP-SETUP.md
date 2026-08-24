# In-App Purchase setup — what's done, and Menash's 15 minutes

The 3.1.1 remedy (2026-08-24): SwiftCard Pro is now sold in the iOS shell via
Apple In-App Purchase, through RevenueCat. The code, tests, App Store Connect
products, and Vercel webhook token are all in place. What remains is the
RevenueCat account itself (needs a human signup) and two Apple-side agreements
only the account holder can click.

## Already done (no action)

- **ASC products** (created via API by `scripts/asc-iap-setup.mjs`):
  subscription group **SwiftCard Pro** (id 22332803) with
  `me.swiftcard.app.pro.monthly` ($4.99/mo, id 6804832192) and
  `me.swiftcard.app.pro.annual` ($53.99/yr, id 6804832278), each with a 14-day
  free-trial intro offer, US availability, en-US localization. State:
  MISSING_METADATA — they still need a review screenshot, which we'll attach
  when the paywall runs in the simulator, before the next submission.
- **Client**: `lib/iap.ts` + `components/NativePaywall.tsx` (StoreKit prices
  only, Restore Purchases, Terms/Privacy links, renewal disclosure), wired into
  every PlanGate notice and the billing panel. Fail-closed everywhere.
- **Server**: `/api/iap/revenuecat` (webhook → plan grants/revokes, source-
  guarded against Stripe collisions — see `lib/iap-entitlement.ts`) and
  `/api/iap/sync` (instant unlock after purchase, verified against RC's API).
- **Native**: `@revenuecat/purchases-capacitor` in the Capacitor SPM set;
  packages resolve.
- **Vercel prod**: `REVENUECAT_WEBHOOK_TOKEN` set (value also at
  `~/.swiftcard/revenuecat-webhook-token.txt`).

## Menash — RevenueCat (10 min, needs your signup)

1. Create the account at revenuecat.com (free tier covers us until $2.5k/mo).
2. New Project → add an **App Store** app, bundle id `me.swiftcard.app`.
3. In App Store Connect → Users and Access → Integrations → **In-App Purchase**
   keys: generate a key, download the .p8, upload it to RevenueCat (it asks for
   key id + issuer id too). This is a DIFFERENT key type from our ASC API key —
   it can only be created in the browser.
4. RevenueCat → Entitlements: create entitlement **`pro`**; attach both
   products (`me.swiftcard.app.pro.monthly`, `me.swiftcard.app.pro.annual`).
5. RevenueCat → Offerings: the `default` offering with a **Monthly** package →
   monthly product and an **Annual** package → annual product.
6. RevenueCat → Integrations → Webhooks: URL
   `https://swiftcard.me/api/iap/revenuecat`, Authorization header value:
   `Bearer <contents of ~/.swiftcard/revenuecat-webhook-token.txt>`.
7. Project → API keys: copy the **public Apple key** (`appl_…`) and a
   **secret key** (`sk_…`), then add to Vercel prod:
   `NEXT_PUBLIC_RC_APPLE_API_KEY` and `REVENUECAT_SECRET_KEY` — and redeploy
   (the NEXT_PUBLIC one bakes in at build time).

## Menash — Apple agreements (5 min, account holder only)

1. App Store Connect → Business (or Agreements, Tax, and Banking): sign the
   **Paid Applications agreement** and complete banking + tax forms. Products
   cannot go live without this, and it's browser-only.
2. Enroll in the **Small Business Program** (15% instead of 30%):
   developer.apple.com/app-store/small-business-program — needs the account
   holder to attest.

## Before the next submission (we do together — NOT yet)

- Attach a paywall screenshot to each subscription's review metadata.
- Switch the version to **manual release** (currently auto-publishes).
- Include both subscriptions in the review submission alongside the build.
- Send the Resolution Center reply (drafts in docs/).
- The resubmission itself stays locked behind `ASC_SUBMIT_UNLOCKED` until
  Menash says go.
