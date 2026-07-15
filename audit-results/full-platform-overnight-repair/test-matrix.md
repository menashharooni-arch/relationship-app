# SwiftCard Role × Flow Test Matrix

Generated 2026-07-15. Roles:

- **LO** — Logged-out visitor
- **Free** — signed-in, `plan = "free"`
- **Pro** — signed-in, `plan = "pro"`
- **OA** — Office Admin (`plan = "enterprise"`, office owner/admin/manager/billing_admin role)
- **OS** — Office sub-user (`plan = "enterprise"`, role `employee`, active member)
- **SA** — Site-owner admin (email in `ADMIN_EMAILS`; plan-independent)

Outcome legend: ✅ can access · ⛔ blocked (redirect/403) · ◐ partial (feature-gated) · N/A not applicable.

**Coverage legend:** `unit:<file>` = logic covered by an existing vitest file in `tests/` (helper-level only — none of the tests exercise HTTP routes, redirects, or UI). **E2E** = needs manual or browser/e2e verification (no existing coverage). The vitest suite (31 files) is entirely unit tests over `src/lib` helpers; **no test hits a page or API route**, so every access-control cell below needs e2e/manual verification even where the underlying rule has a unit test.

## 1. View dashboard (`/dashboard`)

| Role | Expected | Enforced by | Coverage |
|---|---|---|---|
| LO | ⛔ → `/login` | proxy matcher | E2E |
| Free | ✅ (upgrade prompts shown) | proxy | E2E |
| Pro | ✅ | proxy | E2E |
| OA | ✅ (+ "Admin" link to /office/admin via `canViewOfficeAdmin`) | page logic | E2E; role logic unit:office-roles.test.ts |
| OS | ✅ (no office-admin link) | `canViewOfficeAdmin` | unit:office-roles.test.ts (capability) + E2E |
| SA | ✅ (+ `/admin` link) | `isAdminEmail` | E2E |

## 2. Create card (`/cards/new`, POST `/api/cards`, POST `/api/drafts/claim`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ✅ wizard (guest mode); ⛔ publish until signup → claim | unit:guest-draft.test.ts (claim ownership + plan gating), unit:username.test.ts (slug); E2E for the gate modal/login loop |
| Free | ◐ 1 card max (`PLAN_LIMITS`); Pro design keys stripped | unit:plan.test.ts (sanitizeCustomizationForPlan), unit:card-customization.test.ts; card-count limit itself E2E |
| Pro | ✅ unlimited, custom designer | unit:card-customization.test.ts + E2E |
| OA | ✅; card becomes office primary/brand source | unit:office-brand-overlay.test.ts + E2E |
| OS | ✅ via `/welcome/team`; org branding forced onto card | unit:office-brand-overlay.test.ts, office-design-lock.test.ts + E2E |
| SA | ✅ (as their own user); also `/api/admin/create-card` for others | E2E |

## 3. Edit card (`/cards/[id]/edit`, PATCH `/api/cards/[id]`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ → `/login` (proxy) | E2E |
| Free | ✅ own card only (`eq user_id`); style keys stripped | ownership: E2E (route check); gating unit:card-customization.test.ts |
| Pro | ✅ own card only | E2E |
| OA | ✅ own card; team cards via `/office/admin/cards/[id]` (managed fields) | E2E |
| OS | ◐ own card, but office-managed fields/design locked (403 on violation) | unit:office-managed-fields.test.ts, office-design-lock.test.ts; API 403 path E2E |
| SA | own card only (no cross-user editor UI; PATCH `/api/admin/users/[id]` for admin edits) | E2E |
| Any → other user's card id | ⛔ (user_id-scoped query → not found) | **E2E — critical, untested** |

## 4. Public card render (`/card/[username]`, `/links/[username]`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ✅ (active cards only; deleted/offline/plan-deactivated → 404 via `isCardActive`) | kill-switch logic partially unit (card-active used in ingest tests indirectly); render E2E |
| Free owner | ✅ with "Powered by SwiftCard" badge; self-views not counted | self-traffic unit:authz-negative.test.ts; badge E2E |
| Pro owner | ✅ no badge | E2E |
| OA/OS | ✅ branded card | unit:office-brand-overlay.test.ts + E2E |
| SA | ✅ same as any visitor | N/A extra |
| Viewer of an offline/deleted card | ⛔ 404 (incl. wallet pass, views ingest) | E2E |

## 5. Settings sections visible (`/settings/flows`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ → `/login` (proxy) | E2E |
| Free | ✅ page; integrations/Zapier show "Upgrade · Pro" locks | E2E |
| Pro | ✅ all sections incl. integrations, CSV, flows | E2E |
| OA | ✅ + billing shows seat manager | E2E |
| OS | ◐ — no personal billing (retain/downgrade blocked with `officeSubUserBlockMessage`) | unit:office-roles.test.ts (block message fn exists); UI E2E |
| SA | ✅ (normal user settings) | N/A extra |

## 6. Billing access (BillingManager, `/checkout`, `/api/stripe/*`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ API 401; `/checkout` resumes after login | E2E |
| Free | ◐ can start checkout; no subscription to manage | price mapping unit:subscription.test.ts; E2E |
| Pro | ✅ manage/cancel/change-plan/portal (own sub only) | unit:upgrade-direction.test.ts, currency.test.ts; E2E for Stripe round-trip |
| OA | ✅ + seats (min 2, scheduled reductions) | unit:office-seats.test.ts, office-scheduled-seats.test.ts, currency.test.ts; E2E |
| OS | ⛔ personal billing (no sub); seat APIs require capability | unit:office-roles.test.ts (billing capability matrix); API 403 E2E |
| SA | own billing only; plan overrides via `/api/admin/set-plan` | E2E |

