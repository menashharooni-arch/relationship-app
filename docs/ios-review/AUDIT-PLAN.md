# SwiftCard iOS App Store Review Readiness — Audit Plan

_Date: 2026-07-17 (overnight autonomous run). Checkpoint: git tag `checkpoint-pre-ios-audit` @ `94a49e8`._

## Ground truth discovered before planning

1. **There is no Capacitor iOS project on this machine.** No `ios/` directory, no
   `capacitor.config.*`, never committed to git history, no `*.xcodeproj` anywhere
   under the home directory. `@capacitor/{core,cli,ios}` v8 are installed as npm
   deps, and the web codebase carries a complete native-mode layer ("Native
   areas/items 1–11" commits), but `cap init`/`cap add ios` has never been run here.
2. **Xcode is not installed** (only Command Line Tools; no CocoaPods). Nothing
   native can be built, run, or tested on this machine tonight.
3. Therefore: the app Apple would review = a Capacitor WKWebView shell loading
   this web app in native mode. **The webview content is the app.** The
   highest-value work is hardening every native-mode code path against the
   App Store Review Guidelines, and producing an exact, verified runbook +
   scaffolding for the shell itself.

## Scope rules (from the task)

- Native-mode behavior only; web must not visibly change (all shared-code changes
  gated behind `detectNativeApp()`/`useIsNativeApp()`/`PlanGate`).
- No deploy, no submission, no purchases, no Stripe/live-data changes, no
  destructive migrations, no secrets.
- Risky/unverifiable changes → documented, not implemented.
- Checkpoint commit exists; small labeled commits per category.

## Audit categories (priority order = rejection likelihood × severity)

### A. Guideline 3.1.1 — In-app purchases (highest rejection risk)
Digital subscriptions sold via Stripe must be **unreachable and unmentioned** in
the native app: no prices, no "upgrade", no links to /pricing / /checkout /
Stripe portal, no CTAs in banners/settings/emails-rendered-in-app/AI responses.
Method: exhaustive sweep of every selling surface (agent-assisted), classify
GATED vs LEAK, fix leaks via PlanGate/native detection, extend plan-gate tests.

### B. Guideline 4.8 / 2.1 — Sign in with Apple (confirmed problem)
- `LoginForm.tsx` renders "Continue with Apple" on native, but the code comment
  admits the Supabase Apple provider is **not enabled** → the button **errors
  when tapped**. A visible-but-broken Apple login is a near-certain rejection
  (4.8 + 2.1 app completeness). Not fixable in code alone → produce the exact
  Supabase + Apple Developer configuration runbook; consider gating the button
  behind an env flag so it cannot ship broken.
- Verify the GIS migration (this week) did not regress native login: native gets
  the old `signInWithOAuth` flow; `GoogleSignInButton` must no-op on native. ✅
  (verified by reading LoginForm — web/native branch is hydration-safe).
- **Architectural risk to document:** Google blocks OAuth inside embedded
  webviews (`403 disallowed_useragent`). A Capacitor WKWebView `signInWithOAuth`
  redirect will likely be blocked by Google. Fix belongs in the shell
  (`@capacitor/browser` / ASWebAuthenticationSession + deep-link return) —
  document precisely; cannot be verified without the shell.

### C. Guideline 5.1.1(v) — Account deletion
Deletion API exists (soft-delete + Stripe cancel + Apple token revocation,
`revokeAppleTokensOnDelete` fully implemented, needs 4 APPLE_* env vars).
Verify: deletion UI is reachable in native (settings), copy doesn't route users
to the website, office sub-user block message is native-appropriate, and the
reopen-window wording is clear. Fix any native reachability gaps.

### D. Universal Links / AASA / webview link behavior
- AASA served correctly but `appID` = `TEAMID_PLACEHOLDER.me.swiftcard.app` →
  documented owner action (needs real Team ID).
- Sweep for links that would hijack the webview: external `href`s without
  native handling, `target="_blank"`, `mailto:`/`tel:`/`sms:`, social links on
  cards, Stripe-hosted pages. Document/fix so external URLs open the system
  browser (Capacitor config + code-level `window.open` audit).

### E. Native capabilities inventory (Guideline 4.2 minimum functionality + privacy)
Inventory Wallet pass, NFC, push, camera/QR, contacts/vCard, upload, share.
For each: does it work inside WKWebView? What Info.plist purpose string /
entitlement does it need? What should be disabled/hidden on native if broken?
Output: the exact Info.plist + entitlements the shell must ship with, and
code fixes where a surface would visibly break in the webview.

### F. The missing shell itself
Create `capacitor.config.ts` (remote-URL shell → https://swiftcard.me with
native detection working, correct scheme, allowed navigation) if it can be done
verifiably without Xcode; generate `ios/` via `cap add ios` if the generator
succeeds without CocoaPods/Xcode; otherwise a precise creation runbook
(bundle id `me.swiftcard.app`, signing, entitlements, purpose strings, App
Store Connect metadata: privacy nutrition labels, export compliance, review
notes + demo account).

### G. Completeness / 2.1 sweep
Placeholder text, dead ends, broken flows reachable on native (e.g. buttons
that only make sense on web: "Add to Apple Wallet" config-gated?, email
signature copy flows, download-file flows in webview). Fix or native-gate.

## Verification gate for every change
`npm test` (504+ tests), `npx tsc --noEmit`, `npm run build`, plus new unit
tests for each fixed surface. Web-visible diff must be zero (PlanGate/web paths
byte-identical). No deploy.

## Deliverables
1. Fixes committed in small labeled commits (categories A–G).
2. `docs/ios-review/READINESS-REPORT.md` — every finding: FIXED / DOCUMENTED
   (owner action, with exact steps) / ARCHITECTURAL (needs the shell), plus an
   honest rejection-risk assessment. No approval guarantees.
3. `docs/ios-review/SHELL-RUNBOOK.md` — exact steps to create/build/submit the
   Capacitor shell when Xcode is available.
