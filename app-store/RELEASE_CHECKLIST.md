# Release Checklist — SwiftCard iOS 1.0

_Work top to bottom. Do not skip sections. Submission is gated on EVERY box._

**Build status (2026-08-07): the shell compiles.** Xcode 26.6 + the iOS 26.5
platform are installed, and both Debug and Release build clean with zero
warnings for `-destination 'generic/platform=iOS Simulator'`. Verified on an
iPhone 17 Pro simulator: the app boots, loads https://swiftcard.me, and the
live site detects native mode (the console shows the page calling
`To Native -> App addListener` / `PushNotifications addListener`, which only
runs behind `detectNativeApp()`). The `SwiftCardWidgetExtension` target now
exists, builds, embeds into `App.app/PlugIns/`, and iOS registers it
(`pluginkit -p com.apple.widgetkit-extension` lists it). App and widget both
resolve the `group.me.swiftcard.app` App Group and its container provisions.

Two silent-failure bugs were found and fixed while getting there — see
§"Fixed during first build" at the bottom.

**Still blocked on the owner:** no Apple ID is signed into Xcode and there are
no signing identities on this Mac, so nothing below the simulator line
(device install, Archive, Validate, upload) can run yet. That is the single
next action: Xcode → Settings → Accounts → add the Apple ID on team
NHK8FA2RR2. `DEVELOPMENT_TEAM = NHK8FA2RR2` is already set on both targets, so
automatic signing should resolve as soon as the account is there.

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
- [ ] AASA needs NO code edit — the route reads the same `APPLE_TEAM_ID` set
      above, and serves `TEAMID_PLACEHOLDER` until that variable is present.
      Setting the env var and redeploying is what activates Universal Links.
      (A malformed value falls back to the placeholder rather than serving an
      appID Apple silently rejects.)
- [ ] **Push this repo's audit commits to origin** (this deploys production —
      the audit run had no deploy approval, so the commits are local).
      Verify `curl https://swiftcard.me/.well-known/apple-app-site-association`
      shows the Team ID and `/join/*`.

## D. Xcode (SHELL-RUNBOOK §1–2, §6b)

- [x] Xcode 26.6 installed; iOS 26.5 platform + simulator runtime downloaded
      (`xcodebuild -downloadPlatform iOS` — Xcode ships only stub SDKs).
- [x] `npx cap sync ios` clean; 5 plugins resolved via SPM.
- [x] **SwiftCardWidgetExtension** target created in the pbxproj with
      `SwiftCardWidget.swift`, its `Info.plist`, `PrivacyInfo.xcprivacy` and
      entitlements; embedded into the app via an "Embed Foundation
      Extensions" copy phase. Deployment target 17.0 (the view uses
      `.containerBackground(for: .widget)`); the App target stays on 15.0.
- [x] App Groups (`group.me.swiftcard.app`) resolve on BOTH targets —
      confirmed from the generated `Entitlements-Simulated.plist` for each,
      and the shared container provisions on install.
- [x] `PrivacyInfo.xcprivacy` in the App target's Copy Bundle Resources, and
      the widget's own manifest in the extension's.
- [x] iPhone-only: `TARGETED_DEVICE_FAMILY = 1` on both targets. This is the
      one-line decision that keeps the 13-inch iPad screenshot set out of
      scope — flip to `"1,2"` if you ever want iPad.
- [x] Debug + Release both build clean (zero warnings) for the simulator, and
      the app boots to the live site in native mode there.
- [ ] **Sign in to Xcode** (Settings → Accounts) with the Apple ID on team
      NHK8FA2RR2. Nothing device-side works until this is done.
- [ ] Signing: confirm Associated Domains + Push + App Groups resolve against
      the real team once signed in.
      **Do NOT add a Sign in with Apple capability.** SIWA here runs through
      Supabase's OAuth flow in the system browser (`src/lib/native-auth.ts`),
      not `ASAuthorizationAppleIDProvider`, so the
      `com.apple.developer.applesignin` entitlement is not required — adding
      it only creates a provisioning dependency that can fail signing. The
      App ID work in §A is still required for the *web* SIWA leg.
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

## Fixed during first build (2026-08-07)

Both of these compiled fine and would have shipped as features that quietly
did nothing. Neither was visible until the project was actually built.

1. **Push notifications could never register.** `AppDelegate.swift` was
   missing `didRegisterForRemoteNotificationsWithDeviceToken` and
   `didFailToRegisterForRemoteNotificationsWithError`. The
   `@capacitor/push-notifications` plugin listens for those as
   `NotificationCenter` posts, not as delegate calls, so
   `PushNotifications.register()` never resolved — `EnablePushButton` would
   have hit its timeout every time and no APNs token would ever have reached
   `lib/apns.ts`. Both forwards added; locked by a test.

2. **The home-screen widget could never see a card.** The card was written
   with `@capacitor/preferences` configured with
   `group: "group.me.swiftcard.app"`. That option is **not** an iOS App
   Group — the plugin's iOS code always writes `UserDefaults.standard` and
   uses `group` only as a key prefix. `UserDefaults.standard` lives in the
   app's own container, which a widget extension cannot read, so the widget
   would have sat on "Open SwiftCard to set up your QR" forever. Replaced
   with a `WidgetBridge` native plugin (`ios/App/App/WidgetBridge.swift`)
   that writes the real `UserDefaults(suiteName:)` shared suite and calls
   `WidgetCenter.shared.reloadTimelines(ofKind: "SwiftCardQR")` — without
   that reload the widget would also have kept a stale snapshot for up to
   6 hours. Locked by tests, including a regression guard that fails if the
   Preferences route ever comes back.

   Note this is also why the old test suite passed: it asserted that both
   sides used the same group and key *strings*, which was true and
   irrelevant. The tests now assert the mechanism.

Still unverified end-to-end (needs a signed-in device — it is already a P0 in
`TESTFLIGHT_TEST_PLAN.md`): a real card populating the widget, and a real
APNs token round-trip.
