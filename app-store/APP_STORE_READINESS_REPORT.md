# SwiftCard iOS — App Store Readiness Report (Final Audit)

_Date: 2026-07-17 (final comprehensive pass; supersedes docs/ios-review/READINESS-REPORT.md
for status — that report remains the record of the first overnight audit)._

## Decision

**READY AFTER LISTED MANUAL STEPS — with one hard caveat: the app has never
been built or run on a device.** All code-side App Review risks found across
two full audits are fixed and locked in by tests. What remains is exclusively
owner/Apple-side work (provider config, Team ID, Xcode build, device testing,
App Store Connect setup) — enumerated in `APP_STORE_CONNECT_CHECKLIST.md` and
`RELEASE_CHECKLIST.md`. Do not submit until every item there is checked; the
device-test round in particular is mandatory, not optional.

## What this pass inspected

- Both prior audit reports + every commit since (`e007651..HEAD`), each read in full.
- Guideline 3.1.1 exhaustive re-sweep: every occurrence of pricing/upgrade/
  checkout/billing/seat/trial/portal vocabulary, every render site read.
- Auth (email, native Google via system browser, Apple scaffolding), account
  deletion (5.1.1(v)), guest-draft claiming, invite acceptance.
- Security: secret scan (repo + git history + client bundle), 20+ API routes for
  authorization/IDOR, token surfaces, SSRF guard, upload validation, deep links,
  webview allowlist, Supabase advisors (RLS/policies/functions/buckets).
- UGC (1.2), support/legal URLs (fetched live), privacy-policy accuracy vs code,
  marketing claims vs implemented features, ATT/tracking posture.
- Privacy manifests, required-reason APIs, Info.plist, entitlements, pbxproj.
- Current (July 2026) Apple guidelines verified from official sources, incl.
  post-Epic US external-link rules and the 2025 age-rating questionnaire.
- Live production validated via a simulated shell (Playwright injecting the
  WKWebView bridge marker): native mode suppresses all selling on the deployed
  site; `/pricing` + `/upgrade` bounce; Apple + Google login buttons render.

## Fixed in this pass (commit `0d1c43a`, 580/580 tests green)

