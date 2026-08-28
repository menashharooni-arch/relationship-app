# SwiftCard iOS Shell — Build & Submission Runbook

_Everything the owner must do on a Mac with Xcode to take the scaffolded shell
to App Store review. The `ios/` project + `capacitor.config.ts` were generated
and configured in the overnight audit (Capacitor 8, Swift Package Manager — no
CocoaPods needed). Nothing here deploys or submits automatically._

## 0. What already exists

- `capacitor.config.ts` — remote-URL shell: WKWebView loads https://swiftcard.me;
  `window.Capacitor` is injected so `src/lib/platform.ts` flips the site into
  native mode (selling suppression, native login, PlanGate — all audited).
- `ios/App/App.xcodeproj` — generated Xcode project, bundle id `me.swiftcard.app`,
  display name SwiftCard.
- `Info.plist` — camera / photo-library purpose strings + `ITSAppUsesNonExemptEncryption=false`
  already added.
- Local fallback page `capacitor-shell/www/index.html` (offline placeholder).

## 1. One-time machine setup

1. Install **Xcode** from the App Store (15+), then: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. Sign into Xcode with the Apple Developer account (Settings → Accounts).
3. You need an **Apple Developer Program** membership ($99/yr) on the team that
   will own the app.

## 2. Open & configure the project

```bash
cd ~/Desktop/relationship-app
npx cap sync ios     # regenerates ios/App/App/public + capacitor.config.json
npx cap open ios     # opens Xcode
```

In Xcode → target **App** → *Signing & Capabilities*:
1. **Team**: select your team. Note the 10-char **Team ID** (also at
   developer.apple.com → Membership).
2. Bundle identifier stays `me.swiftcard.app`.
3. **Associated Domains (`applinks:swiftcard.me`) and Push Notifications are
   already wired** via `App/App.entitlements` + build settings — automatic
   signing will register them on the App ID. Verify they appear under
   Signing & Capabilities; if Xcode complains, press "+ Capability" for the
   missing one (it will merge with the existing entitlements file).
4. **+ Capability → Sign in with Apple** (the only one still added by hand).

## 3. Set the AASA Team ID (Universal Links)

No code edit. `src/app/.well-known/apple-app-site-association/route.ts` reads
`APPLE_TEAM_ID` — the same variable Wallet and Apple-revocation already use.
Set it in Vercel → Production, then REDEPLOY (env changes only take effect on a
new deployment). Until it is set the route serves
`TEAMID_PLACEHOLDER.me.swiftcard.app` and Universal Links stay dormant; a
malformed value falls back to that same placeholder rather than serving an
appID Apple silently rejects.
Verify: `curl https://swiftcard.me/.well-known/apple-app-site-association`
shows `"<TEAMID>.me.swiftcard.app"`.

## 4. Sign in with Apple — REQUIRED before submission (Guideline 4.8)

The native login screen shows "Continue with Apple"; today the Supabase Apple
provider is NOT enabled, so the button errors — **a guaranteed rejection if
shipped**. Setup:

1. developer.apple.com → Certificates, IDs & Profiles:
   - App ID `me.swiftcard.app`: enable **Sign in with Apple**.
   - Create a **Services ID** (e.g. `me.swiftcard.web`) with Sign in with Apple
     enabled; configure domain `grxmovpmlgmjncnyiyrt.supabase.co` and return URL
     `https://grxmovpmlgmjncnyiyrt.supabase.co/auth/v1/callback`.
   - Create a **Sign in with Apple key** (.p8) — note Key ID; download the file.
2. Supabase → Authentication → Providers → **Apple**: enable; Client ID = the
   Services ID; secret = generated from Team ID + Key ID + .p8 (Supabase docs
   show the JWT generation; their dashboard accepts the raw values).
3. Vercel env (for token revocation on account deletion — already implemented in
   `src/lib/apple-revoke.ts`):
   `APPLE_TEAM_ID`, `APPLE_SIGN_IN_CLIENT_ID` (Services ID), `APPLE_SIGN_IN_KEY_ID`,
   `APPLE_SIGN_IN_PRIVATE_KEY` (.p8 contents) → redeploy.
