# 6.9-inch iPhone screenshots (1320 × 2868)

Captured 2026-08-09 from the **real app** running on an iPhone 17 Pro Max
simulator — not from the website — so the native styling layer
(`html.native-app`) is present. That size is the App Store's canonical 6.9"
requirement; smaller iPhones auto-scale from it.

| File | Shot | Notes |
|---|---|---|
| `01-native-login-with-apple.png` | Native login | Proof "Continue with Apple" ships and renders in-app, next to Google. No selling UI anywhere (3.1.1). |
| `02-public-card.png` | Public card | The demo account's card as a lead sees it: QR, Save Contact, share-back form. |

## Still to capture (3 of 5)

Dashboard + analytics, Contacts, and Swift Links all need a signed-in session,
and every headless route to one was tried and failed:

- `/auth/callback` reads `?code=` only, but Supabase's admin-generated magic
  link returns the session in the URL **fragment** (`#access_token=…`,
  confirmed: the verify endpoint 303s with an implicit grant). A route handler
  is server-side, so the fragment never reaches it.
- Redirecting the link to a *page* instead, hoping the browser client would
  consume the fragment into cookies, also failed — `/dashboard` still bounced
  to `/login`.
- Tapping the simulator needs Accessibility permission, which is a GUI grant.

So it takes one real sign-in. Do that once and the rest is automatic:

    npm run ios:sim          # sign in as applereview@swiftcard.me
                             # (password: ~/.swiftcard/apple-review-account.txt)
    # ctrl-C, then:
    npm run ios:screenshots  # captures 03/04/05 at 1320x2868
    node scripts/asc-upload-screenshots.mjs   # pushes the whole set to ASC

⚠️ `ios-screenshots.sh` cannot tell a signed-in page from the login screen —
it captures whatever renders. Glance at the PNGs before uploading; three
login screens is exactly what a lapsed session looks like.

Sign in as `applereview@swiftcard.me` (password in
`~/.swiftcard/apple-review-account.txt`) — that account is already populated
with 3 contacts and 24 card views precisely so these shots aren't empty.
