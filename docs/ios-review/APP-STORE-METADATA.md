# App Store Connect — Copy-Paste Metadata Pack

_Every field pre-written. Fill App Store Connect top-to-bottom from this file._

## App Information

| Field | Value |
|---|---|
| Name | **SwiftCard — Digital Business Card** (30-char limit: "SwiftCard: Digital Card & CRM") |
| Subtitle (30 chars) | `Share your card. Keep leads.` |
| Bundle ID | `me.swiftcard.app` |
| Primary category | Business |
| Secondary category | Productivity |
| Content rights | Does not contain third-party content |
| Age rating | 4+ (all questionnaire answers "No") |

## Pricing & Availability
- Price: **Free** (no in-app purchases configured — subscriptions exist only on the website and are never sold or shown in the app)
- Availability: all countries (or start US-only if preferred)

## Promotional Text (170 chars, editable without review)
```
Your business card, reinvented. Share everything in one tap, capture every
person you meet, and let SwiftCard handle the follow-ups for you.
```

## Description
```
SwiftCard is the digital business card that does the follow-up for you.

SHARE IN ONE TAP
Your card lives at your own link and QR code. Anyone can open it — no app
needed on their end. Add it to your Apple Wallet so it's always one tap away.

NEVER LOSE A LEAD
When someone views your card, they can share their details back. Every
contact lands in your SwiftCard dashboard with notes, tags, reminders, and
follow-up status — a lightweight CRM built for real-world networking.

SCAN PAPER CARDS
Got a paper business card? Scan it with your camera and SwiftCard turns it
into a saved contact automatically.

SWIFT LINKS
One page for everything you do — your links, socials, calendar, and content,
beautifully presented and trackable.

SEE WHAT WORKS
Know when your card is viewed, where your leads come from, and which day was
your best. Real analytics for real networking.

FOR TEAMS
Companies use SwiftCard Office to give every employee an on-brand card, with
shared leads and team-wide analytics.

Manage your existing SwiftCard account, cards, contacts, and follow-ups —
all from your iPhone.
```

## Keywords (100 chars)
```
business card,digital card,nfc,qr,networking,crm,leads,contacts,linktree,vcard,follow up,sales
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

- Sign-in required: **Yes** — provide the demo account:
  - Email: `applereview@swiftcard.me`
  - Password: (from running `node scripts/create-apple-review-account.js` — run once, save the printed password)
- Contact: Menash Harooni, menashharooni@gmail.com, +1 (your phone)
- **Notes for the reviewer** (paste verbatim):
```
SwiftCard is a companion app for managing an existing SwiftCard account
(digital business cards + contact management). Notes:

1. No purchases: subscriptions are sold only on our website. The app neither
   sells nor links to any purchase flow, per guideline 3.1.3(a) reader/companion
   behavior. The demo account is already on the Pro tier so every feature is
   visible.
2. Sign in with Apple is offered alongside Google and email/password.
3. Account deletion is available in-app: Settings → Advanced account
   settings → Delete account.
4. The card scanner (camera) is used to digitize paper business cards; photo
   library access is for the user's card photo/logo.
5. Universal links: opening a swiftcard.me/card/* link opens the card in-app.
```

## Screenshots (take on device after first build)
Required: 6.7" (iPhone 15 Pro Max class) and 6.1". Suggested five:
1. Dashboard with a populated card + analytics
2. The public card page (what a lead sees)
3. Contacts/leads list with tags + follow-up statuses
4. Card scanner mid-scan
5. Swift Links page

## Version
- 1.0.0, build 1. "What's New": `Your digital business card, now on iPhone.`