## 7. Office admin access (`/office/admin/*`, `/api/office/*`)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ → `/login` (proxy) | E2E |
| Free / Pro | ⛔ → `/pricing` (`plan !== "enterprise"` in `requireOfficeAdmin`) | E2E |
| OA (owner/admin) | ✅ full; branding needs `canBrand`, cards need `canManageCards` | unit:office-roles.test.ts (matrix), office-team-metrics/ui tests (display logic); page gates E2E |
| OA (manager) | ◐ view-only analytics (no invite/remove/brand) | unit:office-roles.test.ts; E2E |
| OA (billing_admin) | ◐ seats/billing only | unit:office-roles.test.ts; E2E |
| OS (employee) | ⛔ → `/dashboard` | unit:office-roles.test.ts (employee has no caps); redirect E2E |
| SA | ⛔ unless they are themselves enterprise (no bypass) | **E2E — worth confirming** |
| OA of office A → office B's card/member ids | ⛔ (office-scoped lookups, 404) | unit:authz-negative.test.ts (resolveBrandTargetIds blast radius) + E2E |

## 8. Invite flow (`/api/office/invite`, `/join/[token]`, `/api/join`, `/api/office/decline`)

| Role | Expected | Coverage |
|---|---|---|
| LO w/ token | ✅ view invite; must sign in to accept; can decline w/o account | unit:office-invite.test.ts (expiry), office-seats.test.ts (reservation); flow E2E |
| Free/Pro invitee | ✅ accept → becomes enterprise sub-user | E2E |
| OA | ✅ send/resend/cancel invites (seat-gated; buy-seat branch) | unit:office-seats.test.ts; UI E2E |
| OS | ⛔ invite capability | unit:office-roles.test.ts; API E2E |
| Wrong-email accept / expired token | ⛔ | unit:office-invite.test.ts (expiry calc); API rejection E2E |

## 9. Referral (`/grow`, `/api/referrals/claim`, signup cookies)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ `/grow` (page redirect); ref cookie set on landing | cookie/attribution unit:referral.test.ts; E2E |
| Free/Pro/OA/OS | ✅ share link, claim free months (device-hash anti-abuse) | unit:referral.test.ts (rules), account-purge n/a; claim API E2E |
| SA | ✅ + `/admin/referrals` overview | E2E |

## 10. Account delete (`/api/account/delete`, `/account-deleted`, reopen)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ 401 | E2E |
| Free | ✅ soft-delete → 30-day grace → purge; protected pages redirect to `/account-deleted` | unit:account-purge.test.ts (purge timing); proxy redirect E2E |
| Pro | ✅ w/ retention offer (discount) & downgrade alternative; Stripe canceled first | E2E (Stripe interaction) |
| OA | ✅/◐ — should be blocked or warned while owning an office (verify) | **E2E — verify behavior** |
| OS | ◐ retain/downgrade blocked (no personal sub); delete leaves office | unit:office-roles block-message; E2E |
| SA | ✅ own account | N/A extra |

## 11. Admin marketing (`/admin/marketing`, `/api/admin/broadcast`, promo codes)

| Role | Expected | Coverage |
|---|---|---|
| LO | ⛔ → `/login` (admin layout) | E2E |
| Free/Pro/OA/OS | ⛔ → `/dashboard` (not in ADMIN_EMAILS); APIs 403 via `requireAdmin` | **E2E — no test asserts the 403** |
| SA | ✅ broadcast, promo create/send/delete, domain check | promo semantics unit:promo.test.ts; send flow E2E |

---

## Coverage summary

- **Existing vitest coverage (tests/, 31 files)** is strong on *business logic*: plan gating (plan, card-customization, guest-draft, template-style), office model (roles, seats, scheduled seats, invites, brand overlay, design lock, managed fields, team metrics/UI), billing math (currency, subscription price mapping, upgrade direction, promo), security helpers (escape, safe-fetch/SSRF, linkedin-oauth state, authz-negative ownership checks, self-traffic), and data formats (vcard, username, social-url, source-labels, watch-contract, account-purge, referral, tour-steps, landing-content).
- **Zero route/UI-level coverage**: no test exercises the proxy redirects, `requireAdmin`/`requireOfficeAdmin` gates, API 401/403 responses, Stripe/webhook flows, or any rendered page. Every ⛔ cell above is enforced in code that has never been executed by the test suite end-to-end.
- **Highest-value e2e/manual checks** (cells marked bold above):
  1. Cross-account card edit attempt (PATCH `/api/cards/[id]` with someone else's id) — 404/403 expected.
  2. Non-admin hitting `/api/admin/*` — 403.
  3. Office admin of office A referencing office B ids on `/office/admin/team/[id]`, `/office/admin/cards/[id]`, `/api/office/cards/[id]`.
  4. Office owner deleting their account while the office has active members.
  5. Soft-deleted session redirect on pages *outside* the proxy matcher (`/share`, `/grow`, `/welcome`).
  6. Site-owner admin (non-enterprise) attempting `/office/admin`.