| # | Guideline | Fix |
|---|---|---|
| 1 | 3.1.1 | `/pricing` + `/upgrade` render guards — full price pages no longer PAINT in the shell before the redirect (reachable via the `/office/admin` server redirect) |
| 2 | 3.1.1 | Office `RemoveMemberButton` no longer shows seat price + "lower my bill" natively |
| 3 | 3.1.1 | `BillingManager` + `ManageBillingButton` (Stripe portal) self-suppress on native as backstops |
| 4 | 2.1 | NFC "Write to a tag" button hidden in the shell (Web NFC doesn't exist in WKWebView); honest manual path remains |
| 5 | 1.2 | Native-only "Report this card" link on public cards + Swift Links → contact form report mode |
| 6 | 1.2 | Site-owner takedown: reversible `is_offline` card kill-switch now settable from the admin console |
| 7 | 2.3.1 | `/products/watch` + `/products/wallet` get native-only "how it works today" clarifiers (no watchOS app claim in-app) |
| 8 | 5.1.1 | Office OWNERS see explicit team-consequence disclosure before deleting (team sub cancels immediately) |
| 9 | 5.1.1/2.1 | Email-reuse copy corrected to match the real 30-day purge behavior |
| 10 | — | AASA adds `/join/*` (office invites open in the app); comment corrected |
| 11 | — | Native OAuth `next` stash moved to localStorage (survives cold kill mid-OAuth) |
| 12 | Privacy | `PrivacyInfo.xcprivacy` created for App target (UserDefaults CA92.1 + 1C8F.1, collected-data types) and SwiftCardWidget (1C8F.1); app manifest wired into the Xcode Resources build phase; both plutil-validated |
| 13 | — | Info.plist `UIRequiredDeviceCapabilities` armv7 → arm64 |
| 14 | Security | `allowNavigation` drops unused OAuth provider hosts (system-browser flow makes them dead attack surface) |
| 15 | Security | Rate limits on 8 previously-uncapped authenticated routes (AI, exports, delete, upload, draft claim, push subscribe) |
| 16 | Security | push endpoint shape validation; GIF magic-byte check; token-crypto AES-CBC → AES-GCM (legacy readable); unsubscribe + OAuth-state HMACs fail closed |
| 17 | Security (DB, applied to prod) | RLS enabled on `push_subscriptions`/`card_events`/`analytics_events` (all service-role-only access — zero behavior change); `search_path` pinned on 7 functions; public-bucket listing policy dropped. Recorded in `supabase/ios-audit-security-hardening.sql` |
| 18 | 2.1 (file downloads) | WKWebView can't save Blob/attachment downloads. Native now hands off to the system browser / share sheet: Save Contact `.vcf` → new public `text/vcard` endpoint via SFSafariViewController (real "Add to Contacts"); in-app contact `.vcf` → existing server route; CSV export (contacts + office analytics) → system browser; QR/card-image PNG → native share sheet. Web keeps its working Blob paths (all native-gated). Endpoint verified: valid escaped vCard for active cards, 404 for offline/bogus |
| 19 | Security (SSRF) | push endpoint validation now rejects private/loopback/metadata hosts at registration AND re-checks at delivery (`assertSafeUrl`) — closes a blind-SSRF-via-web-push primitive |
| 20 | Security | upload rate limit moved to the expensive POST handler (was on cheap DELETE); `messaging.ts` secret read lazily like the sibling libs |

## Verified sound (no action needed)

- 3.1.1 suppression architecture: hydration-safe `useIsNativeApp`/`NativeHidden`/
  `PlanGate` applied at ~30 verified render sites; AI help assistant has
  server-side native guardrails; sales chat never mounts natively.
- No IAP obligation: the app sells nothing and links to no purchase flow —
  compliant under 3.1.1 (mandatory IAP triggers only on in-app unlocking).
  See `STOREKIT_CONFIGURATION_GUIDE.md` for the full decision record.
- Deletion flow is 5.1.1(v)-compliant: in-app, no support contact required,
  true deletion after a disclosed 30-day window, Stripe cancel, Apple token
  revocation implemented (activates with the `APPLE_*` env vars).
- Custom-scheme OAuth callback is injection-safe (PKCE + `swiftcard:` protocol
  check + internal-path-only redirects); signed OAuth state; draft claims
  session-bound; no IDOR found in core routes; no secrets in repo/history/bundle.
- Privacy policy matches actual behavior (processors, retention, deletion,
  SMS, analytics). Terms carry the Apple EULA clauses. `/privacy`, `/terms`,
  `/contact` all public, no login wall.
- No tracking per Apple's ATT definition — no ad SDKs at all; no ATT prompt
  needed; labels stay "no tracking".

## Remaining blockers (owner actions — cannot be done from this machine)

1. **Sign in with Apple provider** (Supabase + Apple Developer) — the button
   ships broken without it; near-certain 4.8 rejection. SHELL-RUNBOOK §4.
2. **Real Team ID in the AASA** (`TEAMID_PLACEHOLDER`) + site deploy — Universal
   Links dead until then. SHELL-RUNBOOK §3.
3. **Xcode build + real-device test round** — this machine has no Xcode; the
   shell has NEVER been compiled. Runbook §5–7 + `TESTFLIGHT_TEST_PLAN.md`.
4. **Widget target creation in Xcode** (SHELL-RUNBOOK §6b) — until done, either
   build it or keep the wallet-page widget mention accurate (the native
   clarifier added this pass covers the interim).
5. **APNs key + env vars** — push is the strongest 4.2 mitigation; activate
   before submitting. Runbook §6.
6. **App Store Connect setup** — privacy labels, age-rating questionnaire (2025
   version), screenshots (6.9-inch class), demo account, review notes. See
   `APP_STORE_CONNECT_CHECKLIST.md`.
7. **Apple private-email-relay registration** (if Sign in with Apple ships):
   register swiftcard.me sending domains, or Hide-My-Email users receive no
   receipts/lead notifications.
8. **Supabase dashboard**: enable leaked-password protection (one toggle).
9. **Push to origin** — this pass's commits are local-only (pushing main
   auto-deploys production, which required approval this run did not have).

## Final adversarial round (3 independent reviewers)

A strict-Apple-reviewer, a correctness reviewer, and a security attacker each
ran against the finished state. Everything they surfaced was fixed (commit
`6e3f207`) or is a documented owner step:

- **2.1 file downloads** (strict reviewer, LIKELY): fixed — see rows 18 above.
  This was the real remaining code-side exposure; the reviewer correctly noted
  CSV export sat ungated in front of the Pro demo account.
- **Blind SSRF via push endpoint** (security, MEDIUM): fixed — row 19.
- **Upload rate-limit on wrong handler** (correctness, MEDIUM): fixed — row 20.
- **Office-member in-app deletion** (strict reviewer, "request info"): framed
  as the managed-account 5.1.1 carve-out; not on the demo path. See
  `KNOWN_LIMITATIONS.md`.
- All three confirmed the 3.1.1 selling suppression is airtight and found no
  new path to a price in native mode; no secrets; no IDOR; XSS/CSRF on the new
  admin-takedown and report surfaces all defeated.

The residual risk is now entirely the **owner steps + on-device verification**,
not unfixed code. The download handoffs use the standard, correct native
pattern but have NOT been run on a device — they are the top items in
`TESTFLIGHT_TEST_PLAN.md`.

## Honest risk assessment

- **4.2 minimum functionality remains the structural risk** for a remote-URL
  shell. Mitigations shipped: native login via system browser, push (needs the
  APNs key), Wallet, share sheet, widget (needs the Xcode target), universal
  links, native design layer, offline fallback. Expect 1–2 review rounds.
- **Deferred by design** (documented in KNOWN_LIMITATIONS.md): in-app
  purchasing (none in v1), office seat billing (web-only), NFC tag writing in
  the shell (manual path provided), watchOS app (roadmap).
