# App Review Notes (paste into App Store Connect → App Review Information → Notes)

_Also see REVIEWER_DEMO_ACCOUNT_TEMPLATE.md for the credentials block._

```
SwiftCard is the iPhone app for SwiftCard (swiftcard.me), a digital business
card + lead-capture service. The app is for managing your own account: your
cards, the people who shared their details with you, follow-ups, and analytics.

WHY IT'S MORE THAN A WEBSITE
- Sign in with Apple and Google run in the system browser sheet and return to
  the app; sessions persist natively.
- Push notifications: enable in Settings → Notifications; capturing a lead on
  your card produces a real APNs notification that deep-links to the contact.
- Apple Wallet: Dashboard → Share → "Add to Apple Wallet" produces a signed
  pass with your live QR code.
- Native share sheet, camera-based paper-business-card scanning, universal
  links (swiftcard.me/card/* links open in the app), home-screen QR widget,
  offline launch fallback.

PURCHASES
There are none. Subscriptions exist only on our website; the app neither
sells, prices, nor links to any purchase flow (Guideline 3.1.1 — nothing is
unlocked in-app). The demo account is pre-upgraded to the Pro tier so every
feature is visible without any payment.

HOW TO TEST THE MAIN FLOWS
1. Sign in with the demo account below (or create a fresh free account —
   email/password, Google, and Apple all work).
2. Dashboard: the demo card is populated. Tap Share → QR / Wallet / share sheet.
3. Open the public card: visit the demo card's link from the share sheet —
   it opens inside the app via universal link. A "Report this card" link
   sits at the bottom of every public card (our UGC reporting mechanism;
   reports go to hello@swiftcard.me and are handled within one business day;
   our admin console can take any reported card offline).
4. Lead capture: on the public card, tap "Share your info back" and submit —
   the contact appears in the app's Contacts with tags/reminders, and (if
   push is enabled) a notification arrives.
5. Card scanner: Contacts → Add → Scan a paper card (camera permission is
   requested only at that point).
6. Analytics: Dashboard → Analytics shows views/sources for the demo card.
7. Account deletion: Settings → Advanced account settings → Delete account
   (survey → typed DELETE confirmation → password re-check). Data is held 30
   days for account recovery, then permanently purged, as disclosed in-app
   and in the privacy policy.

PERMISSIONS USED
Camera (scan paper business cards), Photo Library (choose a card photo/logo),
Notifications (lead alerts, opt-in via an in-app toggle). No tracking; no ATT
prompt (we have no ad SDKs and do no cross-app tracking).

TEAMS ("Office") ACCOUNTS
Companies buy team plans on the website. In the app, team members sign in and
use their organization-assigned cards; team billing and seat purchasing are
website-only and are not shown in the app.

NOTHING TO BUY, NOTHING EXTERNAL
External links on a card (a user's social profiles, websites) open in the
system browser by design. swiftcard.me content stays in-app.
```

## Contact fields

- First name / Last name: Menash Harooni
- Email: menashharooni@gmail.com
- Phone: (owner fills in — required field)
