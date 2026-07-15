# Unresolved items — needs your decision, credentials, or a manual step

## 1. Database migrations to run (Supabase SQL editor) — REQUIRED
Both are additive and idempotent; the app runs without them but with reduced
functionality until applied:
- **`supabase/admin-email-log.sql`** — the admin sent-email campaign log + the
  `email_logs.campaign_id/error` columns. Until run, "View sent emails" shows a
  "run this SQL" notice and campaigns aren't logged (sending still works).
- **`supabase/office-uniform-fields.sql`, `office-primary-card.sql`,
  `office-roles.sql`, `office-lifecycle-audit.sql`, `office-branding.sql`** —
  if any weren't already applied in prod, the office sub-user features degrade
  gracefully but won't fully enforce. Verify they're present.

## 2. Verify in the Supabase dashboard — HIGH PRIORITY (can't be checked from code)
- **RLS on the base tables.** `profiles`, `cards`, `leads`, `notifications`,
  `card_views` are created outside this repo. Confirm RLS is ENABLED with no
  client-writable policy — especially that a user's own JWT cannot UPDATE
  `profiles.plan` / `stripe_customer_id` / `stripe_subscription_id` /
  `customization` via PostgREST. If it can, the app-layer authorization and the
  grace-period/retention guards are all bypassable. **This is the single most
  important verification.**
- **`card-uploads` storage bucket** write policy restricts to `auth.uid()/…`.
- **`stripe_events` table exists** in prod (webhook idempotency depends on it).

## 3. Stripe test-mode verification — BLOCKED (no keys locally)
The billing code fixes are committed but not run against Stripe. Before merging,
run the 8 checks in `stripe-findings.md` → BLOCKED, with test-mode keys and a
test clock. Two HIGH findings are documented-but-NOT-fixed because they change
charge behavior and must be verified live: **#2** (out-of-order webhook events
trimming members) and **#3** (scheduled seat reductions billed a full extra
cycle). Decide how to handle those two after reproducing them.

## 4. Authenticated browser E2E — BLOCKED (no non-prod environment)
The only configured Supabase project is production; I did not create test users
against it. To exercise dashboard/settings/office/sub-user flows in a browser,
stand up a **staging Supabase** (or `supabase start` locally) with seeded
disposable data, then run Playwright across the six roles (matrix in
`test-matrix.md`). Until then, authenticated logic rests on the 297-test vitest
suite, type checking, the production build, and the read-audits.

## 5. Provider / env settings to confirm
- `RESEND_API_KEY` + verified sending domain (else all email no-ops).
- `LINKEDIN_CLIENT_ID/SECRET` — required for "Suggest my profile picture" to
  appear; without them the button is hidden and manual upload is the only path
  (this is intended, documented behavior).
- `UPSTASH_REDIS_REST_URL/TOKEN` — else rate limits only throttle per warm
  instance.
- `TWILIO_AUTH_TOKEN` — now REQUIRED in production (inbound SMS fails closed).
- `STRIPE_RETENTION_COUPON_ID` — retention offer no-ops without it (now guarded
  once-per-customer regardless).

## 6. Dependency vulnerabilities — no action taken (by policy)
`npm audit`: 0 critical, 0 high, 4 moderate — all only "fixable" via breaking
downgrades (e.g. `next@9`), which the audit policy forbids. Bump `next` when a
16.2.x patch ships the postcss fix; re-run `npm audit`. See
`performance-findings.md`.

## 7. Not fixed overnight (documented, deliberate) — your call
- Billing #2, #3, #7, #9 (see stripe-findings) — need live Stripe / change money.
- Office M2, M4, L1–L7 (see office-findings) — lower risk / judgment calls.
- Card M6, M7, L1, L4–L12 (see card-findings) — accessibility & polish; the
  modal-a11y and label-association work is a good focused follow-up (touches
  ~10 components, not safe to sweep blind overnight).
- The 6 pre-existing `react-hooks/set-state-in-effect` lint errors (non-blocking).

## 8. Branch state
All work is on **`audit/full-platform-overnight-repair`** (based on `main`,
which already carries this session's feature work). Nothing merged to `main`,
nothing deployed. `tsc`, `vitest` (297 pass), and `next build` are all green on
the branch.
