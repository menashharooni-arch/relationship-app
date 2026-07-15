# SwiftCard — Overnight Full-Platform Audit

Branch: `audit/full-platform-overnight-repair` (based on `main` incl. the Office
sub-user, Settings-reorg, LinkedIn→photo-suggest, admin-email-log, and traffic-
graph work committed earlier this session).

Status: IN PROGRESS. This file is updated as areas complete.

## Constraints honored
- Not merged to main; not deployed to production.
- No Stripe live actions (no Stripe keys present in local env — Stripe test-mode
  flows are BLOCKED and documented in stripe-findings.md).
- No real campaign emails sent; disposable test data only.
- No secrets committed.

## Area status
- Security / authz / RLS / privacy: pending
- Stripe / billing / seats: pending (partly blocked — no local keys)
- Office / invites / branding: pending
- Cards / public rendering / mobile / a11y: pending
- Route + control inventory, test matrix: pending
- Browser E2E (Playwright): pending
- Final validation (tsc / vitest / build): pending
