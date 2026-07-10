# SwiftCard on Apple Watch — capability verdict & backend prep

**Status: NOT a shipping feature. This document is an honest investigation, not a
promise.** SwiftCard is a web app (Next.js). There is **zero** Swift / Xcode /
watchOS code in this repository, and none can be added here — a watchOS app is a
separate native project that ships through the App Store, not from a website.

## TL;DR verdict

| Question | Answer |
|---|---|
| Can a website put a "real" SwiftCard app on the Apple Watch? | **No.** watchOS apps are native (SwiftUI/WatchKit), built in Xcode, distributed via the App Store. A website cannot install one. |
| Is there *any* real Apple Watch touchpoint we can offer today? | **Yes — Apple Wallet.** The `.pkpass` we already generate (`/api/wallet/pass`) is added to **iPhone** Wallet and then **automatically surfaces on the paired Watch**. That is the one genuine, already-working Watch surface. |
| What did we build now? | A **read-only sync API contract** (`/api/watch/card`) + a versioned JSON model (`src/lib/watch-contract.ts`) so a *future* native app has a defined, tested backend to call. Nothing is exposed to users as "Watch support." |

## What is technically possible from THIS repo (web-only)

1. **Apple Wallet pass → shows on Watch (already implemented).**
   `GET /api/wallet/pass?card=<username>` returns a signed `.pkpass`. When a user
   adds it on their iPhone, iOS syncs it to the paired Apple Watch's Wallet. On
   the Watch it renders the card's name/title/company and a QR/barcode a
   recipient can scan. This is the **only** real Watch presence a website can
   deliver, and it already exists. Requires the Apple Wallet certificate env vars
   (see `.env.example` → "Apple Wallet pass"); when unset, the route returns
   `501 not_configured` and nothing breaks.

2. **A backend the future native app would call (built now, not user-facing).**
   `GET /api/watch/card` returns the signed-in user's card(s) in a stable,
   versioned JSON contract (`WATCH_API_VERSION`, see `src/lib/watch-contract.ts`).
   - **Auth model (honest):** SwiftCard's normal auth is a Supabase **session
     cookie** for the web app. A watchOS app can't use that cookie, so the
     endpoint **also** accepts the user's Supabase **access token** as
     `Authorization: Bearer <jwt>` — the same Supabase identity a native app
     would obtain after the user signs in. No new/parallel auth system was
     invented.
   - It's a read-only projection of data the user already owns (name, title,
     company, phone, email, website, photo/logo URLs, card URL, wallet-pass URL,
     and a QR value). It fakes nothing native.

## What CANNOT be done from a website (requires a native project)

- **Installing an app on the Watch.** Needs a watchOS target in Xcode, an Apple
  Developer paid membership, provisioning profiles/certificates, and App Store
  (or TestFlight) distribution.
- **A Watch complication / always-on card, a native share sheet, or NFC tap.**
  All require native watchOS APIs. See `docs/NFC.md` for why NFC specifically is
  a hard no on the Watch for third parties.
- **Background sync / push to the Watch.** Native `WatchConnectivity` +
  APNs-backed delivery, none of which a web app can perform.

## What building the real native feature would require (separate work, NOT here)

1. A new **Xcode project** with a watchOS app target (SwiftUI + WatchKit) — and
   almost certainly a companion iOS app, since watchOS apps historically ship
   paired with an iOS app.
2. **Apple Developer Program** membership ($99/yr), signing certificates, App IDs
   and provisioning profiles.
3. A **sign-in flow** in the native app against Supabase Auth, then calls to
   `GET /api/watch/card` with the `Bearer` token. (The contract this repo now
   defines is exactly what it would consume — that's the point of building it.)
4. Rendering the card + QR natively, and optionally a **complication**.
5. App Store review + distribution.

None of steps 1–5 can happen in this web repository.

## Where the code lives

- Contract + projection (pure, unit-tested): `src/lib/watch-contract.ts`
- Sync endpoint: `src/app/api/watch/card/route.ts`
- Tests: `tests/watch-contract.test.ts`
- The real Watch touchpoint (Wallet): `src/app/api/wallet/pass/route.ts`

## Sources
- Apple Watch NFC is limited to Apple Pay / Wallet-style secure credentials;
  there is no third-party NFC SDK on watchOS and no Core NFC on the Watch.
  (Apple Developer Forums; GoToTags Core NFC overview — see `docs/NFC.md`.)
