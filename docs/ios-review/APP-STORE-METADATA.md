# App Store Connect — Copy-Paste Metadata Pack

_Every field pre-written. Fill App Store Connect top-to-bottom from this file._

**This file mirrors what is in App Store Connect.** The listing is written
through the API (`scripts/lib/asc.mjs`), and the copy below is the same copy
that was PATCHed there on 2026-09-05 and verified by re-reading — change one
and change the other in the same commit. Field limits: name 30, subtitle 30,
promotional text 170, keywords 100, description 4000, review notes 4000.

## App Information

| Field | Value |
|---|---|
| Name | **SwiftCard: Business Card** (bare "SwiftCard" is already taken on the store; "SwiftCard: Digital Business Card" is 32 chars and cannot fit) |
| Subtitle (30 chars) | `Digital business card & links` |
| Bundle ID | `me.swiftcard.app` |
| Primary category | Business |
| Secondary category | Productivity |
| Content rights | Does not contain third-party content |
| Age rating | Use the 2025 questionnaire (mandatory since Jan 31 2026) — answer the UGC questions truthfully (public user cards + report/takedown exist); accept the computed rating. See app-store/APP_STORE_CONNECT_CHECKLIST.md §4 |

## Pricing & Availability
- Price: **Free**, with two auto-renewable In-App Purchases in the group
  "SwiftCard Pro": `me.swiftcard.app.pro.monthly` ($4.99) and
  `me.swiftcard.app.pro.annual` ($53.99), each with a 14-day free trial.
  In-App Purchase is the app's ONLY purchase path (guideline 3.1.1); web
  subscribers also get Pro in the app (3.1.3(b)).
- Availability: United States.

## Promotional Text (170 chars, editable without review)
```
Your business card as a link. Share it by QR, NFC or Apple Wallet, collect every contact you meet, and let SwiftCard write the follow-up. Free to start.
```

## Description
```
SwiftCard turns your business card into a link. Share it with a QR code, an NFC card, or Apple Wallet. The other person opens it on their phone and saves you in one tap. No app needed on their end.

Everything you need to meet people and follow up, in one place:

YOUR DIGITAL BUSINESS CARD
Build a card with your photo, logo, title, phone, email and website. Pick a design or customize the colors and fonts. Share it by link, QR code or NFC tag, or add it to Apple Wallet so it's always one tap away. Edit it any time. Every QR code and NFC card you've already handed out keeps working, because they point to your link, not a copy.

SWIFT LINKS: YOUR LINK-IN-BIO PAGE
Every card comes with a Swift Links page: your photo, bio, social icons, video previews and custom buttons on one page. Put it in your Instagram, TikTok or LinkedIn bio.

SWIFT SIGNATURE: YOUR CARD IN EVERY EMAIL
Turn your card into an email signature for Gmail, Outlook and Apple Mail in two taps.

CAPTURE EVERY CONTACT
When someone opens your card, they can share their name, email and phone back to you. Everyone lands in your Contacts with notes, tags and follow-up status. A simple CRM built for real-world networking.

SCAN PAPER BUSINESS CARDS
Point your camera at a paper card and SwiftCard turns it into a saved contact.

AUTOMATIC FOLLOW-UPS
Pick a cadence and SwiftCard writes and sends personalized follow-up emails and texts for you, so nobody you meet is forgotten.

SEE WHO'S LOOKING
Get a notification the moment someone views your card. See how many people opened it, where they were, and which day was your best.

WORKS WITH YOUR CRM
Send every new contact to HubSpot, Salesforce, HighLevel, Pipedrive or Google Contacts automatically, or connect anything else with Zapier.

HOME-SCREEN WIDGET
Your card's QR code on your home screen, ready to scan.

FOR TEAMS
SwiftCard Office gives every employee an on-brand card, with shared contacts and team-wide analytics.

Free to start with one card, your Swift Links page, Swift Signature, and up to 5 new contacts a month.

SWIFTCARD PRO
Unlimited cards and contacts, unlimited AI follow-up drafts, the business-card scanner, the full card designer, detailed analytics, and no SwiftCard branding on your messages.

- SwiftCard Pro Monthly: $4.99 per month
- SwiftCard Pro Annual: $53.99 per year
Both start with a 14-day free trial.

Payment is charged to your Apple Account at confirmation of purchase. The subscription renews automatically unless it is canceled at least 24 hours before the end of the current period, and your Apple Account is charged for renewal within 24 hours before the current period ends. You can manage or cancel your subscription in your Apple Account settings after purchase. Any unused portion of a free trial is forfeited when you purchase a subscription.

Terms of Use: https://swiftcard.me/terms
Privacy Policy: https://swiftcard.me/privacy
```

## Keywords (100 chars)
Do not repeat words already in the name or subtitle — Apple indexes those
for free, so "business card", "digital" and "links" would be wasted characters.
```
nfc,qr,networking,crm,leads,contacts,linktree,vcard,follow up,sales,scanner,wallet,link in bio,ecard
```

## What's New (1.0.1)
```
Push notifications now work. Turn them on in Settings and get an alert the moment someone views your card or shares their details with you.

Also fixed: tapping a swiftcard.me link now opens in the app, and the home-screen widget shows your card's QR code.
```

## URLs
| Field | Value |
|---|---|
| Support URL | https://swiftcard.me/contact |
| Marketing URL | https://swiftcard.me |
| Privacy Policy URL | https://swiftcard.me/privacy |

## App Privacy (nutrition labels)

Data types collected — declare exactly these:

| Data type | Linked to user? | Tracking? | Purpose |
|---|---|---|---|
| Contact Info → Name | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | No | App Functionality |
| User Content → Photos or Videos (card photo/logo uploads) | Yes | No | App Functionality |
| User Content → Other (leads/contacts the user saves) | Yes | No | App Functionality |
| Identifiers → User ID | Yes | No | App Functionality |
| Usage Data → Product Interaction (card-view analytics) | No (visitor analytics are pseudonymous) | No | Analytics |

