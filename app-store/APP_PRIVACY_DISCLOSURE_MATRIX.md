# App Privacy Disclosure Matrix

_Source of truth for: App Store Connect privacy labels, ios/App/App/PrivacyInfo.xcprivacy,
and the public privacy policy (https://swiftcard.me/privacy). All three must stay in sync.
Verified against actual code paths on 2026-07-17._

## Data inventory

| Data | Collected? | Linked to user? | Tracking? | Purpose | Shared with | Retention / deletion |
|---|---|---|---|---|---|---|
| Name | Yes (account + card) | Yes | No | App Functionality | Supabase (processor) | Until account deletion → 30-day hold → hard purge |
| Email address | Yes (account, leads) | Yes | No | App Functionality | Supabase, Resend (email delivery), Stripe (web billing only) | Same |
| Phone number | Yes (card field, leads) | Yes | No | App Functionality | Supabase, Twilio (only if SMS follow-up used) | Same |
| Physical address | Optional card field | Yes | No | App Functionality | Supabase | Same |
| Photos | Yes (card photo/logo uploads; camera used for card scanning) | Yes | No | App Functionality | Supabase Storage (public bucket for published card images) | Same; storage objects purged with account |
| Contacts (leads) | Yes — people who submit their info on a user's card | Yes (to the card owner) | No | App Functionality | Supabase | Purged with account; leads deletable individually |
| Company / title / links | Yes (card content) | Yes | No | App Functionality | Supabase | Same |
| User ID | Yes (Supabase auth id) | Yes | No | App Functionality | Supabase | Deleted at hard purge |
| Purchase history | NOT in the iOS app (no purchases exist). Web Stripe history exists server-side | Yes (web) | No | App Functionality (web billing) | Stripe | Stripe retention rules; app shows no purchase data |
| Subscription status (plan tier) | Yes (drives feature availability) | Yes | No | App Functionality | — | With account |
| Product interaction / usage | Yes — card-view + product analytics | Card-OWNER analytics: yes. VISITOR analytics: pseudonymous random id, not linked | No | Analytics | PostHog (first-party product analytics, only if NEXT_PUBLIC_POSTHOG_KEY set), Supabase | Purged with account |
| Crash / diagnostics | Not collected by us (no crash SDK). Apple's own opt-in crash reporting only | — | No | — | — | — |
| Location | NOT collected (no location APIs, no permission string) | — | — | — | — | — |
| Identifiers (IDFA/device) | NOT collected. No ad SDKs, no fingerprinting | — | — | — | — | — |
| Customer support data | Yes (contact form / report submissions) | Yes (if email given) | No | App Functionality | Resend → hello@swiftcard.me | Mailbox retention |
| Fraud signals | Account IP at signup, coarse device signature, Stripe one-way card hash (referral abuse prevention — disclosed in policy) | Yes | No | App Functionality (fraud) | — | With account |

## App Store Connect privacy label answers

Declare **Data Linked to You**: Name, Email Address, Phone Number, Physical
Address (optional field), Photos or Videos, Other User Content (cards, links,
leads, support messages), User ID, Product Interaction (owner analytics).

Declare **Data Not Linked to You**: Product Interaction (visitor/card-view
analytics — pseudonymous device-scoped id, no account, not traceable back).

Declare **Data Used to Track You**: **None.**

Purposes: App Functionality for everything; Analytics additionally for
Product Interaction. No third-party advertising, no developer advertising.

## Third parties (processors)

Supabase (database/auth/storage), Vercel (hosting), Stripe (web billing only),
Resend (transactional email), Twilio (SMS follow-ups, feature-gated), PostHog
(first-party product analytics), Upstash (rate limiting — no personal data
beyond keyed ids), Google Gemini (business-card scan text extraction —
image content only, per policy). All disclosed in the privacy policy.

## PrivacyInfo.xcprivacy (shipping in the app bundle)

- `NSPrivacyTracking`: false; no tracking domains.
- Required-reason APIs: `NSPrivacyAccessedAPICategoryUserDefaults` with
  `CA92.1` (app's own defaults via @capacitor/preferences) and `1C8F.1`
  (App Group `group.me.swiftcard.app` shared with the SwiftCardWidget
  extension). The widget's own manifest declares `1C8F.1` only.
- Collected-data types mirror the matrix above.

## ATT (App Tracking Transparency)

Not required and not shown: the app performs no tracking as Apple defines it
(no cross-app/ site data linkage for advertising, no data brokers, no ad SDKs
— verified by dependency sweep). Do NOT add an ATT prompt; showing one while
declaring "no tracking" is itself a review flag.
