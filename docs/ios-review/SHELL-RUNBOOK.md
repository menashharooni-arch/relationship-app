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

## 3. Replace the AASA placeholder (Universal Links)

`src/app/.well-known/apple-app-site-association/route.ts` line 21:
replace `TEAMID_PLACEHOLDER` with the real Team ID → deploy the website.
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
   `swiftcard://auth-callback`** — the return leg of BOTH native Google and
   Apple sign-in (see §5). 30 seconds; without it every native OAuth attempt
   errors at the redirect step.
5. Device-test: tap Continue with Apple → completes into a session.

## 5. Google login inside the shell — ALREADY SOLVED, just test it

Native OAuth no longer runs inside the webview (Google blocks that with
`403 disallowed_useragent`). The shipped flow: `src/lib/native-auth.ts` opens
the provider URL in the system browser sheet (`@capacitor/browser` →
SFSafariViewController), Supabase redirects to `swiftcard://auth-callback`
(scheme registered in Info.plist), and `NativeAppBridge` completes the PKCE
exchange inside the webview. Requirements already in place except the §4.4
Supabase Redirect URL entry. On the first device build simply test Google +
Apple sign-in end-to-end. Email/password works regardless — never blocked.

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
