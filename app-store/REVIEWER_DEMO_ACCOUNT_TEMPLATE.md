# Reviewer Demo Account — Template

_NO real passwords in this repo. This file is the template; the owner fills
the password into App Store Connect only._

## Creating the account

```bash
node scripts/create-apple-review-account.js
```

- Creates `applereview@swiftcard.me` on the **Pro** tier with a fully
  populated demo card (fictional persona **Alex Chen, Founder & Principal at
  Northbeam Studio** — never real customer data), plus **3 seeded demo
  contacts** (Jordan Rivera, Priya Nair, Marcus Webb) and **~24 card views**
  across the last 4 weeks so Contacts, the pipeline, and Analytics all show
  real activity for the reviewer.
- The password prints ONCE. Store it in your password manager, paste it into
  App Store Connect → App Review Information, and nowhere else.
- Re-running the script resets the account/password (safe to rotate after
  each review cycle).

## What the reviewer account must demonstrate (verify before every submission)

- [ ] Signs in with email + password on a clean install.
- [ ] Dashboard shows a populated business card with a working QR.
- [ ] Public card link opens (universal link) and shows the share-back form
      and the "Report this card" link at the bottom.
- [ ] Contacts list contains 2–3 FICTIONAL demo leads with tags/statuses.
- [ ] Analytics shows non-zero demo views.
- [ ] Swift Links page is populated.
- [ ] Apple Wallet add works.
- [ ] Settings → Advanced account settings → Delete account is reachable
      (reviewer may test deletion — if they do, RE-RUN the script before the
      next submission; deletion is real).
- [ ] No pricing, upgrade, billing, or Stripe surface is visible anywhere
      while signed in as this account inside the app.

## App Store Connect fields

| Field | Value |
|---|---|
| Username | `applereview@swiftcard.me` |
| Password | `<from the script run — DO NOT write it here>` |

## Notes

- The account is on Pro WITHOUT a Stripe subscription (plan set directly),
  so no real billing exists behind it and nothing can auto-renew or charge.
- Demo leads/analytics are fictional; the card belongs to a fictional persona
  (Alex Chen / Northbeam Studio) — keep it that way. All seeded contacts use
  `example.com` emails and `555-01xx` phone numbers.
