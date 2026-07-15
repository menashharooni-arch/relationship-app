# UI / Browser findings

## Environment
- Local `next dev` on :3000, against the project's Supabase (the only configured
  project — **production**).
- Browser automation: Playwright MCP.

## Authenticated E2E — BLOCKED (deliberate, documented)
The only Supabase project in `.env.local` is production. Creating "disposable"
test users, offices, cards, and leads to drive authenticated flows (dashboard,
Traffic graph, Settings, Office admin, sub-user) would **write to the live
production database** and could trigger side effects (analytics rows,
notifications, seat provisioning, emails). Per the audit's own safety rules
("never overwrite real customer data", "safest reasonable decision"), I did
**not** fabricate prod users for browser E2E.

Authenticated browser flows therefore rest on: the vitest suite (289 tests),
type checking, the production build, and static read-audits — not live
click-through. To run authenticated E2E safely you need a **staging Supabase
project** (or a local `supabase start`) with seeded disposable data; see
`unresolved-items.md`.

## Public / unauthenticated surface — VERIFIED
HTTP probes (curl) + Playwright:

| Route | Result |
|-------|--------|
| `/` | 200, page title correct, **0 console errors** |
| `/pricing`, `/compare`, `/products/digital-cards`, `/terms`, `/privacy`, `/login`, `/contact`, `/preview` | 200 |
| `/templates` | 307 → `/login` (gated; expected) |
| `/card/<nonexistent>` | 404 (correct — no crash, no 500) |
| `/cards/new` | 200 logged-out (guest card builder, by design) |

Protected routes correctly redirect to `/login` when logged out:
`/dashboard`, `/settings/flows`, `/office/admin`, `/admin`, `/contacts` → all
`307 → /login`. This confirms `src/proxy.ts` route protection is active.

- Homepage at 375px mobile width renders with no console errors; no server-log
  runtime errors during the route sweep.
- Screenshot: `screenshots/home-mobile-375.png` (note: the homepage uses
  scroll-reveal animations, so a static full-page capture shows sections before
  they animate in — not a defect).

## Notes
- The marketing-demo parity changes (DashboardDemo, TeamsDashboard) type-check
  and build clean, are self-contained (no server/auth imports), and keep their
  original export names/usage. Visual fidelity was implemented against the real
  dashboard components.
