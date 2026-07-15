# SwiftCard Route Inventory

Generated 2026-07-15 by reading the code (read-only audit). Paths relative to repo root.

## Middleware / proxy protection

`src/proxy.ts` — Supabase SSR session refresh + auth gate.

- **Matcher:** `/dashboard/:path*`, `/onboarding/:path*`, `/profile/:path*`, `/templates/:path*`, `/cards/:path*`, `/settings/:path*`, `/office/:path*`, `/contacts/:path*`
- Logged-out users hitting a protected path are redirected to `/login`, **except** `/cards/new` (guest card builder is deliberately open; gating happens on publish/save inside the wizard).
- Soft-deleted accounts (profile `customization._deleted === true`) on protected paths are redirected to `/account-deleted` (closes the "access token still valid for up to 1h after delete" hole).
- Note: `/admin`, `/grow`, `/share`, `/welcome`, `/upgrade`, `/checkout` are **not** in the matcher — each of those pages does its own server-side `getUser()`+redirect (verified below); `/admin` is gated in `src/app/admin/layout.tsx`.

## Auth architecture (shared guards)

- `src/lib/admin.ts` — `isAdminEmail()` / `requireAdmin()`: site-owner admin gated by `ADMIN_EMAILS` env var. Used by `src/app/admin/layout.tsx` and all 13 `/api/admin/*` routes.
- `src/lib/office-admin-guard.ts` — `requireOfficeAdmin()`: login + `plan === "enterprise"` + office role capability check; used by `src/app/office/admin/layout.tsx` and each office admin page (pages also re-check capabilities like `caps.canBrand`).
- `src/lib/office-roles.ts` — role model (`owner | admin | manager | billing_admin | employee`), `requireOfficeCapability()` used by office API routes.
- Cron auth: `/api/reminders` requires `Authorization: Bearer $CRON_SECRET` (rejects if env unset).
- Stripe webhook: signature-verified via `constructEvent` + `STRIPE_WEBHOOK_SECRET`.
- Twilio inbound: `x-twilio-signature` validated (skippable via `TWILIO_SKIP_VALIDATION=true`).
- Public ingest routes (views/analytics/card-events/leads) are unauthenticated by design but IP+slug rate-limited (`src/lib/rate-limit.ts`), gated on `isCardActive()`, and owner self-traffic is excluded server-side (`src/lib/self-traffic.ts`).

---

## Page routes (48)

### Public marketing site (no auth)

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/` | `src/app/page.tsx` | none | Marketing landing page |
| `/pricing` | `src/app/pricing/page.tsx` | none (client) | Plans/pricing with checkout links |
| `/compare` | `src/app/compare/page.tsx` | none | SwiftCard vs Linktree/Popl/Blinq comparison |
| `/products/[slug]` | `src/app/products/[slug]/page.tsx` | none | Per-feature product marketing pages (static catalog, 404 on unknown slug) |
| `/testimonials` | `src/app/testimonials/page.tsx` | none | Testimonials page |
| `/preview` | `src/app/preview/page.tsx` | none | Live interactive demo of cards/links/signature |
| `/contact` | `src/app/contact/page.tsx` | none (client) | Contact form → POST /api/contact |
| `/privacy`, `/terms` | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` | none | Legal pages |
| `/unsubscribe` | `src/app/unsubscribe/page.tsx` | none | Email unsubscribe landing (token in query) |

### Public card surfaces (no auth; kill-switched by `isCardActive`)

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/card/[username]` | `src/app/card/[username]/page.tsx` | none | The public digital business card (lead capture, save contact, wallet) |
| `/links/[username]` | `src/app/links/[username]/page.tsx` | none | Swift Links (link-in-bio) page for a card |

### Auth / onboarding

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | none | Login/signup (Supabase, incl. Google OAuth) |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx` | recovery session | Set a new password |
| `/onboarding` | `src/app/onboarding/page.tsx` | required (proxy + page) | Provisions account-only profile, applies referral cookies, redirects on |
| `/welcome` | `src/app/welcome/page.tsx` | required (page redirect) | Post-signup step: notifications + plan choice; skipped if already paid |
| `/welcome/team` | `src/app/welcome/team/page.tsx` | required (page redirect) | Invited employee's first-card setup (org branding applied server-side) |
| `/join/[token]` | `src/app/join/[token]/page.tsx` | none to view; login to accept | Office invite landing; accept → POST /api/join |
| `/account-deleted` | `src/app/account-deleted/page.tsx` | optional | Deleted-account landing; reopen within 30-day grace |

