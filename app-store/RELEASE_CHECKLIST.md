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

**What is left, in order. Everything upstream of these is done.**

1. **Create the two .p8 keys** (§A) — Sign in with Apple, and APNs. This is
   the only remaining Apple-portal step; both download exactly once.
2. **Run `scripts/supabase-enable-apple.mjs`** (§B) — enables the provider and
   allow-lists the native redirect, then verifies itself.
3. **Add the Apple env vars and flip `NEXT_PUBLIC_APPLE_SIGNIN_ENABLED=1`**
   (§C), then redeploy. Order matters: the button stays hidden until the
   provider works.
4. **Sign in to Xcode** (§D) — no Apple ID is signed in and there are no
   signing identities on this Mac, so device install / Archive / Validate /
   upload cannot run. `DEVELOPMENT_TEAM = NHK8FA2RR2` is already set on both
   targets, so automatic signing should resolve immediately after.

Everything else server-side has been checked rather than assumed: the AASA
serves the real Team ID (§C), the App ID capabilities are correct and the App
Group is now actually attached (§A), the Services ID exists and Apple has
validated its URLs (§A), and the site responds 200.

## A. Apple Developer portal (developer.apple.com)

- [x] Apple Developer Program membership active — team **Swift Card Inc. —
      NHK8FA2RR2**, account Aaron Lavi.
- [x] App ID `me.swiftcard.app` ("SwiftCard iOS") registered. Verified
      2026-08-07: Associated Domains ✓, Push Notifications ✓, Sign in with
      Apple ✓, App Groups ✓.
- [x] **App Group `group.me.swiftcard.app` assigned to the App ID.** It
      existed as an identifier but was attached to nothing ("Enabled App
      Groups (0)"), which would have failed device provisioning for the
      widget's entitlement. Now (1).
- [x] **Services ID `me.swiftcard.web`** ("SwiftCard Sign in with Apple")
      created with Sign in with Apple enabled, primary App ID
      `NHK8FA2RR2.me.swiftcard.app`, domain
      `grxmovpmlgmjncnyiyrt.supabase.co`, return URL
      `https://grxmovpmlgmjncnyiyrt.supabase.co/auth/v1/callback`.
      Apple validated both URLs.
- [ ] **SIWA key (.p8)** — Keys list is still empty. Create at
      developer.apple.com → Keys → +, tick "Sign in with Apple", set the
      primary App ID to `me.swiftcard.app`. **The .p8 downloads exactly once**
      — keep it somewhere permanent, not ~/Downloads. Note the Key ID.
- [ ] **APNs key (.p8)** — same page, tick "Apple Push Notifications service".
      Can be the same key or a separate one; a separate one is easier to
      rotate. Also download-once.
- [ ] **Private email relay**: register the swiftcard.me sending domain/
      addresses (Resend's from-address) under Sign in with Apple → Email
      Sources — without this, Hide-My-Email users get NO product emails.
- [ ] **APNs key** (.p8) created — note Key ID. (SHELL-RUNBOOK §6.)
- [ ] Pass Type ID for Wallet confirmed valid (existing passes sign with it).

## B. Supabase dashboard — one command

Once the SIWA .p8 from §A exists, both items below are done by:

```bash
SUPABASE_ACCESS_TOKEN=sbp_...  \
  node scripts/supabase-enable-apple.mjs ~/path/AuthKey_<KEYID>.p8
```

(token from supabase.com/dashboard/account/tokens, or just `supabase login`
first and the script reads `~/.supabase/access-token`). It enables the
provider, adds the redirect URL, and then proves it by re-running the
`/authorize` probe — so a green run means it actually works, not just that the
API returned 200.

- [ ] Auth → Providers → **Apple enabled** (Services ID + secret).
      ⚠️ **Verified still OFF on 2026-08-07**:
      `GET /auth/v1/authorize?provider=apple` returns
      `{"code":400,"error_code":"validation_failed","msg":"Unsupported
      provider: provider is not enabled"}`, where `google` returns a 302 to
      accounts.google.com. This is the 4.8 exposure.
- [ ] Auth → URL Configuration → Redirect URLs includes
      `swiftcard://auth-callback` — the return leg of native OAuth. Not
      checkable from outside (Supabase validates `redirect_to` at the callback,
      not at `/authorize`, so a bogus scheme 302s too), which is why the script
      sets it rather than assuming.

⚠️ **The Apple client secret is a JWT you sign, and Apple caps it at 6
months.** Sign in with Apple will break on its expiry date with no warning.
`scripts/apple-client-secret.mjs` regenerates it; re-running the enable script
above is the fix. Put the date in a calendar.
- [ ] Auth → **leaked-password protection enabled** (one toggle; flagged by
      the security advisor).

## C. Vercel env + deploy

- Env vars (Production). `vercel env ls production` on 2026-08-07 shows
      **only `APPLE_TEAM_ID`** is set. Still to add, all of which need the
      §A keys first:
  - [ ] `APPLE_SIGN_IN_CLIENT_ID` = `me.swiftcard.web`
  - [ ] `APPLE_SIGN_IN_KEY_ID`, `APPLE_SIGN_IN_PRIVATE_KEY` — used by
        `src/lib/apple-revoke.ts` to revoke Apple tokens at account deletion.
        That is App Store requirement 6.2, and it is separate from the
        Supabase provider: enabling sign-in without these means deletions
        silently skip revocation.
  - [ ] `APPLE_PUSH_KEY_ID`, `APPLE_PUSH_PRIVATE_KEY`
        (`APPLE_PUSH_SANDBOX=1` only for dev builds — REMOVE for TestFlight+).
- [ ] **`NEXT_PUBLIC_APPLE_SIGNIN_ENABLED=1` — set this LAST, after §B is
      green, then redeploy.** The Apple button in `LoginForm.tsx` is gated on
      it precisely so the button cannot exist while the provider is off; a
      sign-in control that always errors is a 2.1 rejection by itself. It is
      a `NEXT_PUBLIC_` var, so it is baked in at build time — setting it
      without a redeploy does nothing.
- [x] **AASA is live and correct** (verified 2026-08-07):
      `curl https://swiftcard.me/.well-known/apple-app-site-association`
      returns `"appID":"NHK8FA2RR2.me.swiftcard.app"` with paths
      `/card/*`, `/links/*`, `/join/*`, `/auth/callback` — the real Team ID,
      not `TEAMID_PLACEHOLDER`. So `APPLE_TEAM_ID` is already set in Vercel
      Production and Universal Links are activated server-side.
- [x] Audit commits are on origin/main; nothing is local-only any more.

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
