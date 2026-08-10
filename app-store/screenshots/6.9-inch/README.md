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

Dashboard + analytics, Contacts list, and the card scanner all need a
signed-in session. They could not be captured here: `/auth/callback` is
PKCE-only, so an admin-generated magic link cannot establish a server session,
and driving the simulator by tapping needs Accessibility permission that was
not granted. Take them from the signed build on a device, per
`docs/ios-review/APP-STORE-METADATA.md`.

Sign in as `applereview@swiftcard.me` (password in
`~/.swiftcard/apple-review-account.txt`) — that account is already populated
with 3 contacts and 24 card views precisely so these shots aren't empty.