### Dashboard & cards (proxy-protected; all roles with account)

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | proxy + page redirect | Main hub: card list/preview, share, QR, analytics, notifications |
| `/cards/new` | `src/app/cards/new/page.tsx` | **guest-open** (proxy exempt) | New-card wizard; guests build, gated at publish/claim |
| `/cards/[id]/edit` | `src/app/cards/[id]/edit/page.tsx` | proxy + ownership (loads card scoped to user; office-managed fields locked for sub-users) | Card editor |
| `/contacts` | `src/app/contacts/page.tsx` | proxy + page redirect | Leads/contacts CRM view (free plan lead-lock via `LOCKED_LEAD_TAG`) |
| `/profile` | `src/app/profile/page.tsx` | proxy + page redirect | Legacy profile/account form + flow settings + email prefs |
| `/profile/card` | `src/app/profile/card/page.tsx` | proxy + page redirect | Edit the profile-based primary card (legacy path into CardEditForm) |
| `/templates` | `src/app/templates/page.tsx` | proxy (client page) | Template gallery/picker |
| `/share` | `src/app/share/page.tsx` | page redirect (not in proxy matcher) | Share hub: link, QR, email signature, wallet |
| `/grow` | `src/app/grow/page.tsx` | page redirect | Referral / rate-us / word-of-mouth hub |
| `/settings/flows` | `src/app/settings/flows/page.tsx` | proxy + page redirect | Settings: automations, integrations, Zapier, cards, billing, account |

### Billing / upgrade

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/checkout` | `src/app/checkout/page.tsx` | none (resumes after login) | Order-summary confirmation step before Stripe; preserves plan/interval/seats in URL |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | page redirect | Post-payment router only (webhook provisions plan) |
| `/upgrade` | `src/app/upgrade/page.tsx` | page redirect | In-product upgrade screen for Free users |

### Office (team) admin — plan `enterprise` + office role via `requireOfficeAdmin`

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/office` | `src/app/office/page.tsx` | proxy | Redirect shim → `/office/admin` |
| `/office/admin` | `src/app/office/admin/page.tsx` | layout guard | Team overview: stats, members, attention list, create-office form |
| `/office/admin/team` | `.../team/page.tsx` | layout guard | Team member list |
| `/office/admin/team/[id]` | `.../team/[id]/page.tsx` | layout + membership check (`teamIds.includes(id)` else 404) | Member detail/activity |
| `/office/admin/cards` | `.../cards/page.tsx` | layout guard | All team cards |
| `/office/admin/cards/[id]` | `.../cards/[id]/page.tsx` | layout + `caps.canManageCards` + card must be in this office's list | Card detail + admin actions |
| `/office/admin/invite` | `.../invite/page.tsx` | layout guard | Invite flow (seats) |
| `/office/admin/leads` | `.../leads/page.tsx` | layout guard | Office-wide leads table |
| `/office/admin/branding` | `.../branding/page.tsx` | layout + `caps.canBrand` | Team branding editor |

### Site-owner admin — `ADMIN_EMAILS` via `src/app/admin/layout.tsx`

| Path | File | Purpose |
|---|---|---|
| `/admin` | `src/app/admin/page.tsx` | Overview (client fetches /api/admin/analytics) |
| `/admin/analytics` | `src/app/admin/analytics/page.tsx` | Platform analytics |
| `/admin/users`, `/admin/users/[id]` | `src/app/admin/users/...` | User list / user detail + plan management |
| `/admin/plans` | `src/app/admin/plans/page.tsx` | Plan/promo management |
| `/admin/referrals` | `src/app/admin/referrals/page.tsx` | Referral program stats |
| `/admin/marketing` | `src/app/admin/marketing/page.tsx` | Broadcast email / promo-code sender (MarketingClient) |

---

## API routes (91)

Legend: Auth = requires signed-in user (getUser 401). Own/Role = ownership, role, or plan gating beyond login.

### Account

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/account/delete` | POST | yes | self only | Soft-delete account (30-day grace), cancels Stripe |
| `/api/account/downgrade` | POST | yes | self only | Pro→Free downgrade; won't flip plan if Stripe cancel fails |
| `/api/account/reopen` | POST | yes | self only | Reopen soft-deleted account within grace |
| `/api/account/retain` | POST | yes | self; office sub-users blocked | Apply retention coupon ("free month" offer) |

### Cards

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/cards` | GET, POST | yes | user-scoped; plan card-limit; office brand overlay on create | List/create cards |
| `/api/cards/[id]` | GET, PATCH, DELETE | yes | `eq("user_id", user.id)`; office-managed fields locked for sub-users; deleted-account 403 | Read/update/delete a card |
| `/api/drafts/claim` | POST | yes | claims guest draft into caller's account; plan limits | Guest wizard → account card claim |
| `/api/card-share-image` | POST | yes | own usernames only (`getOwnerUsernames`) | Store card PNG for OG share preview |
| `/api/card-signature` | POST | yes | own usernames only | Store card PNG for email signature |
| `/api/wallet/pass` | GET | **none (public by design)** | `isCardActive` kill-switch | Signed .pkpass for a public card |
| `/api/watch/card` | GET | yes (cookie or Bearer JWT) | self | Watch-app card sync contract |
| `/api/upload` | POST, DELETE | yes | card rows updated with `.eq("user_id", user.id)` | Image upload (photo/logo, 5MB, sharp resize) / clear |
| `/api/logo-suggest` | POST | yes | — | Company logo candidate lookup (quota-guarded) |
| `/api/img-proxy` | GET | none | SSRF-guarded (`safeFetch`), IP rate-limited | Image proxy for html2canvas card capture |
| `/api/link-preview` | GET | none | SSRF-guarded, rate-limited | OG image/title fetch for Swift Links thumbnails |

