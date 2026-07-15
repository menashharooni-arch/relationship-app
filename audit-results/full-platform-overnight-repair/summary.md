# SwiftCard — Overnight Full-Platform Audit & Repair

**Branch:** `audit/full-platform-overnight-repair` (based on `main`). Nothing
merged to `main`; nothing deployed. `tsc` clean · `vitest` 297/297 · `next build`
succeeds.

**Honest scope note:** this was a code-level audit + repair with public-surface
browser testing. **Authenticated browser E2E and Stripe test-mode flows could
NOT run** (only a production Supabase is configured; no Stripe keys locally), so
those rest on the test suite, the build, and read-audits. Do not read this as
"fully tested in a live environment." See `unresolved-items.md`.

---

## 1. Overall status
Stable and buildable. This session shipped the three requested feature sets
(office sub-users; Settings/LinkedIn/admin-email; marketing parity + traffic
graph), then ran a five-area audit that found and fixed **1 Critical, 5 High,
and ~8 Medium** confirmed issues, with the rest documented. The most important
open item is not code — it's **verifying RLS on the base tables in Supabase**
(unresolved-items §2).

## 2–6. Coverage
- **Routes reviewed:** 48 pages, 91 API routes, the proxy, 3 layouts (`route-inventory.md`).
- **Controls:** key surfaces inventoried in `control-inventory.md`.
- **Roles/plans:** logged-out, Free, Pro, Office Admin, Office sub-user, site-owner admin — reasoned statically + matrix in `test-matrix.md`; public-surface + logout redirects verified in-browser.
- **Stripe flows:** audited by code; live runs BLOCKED (no keys).
- **Templates × screen sizes:** responsive strategy verified by code (CardScaler); homepage checked at 375px in-browser.

## 7. Issues found (by severity)
- **Critical: 1** — webhook dropped failed events permanently.
- **High: 5 fixed** (lead-tag cross-org injection/paywall bypass; change-plan seat-slam member deletion; office sub-user save-lockout [regression from this session]; team-switch orphaned enterprise; legacy-profile-card brand bypass) **+ 2 High documented-not-fixed** (billing #2 event ordering, #3 seat proration — need live Stripe).
- **Medium: ~15** — IP-spoof rate-limit bypass, upload path traversal, Twilio fail-open, retention replay, public-card plan-leak, stale OG image, double-create, customization-crash guards, empty-name, /api/profile data loss, cleared-contact propagation, plus modal/label accessibility (documented).
- **Low/Info: ~25** — in the per-area findings.

## 8. Issues fixed this session (19 fixes, 4 audit commits)
- **Security** (`0a13ac0`): lead-tag sanitization, client-IP rate-limit keys, upload path traversal, Twilio fail-closed, retention once-per-customer.
- **Billing** (`0328edc`): webhook dedup release-on-failure, change-plan seat clamp + idempotency, deleted-handler office-member restore, sub-user own-sub management, resend seat gate, unmapped-price alert, null-period-end guard, invite-email status.
- **Office** (`d5bc047`): save-lockout fix + design propagation + cleared-contact strip, team-switch reorder + brand strip, legacy-profile-card enforcement + customization merge + logo_url.
- **Cards/public** (`44801c6`): links-page crash guard, plan-sanitized public card, Array guards, OG kill-switch, double-create guard, name validation, vCard office label + tel: sanitize.

## 9. Tests added
`tests/lead-tags.test.ts` (6 cases) and 2 save-lockout regression cases in
`tests/office-managed-fields.test.ts`. Suite: 281 → **297 passing**.

## 10. Commits
12 on the branch: `git log --oneline 7f1dc71..HEAD`.

## 11–14. Findings by area
`security-findings.md`, `stripe-findings.md`, `office-findings.md`,
`card-findings.md`, `performance-findings.md`, `ui-findings.md`.

## 15–18. Remaining decisions / credentials / migrations / env
Consolidated in **`unresolved-items.md`**. Headlines:
- **Run** `supabase/admin-email-log.sql`.
- **Verify RLS** on `profiles`/`cards`/`leads` in Supabase (highest priority).
- **Run the 8 Stripe test-mode checks**; decide on billing #2/#3.
- **Stand up staging** for authenticated E2E.

## 19. Commands to run next
```
git checkout audit/full-platform-overnight-repair
npm ci && npx tsc --noEmit && npm test && npm run build   # all green
git diff --stat main...HEAD                                # review the diff
# then, with test-mode Stripe keys + staging Supabase, run the BLOCKED checks
```

## 20. Ready for review & merge?
**Ready for your review; not yet ready to merge unattended.** The code is green
and the fixes are conservative (fail-closed / correctness), but two things gate
a merge and need access I don't have: (a) verifying base-table RLS in Supabase,
and (b) running the Stripe test-mode checks. Security and billing commits are
isolated so they can be reviewed or reverted independently.