4. **Supabase → Authentication → URL Configuration → Redirect URLs: add
   `swiftcard://auth-callback`** — Apple's return leg. 30 seconds; without it
   every native Apple attempt errors at the redirect step. (Google reaches the
   same scheme without this entry — it no longer goes through Supabase's
   redirect at all; see §5.)
5. Device-test: tap Continue with Apple → completes into a session.

## 5. Google login inside the shell — SOLVED, including the consent screen

Native OAuth never runs inside the webview (Google blocks that with
`403 disallowed_useragent`). It runs in the system browser sheet
(`@capacitor/browser` → SFSafariViewController) and returns over
`swiftcard://auth-callback` (scheme registered in Info.plist), which
`NativeAppBridge` hands to `completeNativeOAuth()`.

**Google is brokered by us, not by Supabase** — that is what fixed the account
chooser. While Supabase brokered it, Google was given Supabase's redirect_uri
and printed it on the chooser: *"to continue to
grxmovpmlgmjncnyiyrt.supabase.co"*. Now `/api/auth/google/native/start` sends
the user to Google with a **swiftcard.me** redirect_uri, so the chooser names
swiftcard.me; the callback seals the returned Google ID token into a ticket,
the app redeems it at `/api/auth/google/native/redeem`, and the webview signs in
with `signInWithIdToken` — the same call the website's Google button makes. Full
design and threat model: `src/lib/native-google-login.ts`.

Two things worth knowing when touching this:
- The redirect_uri is `/api/integrations/google/callback` (the CRM path) because
  that is the only swiftcard.me URI registered on the OAuth client, and
  authorized redirect URIs are Google Cloud **console** config. That route
  dispatches login-purpose states straight into the login handler. Registering
  `https://swiftcard.me/api/auth/google/native/callback` in the console lets you
  point `NATIVE_GOOGLE_REDIRECT_PATH` at the dedicated route instead — optional,
  nothing else changes.
- It needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `OAUTH_SECRET` server
  side (all three already set in prod for the CRM connect). Missing any of them
  falls the shell back to the old Supabase-brokered flow, which still signs
  people in — it just says supabase.co again.

**Apple** still uses the Supabase-brokered PKCE flow and needs the §4.4 Redirect
URL entry. Apple's sheet shows the app, never a Supabase host, so it has nothing
to fix. On the first device build test Google + Apple sign-in end-to-end.
Email/password works regardless — never blocked.

## 6. Native capabilities — push is IMPLEMENTED; finish with one APNs key

**Push notifications (the main 4.2 mitigation) are fully wired:** the in-app
toggle registers the APNs device token via `@capacitor/push-notifications`,
tokens ride the existing `push_subscriptions` table as `apns:<token>` rows, and
`src/lib/apns.ts` delivers over HTTP/2. To activate:
1. developer.apple.com → Certificates, IDs & Profiles → **Keys** → create an
   **APNs** key (.p8) — note the Key ID.
2. Vercel env (all environments) + redeploy:
   - `APPLE_PUSH_KEY_ID` = the Key ID
   - `APPLE_PUSH_PRIVATE_KEY` = the .p8 file contents
   - (`APPLE_TEAM_ID` shared with §4; `APPLE_PUSH_SANDBOX=1` only while
     testing Xcode dev builds — remove for TestFlight/App Store.)
3. Device test: toggle Push on in app settings → capture a lead on the card →
   notification arrives; tapping it opens the contacts screen.

Remaining device-test items (graceful fallbacks today):

| Surface | Today in shell | Note |
|---|---|---|
| Apple Wallet (.pkpass) | Opens via system browser sheet → native Add-to-Wallet UI | Implemented; just test |
| navigator.share | Native share sheet via `@capacitor/share` | Implemented; just test |
| Save Contact (.vcf) | Blob download may no-op in WKWebView — TEST | Owner flow only (visitors use Safari); upgrade later if needed |
| Web NFC writer | Unwired; iOS-safe fallback | Core NFC entitlement + plugin (later) |

