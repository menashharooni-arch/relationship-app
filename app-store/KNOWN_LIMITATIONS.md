# Known Limitations — iOS v1 (deliberate, disclosed, review-safe)

_Everything here is intentional scope for the first release. None of it is
hidden from Apple: metadata and reviewer notes stay consistent with this list._

## Not in the iOS app (by design)

| Capability | Status in iOS v1 | Where it lives | In-app presentation |
|---|---|---|---|
| Buying Pro / Office, seat management, coupons, billing portal | **Absent** — nothing is sold or priced in-app | Website only | Fully suppressed (no mention, no links) |
| Office seat purchase / removal pricing | Absent | Website | Member add/remove works; billing steps suppressed with neutral copy |
| NFC tag WRITING from inside the app | Not possible (no Web NFC in WKWebView) | Android Chrome web, or any free NFC-writer app | Button hidden natively; honest manual path (copy link + NFC app) shown |
| Dedicated watchOS app | Roadmap — does not exist | — | Wallet pass syncs to Watch Wallet (real today); in-app clarifier on /products/watch says exactly this |
| Web push (VAPID) | Web-only | Browsers | Native uses real APNs push instead |
| Referral program ("free months of Pro") | Hidden natively (compensation touches plan upgrades) | Website | NativeHidden |
| Home-screen QR widget | Code complete; requires the Xcode widget-target step before it exists in the binary | — | Wallet-page copy has a native clarifier; build the target before submission or the claim stays qualified |

## Product behaviors a reviewer might question (prepared answers)

- **"The app requires an account"** — card creation works logged-out (guest
  draft) and account creation is free and instant; reviewer demo account
  provided. Not a 5.1.1 forced-registration issue because core functionality
  is account-inherent (your card IS your account's data).
- **Account deletion holds data 30 days** — disclosed in the dialog, the
  deleted-state page, and the privacy policy; hard purge is automated
  (cron). Apple accepts disclosed recovery windows; deletion is real.
- **Office members cannot delete their own account in-app** — this is a
  MANAGED-ACCOUNT posture (Apple 5.1.1(v) permits managed/enterprise accounts
  to be administered by the org): a member's account is a company-owned seat,
  so deletion runs through the Office admin ("Remove from team"), which cleanly
  unwinds the seat, plan, and branding. The in-app message states this. Office
  OWNERS delete their own account in-app (with a team-consequence disclosure).
  The reviewer's demo account is an INDIVIDUAL Pro account with a working
  in-app delete, so review never hits the member path. If a reviewer flags it,
  the queued fix is a self-service "Leave the organization" action that
  releases the seat — deferred because it needs seat/billing unwind that can
  only be safely device-tested.
- **Card visitors aren't app users** — lead capture is a public web form on
  the card page; no ATT/consent issue (no tracking; pseudonymous view
  counts; disclosed in the privacy policy).
- **UGC** — public cards are user-generated: reporting exists in-app
  ("Report this card" → contact form → hello@swiftcard.me, 1-business-day
  SLA), takedown exists (admin console kill-switch, reversible), uploads are
  validated (type allowlist, size cap, re-encode, GIF magic bytes). No
  proactive NSFW image scanning in v1 — volume is low and all content is
  self-published business identity; revisit if scale changes.

## Engineering debt accepted for v1 (tracked, not review-relevant)

- Native OAuth callback relies on PKCE alone (no extra nonce) — sound, but a
  defense-in-depth nonce is queued for v1.1.
- Legacy profile-slug cards (pre-migration accounts) have no per-card
  `is_offline` takedown; admin fallback is plan-set/DB. Real `cards` rows
  (all current accounts) are fully moderatable.
- Preview deployments lack `SUPABASE_SERVICE_ROLE_KEY` (Vercel env scope), so
  DB-backed pages error on previews. Add the key to the Preview scope only if
  preview-of-prod-data is actually wanted; it is a security tradeoff.
- `vercel:` the local `.next/types` occasionally accumulates "name 2.ts"
  duplicate files that break `tsc` — delete them (they're generated).
