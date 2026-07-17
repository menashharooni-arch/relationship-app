# SwiftCard iOS App Store Readiness Report

_Overnight autonomous audit, 2026-07-17. Checkpoint tag `checkpoint-pre-ios-audit`
(94a49e8). All work committed in labeled commits on `main`. NOT deployed, NOT
submitted — per instructions. This report makes no approval guarantees._

## Headline finding

**The native iOS app did not exist.** The repo carried a complete, well-built
native-mode web layer ("Native areas 1–11"), but no Capacitor project had ever
been created (no `ios/`, no `capacitor.config.*`, nothing in git history), and
this machine has no Xcode. Tonight the shell was scaffolded (§Shell) and the
web layer — which is what Apple's reviewers will actually see inside the shell —
was audited and hardened.

## FIXED tonight (committed, tested — 525 tests pass, web renders byte-identically)

### Guideline 3.1.1 — in-app selling (the #1 rejection cause) — 9 leaks closed
| # | Surface | What leaked | Fix |
|---|---|---|---|
| 1 | Dashboard `TrialBanner` | "Keep Pro →" /pricing CTA on the app's main screen | CTA native-hidden; neutral status stays |
| 2 | `/checkout` | Full order summary + Stripe hand-off, no guard | Native redirect → /dashboard (matches /pricing, /upgrade) |
| 3 | `/welcome` | Stored plan intent resumed a "Complete your subscription" panel | Intent never consumed on native |
| 4 | Card-wizard guest plan step | Full plan chooser with prices | Closed via #5 |
| 5 | `PlanCards` (shared root) | Prices, paid plans, seat picker, checkout | Native renders ONLY the free continue action |
| 6 | Office invite `TeamActions` | **One-tap prorated seat purchase (real money)** | Purchase panel suppressed; neutral actionable fallback |
| 7 | `SalesChat` + footer | AI sales bot freely quotes prices, links /pricing | Null on native + NativeHidden at render site |
| 8 | Marketing "See pricing" links (5 pages) | Raw links to /pricing | NativeHidden wraps |
| 9 | `AddSeatButton` (dead code) | Ungated purchase if ever revived | Gated |

### Guideline 2.1 — completeness
- Push opt-in showed **impossible** "Add to Home Screen" instructions inside the
  shell → replaced with an honest native "not available in this version" note.

### Guideline 5.1.1 — account deletion
- Deletion is fully reachable on native (Settings → Advanced → Delete account);
  its "cancel in Plan and billing" hint (dead anchor on native) is now web-only.
- Apple-token revocation on deletion (`apple-revoke.ts`) verified real and
  correct — activates once the 4 `APPLE_*` env vars are set (runbook §4).

### Guideline 4.8 — sign-in (verified, no regression)
- This week's web GIS migration did NOT touch native: native keeps the
  OAuth-redirect Google flow; the GIS button hard-no-ops in the shell;
  hydration-safe branch confirmed.
- "Continue with Apple" renders native-only, mirrors Google, error-handled.

### Shell scaffolded (did not exist)
- `capacitor.config.ts` (remote-URL shell, scoped allowNavigation, appId
  `me.swiftcard.app` matching AASA + Apple scaffolding), generated `ios/` Xcode
  project (Capacitor 8/SPM), Info.plist purpose strings + export-compliance key
  (plutil-validated), offline fallback page.

### Test coverage
- +21 native-suppression guard tests (each fix locked in). 525 total pass;
  typecheck, lint, production build all clean. Web-visible diff: zero (every
  change is behind `useIsNativeApp`/`detectNativeApp`/`NativeHidden`, false on
  web/SSR/first paint).

## BLOCKERS — owner actions required before submission (documented, not codeable here)

1. **Sign in with Apple provider is not enabled** (Supabase + Apple Developer).
   The native button ships broken today → near-certain 4.8/2.1 rejection.
   Exact steps: SHELL-RUNBOOK §4. (Hiding the button instead would still fail
   4.8, since Google login is offered.)
2. **AASA Team ID placeholder** — Universal Links dead until
   `TEAMID_PLACEHOLDER` is replaced and the site redeployed (runbook §3) and the
   Associated Domains entitlement is added in Xcode (§2).
3. **Xcode build + device test** — impossible on this machine (no Xcode).
   Mandatory first-device-test items (runbook §5–7): Google-login-in-webview
   (`disallowed_useragent` risk — plugin fallback documented), `.vcf` Save
   Contact and `.pkpass` Wallet downloads in WKWebView, offline launch.
4. **App Store Connect setup** — privacy nutrition labels, demo review account,
   review notes (runbook §8).

## ARCHITECTURAL risks (honest assessment)

- **Guideline 4.2 (minimum functionality)**: a remote-URL webview shell is the
  classic "just a website" rejection. Native login options + Universal Links +
  visible native-mode differences help; the strongest mitigation is shipping
  real APNs push via `@capacitor/push-notifications` before submission
  (runbook §6). Expect 1–2 review rounds either way.
- **Google OAuth in embedded webviews** is frequently blocked by Google.
  Email/password always works; the plugin path is specified in runbook §5.

## Accepted-risk items (deliberate, documented)

- `terms.tsx` in-body legal sentence describing paid plans with a pricing-page
  link: factual ToS billing text; restructuring it would visibly change the web
  page. Revisit only if a reviewer flags it.
- Admin-console (`/admin/*`) selling links: reachable only by the site owner's
  account, not by review or users.
- Web Push remains web-only (suppressed honestly on native).

## Commits in this run

1. `docs: audit plan` — written plan before changes (required).
2. `2.1: native push opt-in fix`.
3. `3.1.1: close all 9 selling leaks` (+ shell config rode along).
4. `5.1.1: deletion billing pointer web-only`.
5. `shell scaffolding + SHELL-RUNBOOK.md`.
6. `this report`.

Rollback: `git reset --hard checkpoint-pre-ios-audit` (or revert individual
commits — each category is isolated).