## 6b. Home-screen QR widget (SwiftCardWidget)

✅ **Done — no manual Xcode steps remain.** The `SwiftCardWidgetExtension`
target is committed in `App.xcodeproj`, builds, and embeds into
`App.app/PlugIns/`. Both targets carry `group.me.swiftcard.app`; the extension
targets iOS 17 (it uses `.containerBackground(for: .widget)`) while the app
stays on 15.

How the card reaches the widget:

    NativeAppBridge.tsx  →  WidgetBridge.setCard()      (native plugin)
                         →  UserDefaults(suiteName: "group.me.swiftcard.app")
                            key "widget_card"
                         →  WidgetCenter.reloadTimelines(ofKind: "SwiftCardQR")
                         →  SwiftCardWidget.swift reads the same suite/key

⚠️ It must go through `WidgetBridge`, NOT `@capacitor/preferences`. That
plugin's `group` option is only a key prefix on `UserDefaults.standard` — it
is not an App Group, and `UserDefaults.standard` is invisible to an
extension. Routing the card that way is what left the widget permanently
empty before 2026-08-07.

Remaining verification (needs a signed-in build on a device or simulator):
long-press the home screen → add the "My SwiftCard QR" widget; it populates
once the app is opened signed-in.

## 7. Build, run, verify

```bash
npx cap sync ios && npx cap open ios
```
Run on a real device. Verification checklist (all fixed/audited surfaces):
- Login: email/password ✓, Apple ✓ (§4), Google ✓ (§5).
- NO selling anywhere: dashboard (no "Keep Pro"), settings (no Plan & billing),
  new-card wizard guest plan step (free-only), /welcome (free-only), office
  invite at full seats (neutral copy, no price), no pricing links on any page,
  no sales chat bubble, /pricing → /upgrade → /checkout all bounce to dashboard.
- Account deletion: Settings → Advanced → Delete account completes.
- Card pages, links pages, contacts, analytics, AI assistant all function.
- External links on cards (social/websites) open OUTSIDE the app (system
  browser); swiftcard.me links stay inside.
- Offline: airplane-mode launch shows a sane state, not a white screen.

## 8. App Store Connect

1. appstoreconnect.apple.com → New App → bundle `me.swiftcard.app`.
2. **Privacy nutrition labels** (accurate for this codebase): Contact Info
   (name, email, phone — account + cards), User Content (photos users upload,
   contacts/leads they save), Identifiers/Usage Data (view analytics tied to
   cards; visitor analytics are pseudonymous). Purposes: App Functionality,
   Analytics. Not used for tracking across apps → "Data Not Linked to You /
   No Tracking" where truthful.
3. **App Privacy policy URL**: https://swiftcard.me/privacy
4. **Review notes + demo login**: run `node scripts/create-apple-review-account.js`
   once (creates applereview@swiftcard.me on Pro; prints the password once —
   save it). All fields, labels, description, keywords, and reviewer notes are
   pre-written in **APP-STORE-METADATA.md** — copy-paste from there.
5. **Screenshots** from the device build (shot list in APP-STORE-METADATA.md).

## 9. Honest risk assessment (no approval guarantees)

- **Guideline 4.2 (minimum functionality)** is the structural risk for a
  remote-URL webview shell: Apple sometimes rejects apps that are "just a
  website". Mitigations now SHIPPED: system-browser native sign-in, universal
  links, native share sheet, Wallet hand-off, and full APNs push (activate it
  with the §6 key BEFORE submitting — a working push permission prompt +
  notifications is the single strongest "not just a website" signal).
- 3.1.1 / 4.8 / 5.1.1 were audited and fixed in code; they depend on §4 (Apple
  provider) being completed and §5/§6 device tests passing.
- First submissions of this app category commonly take 1–2 review rounds.