- "Data used to track you": **None** (no cross-app tracking, no ad SDKs).
- Card VISITORS are not app users; their view analytics use a random
  device-scoped id, no account, no IP stored — that's why Usage Data is
  "not linked."

## App Review Information

- Sign-in required: **Yes** — two demo accounts, same password (set by
  `node scripts/create-apple-review-account.js`; the password lives only in
  the ASC review-detail field, never in this repo):
  - `applereview-free@swiftcard.me` — **must be on plan `free`**. It is the
    account the reviewer uses to exercise In-App Purchase, so every gate and
    the paywall have to be reachable from it. A sandbox purchase during a
    review flips it to `pro` (RevenueCat webhook, `_planSource: apple`) —
    reset it before every submission or the paywall is unreachable, which is
    the exact shape of the 5th rejection.
  - `applereview@swiftcard.me` — Pro, set from our admin, no subscription
    attached anywhere.
  - Both: clear `customization._aiConsent` before every submission so the
    5.1.1 consent dialog appears for the reviewer.
- Contact: Menash Harooni, menashharooni@gmail.com, +1 917 905 7335
- **Notes for the reviewer** (paste verbatim):
```
SwiftCard is the iPhone and iPad app for SwiftCard (swiftcard.me), a digital business card and contact-capture service. The app manages your own account: your cards, the people who shared their details with you, follow-ups, and analytics.

WHAT IS IN 1.0.1
A bug-fix release. Builds up to 1.0.0 were signed without their entitlements, so push notifications, Universal Links and the home-screen widget did not work on device. 1.0.1 fixes that. No new features, no change to purchasing, no change to data handling.

IN-APP PURCHASE (3.1.1)
Pro is sold only through In-App Purchase: two auto-renewable subscriptions in the group "SwiftCard Pro", each with a 14-day free trial.
  - me.swiftcard.app.pro.monthly
  - me.swiftcard.app.pro.annual
There is no external purchase link and no price anywhere in the app except the StoreKit paywall. Reach it at Settings > Plan and billing > "Upgrade to Pro", from any locked Pro feature, or from the plan step when creating a first card. The paywall shows StoreKit prices only and includes Restore Purchases, Terms of Use, Privacy Policy and the auto-renewal disclosure. Per 3.1.3(b), customers who subscribed on our website can also use Pro in the app, because Pro is purchasable in the app.

THIRD-PARTY AI (5.1.1 / 5.1.2)
Before any personal data reaches the AI service, a dialog names the recipient (Google), itemises exactly what is sent (the photo taken when scanning a business card; a contact's name, company, where you met and notes when AI drafts a follow-up; messages typed to the assistant), and offers equal Allow / Don't allow choices. This is enforced on our servers: until an account has explicitly allowed, every AI endpoint refuses requests from the app. Our privacy policy at swiftcard.me/privacy names Google (the Gemini API), lists each category of data sent and its purpose, and states that inputs are not used to train models. Both demo accounts have had their choice reset, so the dialog appears the first time an AI feature is used.

DEMO ACCOUNTS (both use the password in the field below)
  1. applereview-free@swiftcard.me: a Free account. Use this one to exercise the In-App Purchase; every plan gate and the paywall are reachable from it.
  2. applereview@swiftcard.me: set to Pro by us from our own admin so you can see the Pro feature set without a sandbox purchase. No subscription of any kind is attached to it, through Apple or otherwise.

PUSH NOTIFICATIONS
Turn them on in Settings, then open that account's card link (shown on its dashboard under Share) from another device or browser. A notification arrives within a few seconds of the card being viewed.
```

## Screenshots
One 6.9-inch iPhone set at 1320 × 2868 px, nine frames, in
`app-store/screenshots/6.9-inch-v2` — its README explains the persona, the
design choices and how to regenerate. Search results show the first three,
so the story lands there: your card → they save you → every lead in your
pocket. Upload with `scripts/asc-upload-screenshots.mjs` targeting the
pending version's localization id; it deletes and recreates the set so the
listing mirrors the directory exactly.

## Version
- 1.0.1, build 11. "What's New": `Push notifications now work — get alerted the
  moment someone views your card or saves their details. Also fixes Universal
  Links and the home-screen widget.`
  (Build 11 is the ENTITLEMENTS FIX. Every build up to and including build 10 —
  the one live on the App Store — shipped with an empty entitlement set: the
  archive was created with CODE_SIGNING_ALLOWED=NO, which skips the step that
  compiles CODE_SIGN_ENTITLEMENTS into a .xcent, and exportArchive then signed
  the app with only application-identifier + team-identifier. The provisioning
  profile granted aps-environment=production, the app group and the associated
  domain; the binary carried none of them. Push registration therefore failed
  on every device with "no valid aps-environment entitlement string found",
  Universal Links fell through to Safari, and the widget could not read the
  shared App Group container. scripts/ios-release.sh now signs the archive with
  the distribution profile and REFUSES to upload an .ipa whose real, embedded
  entitlements are missing any of the three.)
- 1.0.0, build 10 shipped 2026-09-02 and remains live.
  (Build 9 is the IAP-era binary: RevenueCat SDK + the NativePaywall sell Pro
  in-app per the 4th rejection's 3.1.1/3.1.3(b) demand, and apps.apple.com is
  allow-listed in the ExternalPurchase plugin so "Manage subscription" opens
  the App Store's subscription page — in build 8 that button was silently
  dead. Build 8 was uploaded but never submitted; build 7 was the rejected
  external-link-only attempt. Availability remains United States only.)
