# Reply to App Review — 1.0.0 (3), submission 82a99a63-430e-4556-90f2-9341a727295c

Paste the block below into **App Store Connect → your app → App Review → Reply
to App Review**, on the rejection thread dated August 17, 2026.

Send it **with** the new build attached, not before. Apple's message says an
information-only answer needs no resubmission, but two of the three items here
are code changes, so this build has to go with it.

Keep it short and factual. Reviewers read a very large number of these; the
useful ones answer the question asked and say where to tap.

---

```
Hello, and thank you for the detailed feedback — it was clear and we have
addressed all three items in build 7.

GUIDELINE 2.1 — "Will the contacts data be uploaded to any server?"

No. The app never accesses the device's address book. It does not link the
Contacts framework, and Info.plist contains no NSContactsUsageDescription, so
iOS would not grant that access even if it were requested.

"Contacts" inside SwiftCard means something different from the iOS address
book: they are leads the user collected through their own digital business
card — people who chose to fill in the "Share your info" form on that card.
Those records are created on our servers in the first place, because that is
what the product does. Nothing is read or copied from the device.

GUIDELINE 3.1.1 — In-App Purchase

Understood, and thank you for pointing to the remedy in your message. Build 7
adds the external purchase link. Wherever a paid feature is gated, the app now
shows a "Subscribe on swiftcard.me" button that opens the DEFAULT BROWSER via
UIApplication.open — not an in-app web view — to our checkout page. Per
Guideline 3.1.1(a), no entitlement is required for this on the United States
storefront.

We have also changed the app's availability to the United States only, so this
purchase path is never offered in a storefront where it is not permitted.

To see it: sign in with the FREE demo account below, open Dashboard →
Traffic → Locations (or Contacts → Add contact → "Scan a business card"). The
plan notice appears with the subscribe button beneath it.

We would also like to correct something in our previous review notes, which
said the app "neither sells, prices, nor links to any purchase flow" while the
demo account we supplied was upgraded to our paid tier. That was contradictory
and unhelpful to your review. The notes for this build describe the app
accurately, and we have supplied two demo accounts so the app can be seen in
its default state as well as with every feature enabled.

GUIDELINES 5.1.1(i) AND 5.1.2(i) — third-party AI

Correct, and fixed. Before any data reaches an AI service, the app now shows a
notice that:

  • names the recipient — Google;
  • itemises exactly what is sent — the photo taken when scanning a business
    card, a contact's name/company/where you met/your notes when AI drafts a
    follow-up, and messages typed to the in-app assistant;
  • offers "Allow" and "Don't allow".

"Don't allow" is enforced on our servers, not only in the interface: a declined
account is refused by the card scanner, follow-up drafts, sequence generation
and design-rebuild endpoints before any data is assembled or sent.

Our privacy policy at https://swiftcard.me/privacy now names Google and
describes the same four data paths.

To see it: sign in with either demo account and open Contacts. The notice
appears before the first AI feature is used.

DEMO ACCOUNTS — please use the Free one first

  Free (the app's default state, shows the plan gates and purchase link):
    applereview-free@swiftcard.me
    <password>

  Pro (so every feature can be exercised without payment):
    applereview@swiftcard.me
    <password>

Thank you again for the review. If anything above is unclear, or you would
prefer a different approach to the purchase link, we are glad to discuss it.
```

---

## Before sending, check

- [ ] Both passwords filled in above (they are not stored in this repo).
- [ ] Build 7 uploaded, processed, and attached to version 1.0.0.
- [ ] App Review Information notes replaced with `APP_REVIEW_NOTES.md`.
- [ ] Username/password fields hold the **Free** account.
- [ ] Availability is United States only (done — verified via the API).
- [ ] The subscribe button tested on a device: tapping it leaves SwiftCard and
      opens Safari as a separate app, not a sheet inside the app.
