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
- Re-running the script does NOT reset the password — it is idempotent and
  bails if the account exists. To rotate: Supabase Studio → Authentication →
  Users → applereview@swiftcard.me → Reset password.

### Status: created 2026-08-09

`applereview@swiftcard.me` exists in production, Pro tier, with the card
provisioned (`/card/apple-review-bd38b805` returns 200), 3 demo contacts and
24 card views seeded. The generated password is at
`~/.swiftcard/apple-review-account.txt` (mode 600) — move it into your
password manager and App Store Connect, then delete that file.

⚠️ The first run seeded **0** card views: the script picked view dates at
random, `(username, visitor_id, day)` is UNIQUE, and one collision in a single
batch insert rejects all 24 rows — leaving the reviewer an Analytics screen of
zeros, which is the opposite of the point. Fixed to derive the day from the
index so the pairs are unique by construction, and the 24 views were
backfilled.

## What the reviewer account must demonstrate (verify before every submission)

- [ ] Signs in with email + password on a clean install.
- [ ] Dashboard shows a populated business card with a working QR.
- [ ] Public card link opens (universal link) and shows the share-back form
      and the "Report this card" link at the bottom.
- [ ] Contacts list contains 2–3 FICTIONAL demo leads with tags/statuses.
- [ ] Analytics shows non-zero demo views.
- [ ] Swift Links page is populated.
- [x] Apple Wallet: N/A — not configured, and the button is gated off. Do not list it as a feature to test.
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