### Public ingest (card viewers)

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/views/[username]` | POST | none | rate-limited, `isCardActive`, owner self-view excluded | Record card view |
| `/api/analytics/event` | POST | none | rate-limited, active-card check, 4KB payload cap | Record analytics event |
| `/api/card-events` | POST, GET | POST none / GET yes | POST rate-limited + self-excluded; GET owner-scoped | Card interaction events (taps etc.) |
| `/api/leads` | POST | **none (public lead capture)** | rate-limited, tag whitelist, plan lead-limits, offline-card check | Visitor submits contact info on a card |
| `/api/contact` | POST | none | IP rate-limited, HTML-escaped | Marketing site contact form → staff inbox |

### Leads / contacts (owner-side)

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/leads/[id]` | PATCH, DELETE | yes | lead owned by user | Edit/delete a lead |
| `/api/leads/[id]/message` | GET, POST | yes | owned lead; Pro for SMS | Message history / send follow-up |
| `/api/leads/[id]/generate-sequence` | POST | yes | owned lead; AI-draft plan quota | AI follow-up sequence draft |
| `/api/leads/[id]/reminders` | GET | yes | owned lead | Lead reminder list |
| `/api/leads/manual` | POST | yes | own account; plan lead limit | Manually add a contact |
| `/api/leads/export` | GET | yes | paid plan (CSV export is Pro) | Export leads CSV |
| `/api/leads/vcard` | GET | yes | owned lead | Download lead vCard |
| `/api/leads/share-card` | POST | yes | owned lead | Send your card to a lead |
| `/api/scanner` | POST | yes | plan scan quota | AI paper-card scanner (vision OCR) |
| `/api/scanner/send` | POST | yes | rate-limited | Email your card to a scanned contact |
| `/api/sms/send` | POST | yes | paid plan; opt-out respected | Send SMS to a lead |
| `/api/reminders` | GET | **CRON_SECRET bearer** | n/a | Cron: automations, trial emails, purges, seat reductions |

### AI

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/ai/help` | POST | yes | — | In-app help assistant |
| `/api/ai/sales` | POST | **none (public by design)** | IP rate-limited, size-capped | Marketing-site sales chatbot |
| `/api/ai/suggest-messages` | POST | yes | plan quota | AI message suggestions |

### Office (team)

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/office` | GET, POST | yes | caller-pinned queries (RLS bypassed deliberately); enterprise plan | Get/create office |
| `/api/office/invite` | POST | yes | `requireOfficeCapability("invite")`-style check; seat limits | Invite a team member |
| `/api/office/decline` | POST | none (invite token is proof) | token lookup; idempotent | Invitee declines invite (releases seat) |
| `/api/join` | POST | yes | invite token + email match; seat activation | Accept invite, join office |
| `/api/office/members` | DELETE | yes | remove capability; owner protections | Remove member / revoke invite |
| `/api/office/role` | POST | yes | owner/admin only; assignable-role check | Change member role |
| `/api/office/brand` | PATCH | yes | `requireOfficeCapability("manage_branding")` | Update team branding |
| `/api/office/cards` | GET | yes | office-scoped | List team cards |
| `/api/office/cards/[id]` | PATCH | yes | card in caller's office; manage-cards capability | Admin edit of a team card |
| `/api/office/leads/[id]` | PATCH | yes | lead in caller's office | Update office lead status |

