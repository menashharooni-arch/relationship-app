# Release Checklist — SwiftCard iOS 1.0

_Work top to bottom. Do not skip sections. Submission is gated on EVERY box.
Repo state as of this checklist: all code-side audit fixes committed
(`0d1c43a`), 580/580 tests green, NOT yet pushed to origin._

## A. Apple Developer portal (developer.apple.com)

- [ ] Apple Developer Program membership active on the owning team.
- [ ] App ID `me.swiftcard.app` registered with capabilities: Associated
      Domains, Push Notifications, Sign in with Apple, App Groups
      (`group.me.swiftcard.app`).
- [ ] **Sign in with Apple**: Services ID (e.g. `me.swiftcard.web`) with
      domain `grxmovpmlgmjncnyiyrt.supabase.co` and return URL
      `https://grxmovpmlgmjncnyiyrt.supabase.co/auth/v1/callback`; SIWA key
      (.p8) created — note Key ID. (SHELL-RUNBOOK §4.)
- [ ] **Private email relay**: register the swiftcard.me sending domain/
      addresses (Resend's from-address) under Sign in with Apple → Email
      Sources — without this, Hide-My-Email users get NO product emails.
- [ ] **APNs key** (.p8) created — note Key ID. (SHELL-RUNBOOK §6.)
- [ ] Pass Type ID for Wallet confirmed valid (existing passes sign with it).

## B. Supabase dashboard

- [ ] Auth → Providers → **Apple enabled** (Services ID + secret from Team
      ID/Key ID/.p8).
- [ ] Auth → URL Configuration → Redirect URLs includes
      `swiftcard://auth-callback`.
- [ ] Auth → **leaked-password protection enabled** (one toggle; flagged by
      the security advisor).

## C. Vercel env + deploy

- [ ] Env vars (Production): `APPLE_TEAM_ID`, `APPLE_SIGN_IN_CLIENT_ID`,
      `APPLE_SIGN_IN_KEY_ID`, `APPLE_SIGN_IN_PRIVATE_KEY`,
      `APPLE_PUSH_KEY_ID`, `APPLE_PUSH_PRIVATE_KEY`
      (`APPLE_PUSH_SANDBOX=1` only for dev builds — REMOVE for TestFlight+).
- [ ] Replace `TEAMID_PLACEHOLDER` in
      `src/app/.well-known/apple-app-site-association/route.ts` with the
      real 10-char Team ID.
- [ ] **Push this repo's audit commits to origin** (this deploys production —
      the audit run had no deploy approval, so the commits are local).
      Verify `curl https://swiftcard.me/.well-known/apple-app-site-association`
      shows the Team ID and `/join/*`.

## D. Xcode (SHELL-RUNBOOK §1–2, §6b)

- [ ] Xcode installed; `npx cap sync ios && npx cap open ios`.
- [ ] Signing: select team; verify Associated Domains + Push + App Groups
      appear; add **Sign in with Apple** capability by hand.
- [ ] Verify `PrivacyInfo.xcprivacy` appears in the App target's Copy Bundle
      Resources (it's wired in the pbxproj — just confirm).
- [ ] Create the **SwiftCardWidget** Widget Extension target; add
      `SwiftCardWidget.swift` AND `SwiftCardWidget/PrivacyInfo.xcprivacy` to
      it; App Groups on both targets. (§6b.)
- [ ] Decide iPhone-only vs iPad: if iPhone-only, set TARGETED_DEVICE_FAMILY
      to iPhone (avoids the iPad screenshot requirement).
- [ ] Debug build on a real device boots to the live site in native mode.

## E. Device test round

- [ ] ALL P0 items in `TESTFLIGHT_TEST_PLAN.md` pass on two iPhones.
- [ ] Archive → **Validate App** passes (privacy manifest + required-reason
      checks happen here).
- [ ] Xcode Organizer → generate the **privacy report** from the archive;
      confirm it matches `APP_PRIVACY_DISCLOSURE_MATRIX.md`.

## F. App Store Connect

- [ ] Everything in `APP_STORE_CONNECT_CHECKLIST.md`.
- [ ] Demo account created (`node scripts/create-apple-review-account.js`),
      verified against `REVIEWER_DEMO_ACCOUNT_TEMPLATE.md`, credentials in
      ASC only.

## G. Final consistency sweep (day of submission)

- [ ] Live site /privacy, /terms, /contact reachable logged-out.
- [ ] Reviewer notes match reality (widget exists? push works? Apple login
      works?) — update `APP_REVIEW_NOTES.md` if anything shifted.
- [ ] `KNOWN_LIMITATIONS.md` re-read; still accurate.
- [ ] No new selling surfaces shipped to the site since the audit
      (`npm test` — the guard tests catch code-side regressions).
- [ ] Screenshots taken from the ACTUAL submitted build.

## Submit

- [ ] Submit for review. Expect 1–2 rounds (4.2 webview-shell scrutiny is the
      known structural risk — the reviewer-notes "why it's more than a
      website" section is the prepared answer).
