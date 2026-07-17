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
3. **+ Capability → Associated Domains** → add `applinks:swiftcard.me`.
4. **+ Capability → Sign in with Apple**.

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
4. Device-test: tap Continue with Apple → completes into a session.

## 5. Google login inside the shell — TEST FIRST, plugin if blocked

The native login uses the OAuth-redirect flow inside the webview. **Google
frequently blocks embedded-webview OAuth (`403 disallowed_useragent`).** On the
first device build, test Google login immediately:

- If it works: done.
- If blocked: install `@capacitor/browser` and route the OAuth URL through
  `Browser.open()` (SFSafariViewController), returning via Universal Link, or
  use a native-SDK plugin (`@capgo/capacitor-social-login`) and pass its ID
  token to `supabase.auth.signInWithIdToken({provider:'google'})` — the same
  server-side setup the web GIS flow already uses (add the iOS client ID to the
  comma-separated Client IDs in Supabase's Google provider).
- Email/password login works in the webview regardless — never blocked.

## 6. Known WKWebView gaps to device-test (graceful today, better native later)

| Surface | Today in shell | Native upgrade (optional) |
|---|---|---|
| Push notifications | Suppressed with honest copy (fixed in audit) | `@capacitor/push-notifications` + APNs + `aps-environment` |
| Save Contact (.vcf) | Blob download may no-op in WKWebView — TEST | Shell download-interception or `@capacitor/filesystem` + share sheet |
| Apple Wallet (.pkpass) | Same download caveat — TEST | Intercept and present `PKAddPassesViewController` |
| navigator.share | May be absent; falls back to copy/WhatsApp menu | `@capacitor/share` |
| Web NFC writer | Unwired; iOS-safe fallback | Core NFC entitlement + plugin |

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
4. **Review notes**: provide a demo login (create a dedicated
   review@swiftcard.me account, Pro-granted so locked features show content,
   NOT a real user), and explain: "Subscriptions are not sold in the app; the
   app is a companion for managing an existing account."
5. **Screenshots** from the device build.

## 9. Honest risk assessment (no approval guarantees)

- **Guideline 4.2 (minimum functionality)** is the structural risk for a
  remote-URL webview shell: Apple sometimes rejects apps that are "just a
  website". Mitigations shipped: native login options, deep links, native-mode
  UI differences. Strongest counter: add 1–2 real native capabilities before
  submission (push notifications via APNs is the highest-value one, §6).
- 3.1.1 / 4.8 / 5.1.1 were audited and fixed in code; they depend on §4 (Apple
  provider) being completed and §5/§6 device tests passing.
- First submissions of this app category commonly take 1–2 review rounds.