### Stripe / billing

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/stripe/checkout` | POST | yes | blocks already-subscribed; promo validation server-side | Create Stripe Checkout session |
| `/api/stripe/portal` | POST | yes | own customer id | Stripe billing portal session |
| `/api/stripe/subscription` | GET | yes | own subscription | Subscription status for Billing UI |
| `/api/stripe/subscription/cancel` | POST | yes | own subscription | Cancel at period end |
| `/api/stripe/subscription/keep` | POST | yes | own subscription | Undo scheduled cancel |
| `/api/stripe/subscription/change-plan` | POST | yes | own sub; server-side price mapping | Monthly↔annual / pro↔office changes |
| `/api/stripe/subscription/preview` | POST | yes | own sub | Proration preview |
| `/api/stripe/subscription/discount` | POST | yes | own sub | Apply retention discount |
| `/api/stripe/subscription/seats` | GET, POST | yes | office owner/billing capability; seat math | View/change Office seat count |
| `/api/stripe/webhook` | POST | Stripe signature | n/a | Provisioning: plan flips, seats, trials, cancellations |
| `/api/promo/redeem` | POST | yes | one-per-user, expiry/max-use checks | Redeem promo code |
| `/api/referrals/claim` | GET, POST | yes | device-hash anti-abuse | Referral reward claim/status |

### Integrations

| Route | Methods | Auth | Own/Role | Purpose |
|---|---|---|---|---|
| `/api/integrations/google/connect` | GET | yes | — | Start Google Contacts OAuth (state via `oauth-state`) |
| `/api/integrations/google/callback` | GET | state token (HMAC oauth-state) | state → user id | OAuth callback, stores encrypted tokens |
| `/api/integrations/google` | DELETE | yes | self | Disconnect Google |
| `/api/integrations/hubspot/connect` / `callback` / `` | GET / GET / DELETE | yes / state / yes | same pattern | HubSpot CRM sync connect/callback/disconnect |
| `/api/integrations/linkedin/connect` / `callback` / `` | GET / GET / GET,POST,DELETE | yes / state / yes | same pattern | LinkedIn import connect/callback/manage |
| `/api/settings/zapier` | PATCH, POST | yes | self; webhook URL validated (`isZapierWebhookUrl`) | Zapier webhook config/test |
| `/api/settings/crm` | PATCH | yes | self | CRM event dispatch settings |

### Settings / misc (authed, self-scoped)

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/profile` | PATCH | yes | Update own profile fields |
| `/api/settings/flows` | GET, PATCH | yes | Automation flow settings |
| `/api/settings/email-preferences` | GET, PATCH | yes | Marketing email prefs |
| `/api/notifications` | GET, PATCH, DELETE | yes | In-app notification feed (own rows) |
| `/api/push/subscribe` | POST, DELETE | yes | Web-push subscription management |
| `/api/welcome` | POST | yes | Send welcome email to self |

### Unsubscribe / inbound (token- or signature-authenticated)

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/unsubscribe` | GET, POST | unsubscribe token | RFC 8058 one-click marketing unsubscribe |
| `/api/unsubscribe/contact` | GET, POST | token | Per-contact automation unsubscribe |
| `/api/twilio/inbound` | POST | Twilio signature | Inbound SMS webhook (STOP/START opt-out) |

### Site-owner admin APIs — all 13 call `requireAdmin()` (ADMIN_EMAILS) and 403 otherwise

| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/analytics` | GET | Platform metrics |
| `/api/admin/users` | GET | User search/list |
| `/api/admin/users/[id]` | GET, PATCH | User detail / edits |
| `/api/admin/users/export` | GET | CSV export of users |
| `/api/admin/set-plan` | PATCH | Manually set a user's plan |
| `/api/admin/create-card` | POST | Create a card for a user |
| `/api/admin/promo-codes` | GET, POST, DELETE | Manage promo codes |
| `/api/admin/promo-codes/send` | POST | Email promo codes |
| `/api/admin/broadcast` | GET, POST | Marketing broadcast email |
| `/api/admin/broadcast/logs` (+`/[id]`) | GET | Broadcast send logs |
| `/api/admin/referrals` | GET | Referral program admin view |
| `/api/admin/email-domain` | GET, POST | Resend sending-domain management |

---

### Notable observations (not fixed — inventory only)

1. **Deliberately public endpoints** are all documented in-code with rate limiting: `/api/leads` POST, `/api/views/*`, `/api/analytics/event`, `/api/card-events` POST, `/api/ai/sales`, `/api/wallet/pass`, `/api/img-proxy`, `/api/link-preview`, `/api/contact`, `/api/office/decline` (token-proof). No route was found with a missing auth check that looked accidental.
2. `/share`, `/grow`, `/welcome`, `/upgrade`, `/checkout/success` are not in the proxy matcher and rely solely on their own in-page `getUser()` redirect — consistent, but the deleted-account redirect in proxy.ts does **not** cover them (page-level checks would still load for a soft-deleted session on `/share`/`/grow` unless those pages check `_deleted` themselves).
3. `/api/upload` DELETE with `field === "logo"` scopes by `user_id` correctly; profile-level clears are self-scoped via RLS client.
4. `TWILIO_SKIP_VALIDATION=true` env flag disables Twilio signature verification (dev convenience; risk if set in prod).
5. Office API routes intentionally use the service-role client with explicit in-code authorization because offices/office_members RLS is mutually recursive (documented in `src/app/api/office/route.ts`).
