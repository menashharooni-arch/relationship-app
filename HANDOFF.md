# SwiftCard — Session Handoff

_Last updated: 2026-07-14_

## What this is
**SwiftCard** (swiftcard.me) — a Next.js digital business-card SaaS. Auto-deploys to **Vercel on push to `main`**.

- **Stack:** Next.js 16.x App Router (⚠️ **custom build — read `node_modules/next/dist/docs/` before writing code**, per `AGENTS.md`; APIs differ from stock Next), React 19, TypeScript (strict), Tailwind CSS 4, npm.
- **Backend:** Supabase (auth/db/storage — `getAdminSupabase` service-role client + `createClient` user client), Stripe, logo.dev.
- **Plans:** Free (1 card, 1 link, 5 leads/mo, 3 scans/mo, 3 AI drafts/mo), Pro (unlimited), Office (DB value `"enterprise"`, min 2 seats). Downgrade deletes nothing; kill-switches take extra cards/leads/design offline at render.

## Teams/Office model (built 2026-07-14)
- **`/office/admin` is the OFFICE admin console** (nav "Admin", right of Settings). `/office` 307s to it. The site-owner console at **`/admin` is untouched and ADMIN_EMAILS-only** — office users must never reach it; its nav item is labelled **"Site"** to keep the two apart.
- **The admin's original card is the PRIMARY card** (`offices.primary_card_id`). It IS the brand: its logo/company/website/template/colours/fonts are projected onto `offices.brand_*` and from there onto every member card. Editing it re-brands the whole team.
- **The primary card is exempt from the brand overlay** — otherwise the lock would pin the admin to their first-saved look and the brand could never change.
- **Admin owns the look, employee owns their content.** Locked: template, colours, fonts, company logo, office number, fax, website. Employee-owned: name, title, email, phone, headshot (`customization.photoUrl`), bio, personal/social links.
- Office contact (`brand_phone`/`brand_fax`/`brand_address`) stays admin-managed on the office (not derived from the card — an "office number" isn't a personal card field).
- **Take offline** = `cards.is_offline`. Enforced centrally in `lib/card-active.ts` (`cardIsOffline`) + `resolve-card.ts`, so page, links, QR, OG/share image, wallet pass and lead capture all go dark together. Nothing is deleted.

## Key architecture facts
- **A card's `username` is only the public URL slug** (`/card/<slug>`), auto-derived from name+company. **It is NOT identity** — the account/email is. `profiles.username` is email-derived + unique. Public `/card` route resolves against **both** `cards.username` and `profiles.username`.
- Ship loop: edit → `npx tsc --noEmit` → `npx vitest run` → `npm run build` (grep for **"type error"** too — webpack "Compiled successfully" can hide a later TS error) → commit → fetch/rebase/push → confirm Vercel deploy `READY`.
- Vercel keeps the last good deploy aliased, so a failed build never breaks production.

## Completed this session (all committed, pushed, live)
| Commit | Change |
|---|---|
| `38f3740` | **Username collision fix** — card creation auto-dedupes the slug (`-2`, `-3`, … then random); never errors "username already taken". New `src/lib/username.ts` (`normalizeSlug`, `ensureUniqueUsername`, checks both `cards` + `profiles`), wired into `/api/cards` + `/api/drafts/claim` with race-safe 23505 retry. Success screen shows the actually-saved slug. `tests/username.test.ts` (8 tests, 215 total pass). |
| `39eb195` | **Logo picker fix** — suggested/applied logo now reflects in the `ImageUpload` tile (added a sync `useEffect` on `currentUrl`). |
| `7636cb2` | **Retention** — Office→Pro "save" step on cancel; 50%-off offer now targeted only at price-sensitive cancel reasons (`Too expensive`, `Found a better alternative`). |
| `f4a7d79` | **Office CTA** — "Get Office" now builds the seat-1 card first, instead of dropping the user on a bare payment screen. |
| `3b9682b` | **Downgrade copy** — honest itemized loss framing (removed misleading "keeps your cards & contacts"); "Keep my plan" is the primary button. |
| — | `src/app/layout.tsx` title fixed to a plain string (an earlier `title.template` caused doubled brand + one failed deploy; now resolved). |

## Unfinished / open items
0. ⚠️ **`supabase/office-primary-card.sql` MUST be run in the SQL editor** — adds `offices.primary_card_id`, `offices.brand_design`, `cards.is_offline`. Additive + idempotent, and `offices` is empty so there's nothing to break. Until it's run: the primary-card link and the colour/font lock silently no-op (code degrades gracefully), and **"Take offline" on /office/admin will error** (it writes `cards.is_offline`).
1. ~~**Two Supabase migrations still need to be run in the SQL editor**~~ — **DONE (verified 2026-07-14).** All six columns exist in the production `offices` table (`brand_phone`, `brand_fax`, `brand_address`, `brand_locks`, `scheduled_seats`, `scheduled_seats_at`). Both `supabase/office-uniform-fields.sql` and `supabase/office-scheduled-seats.sql` have been applied.
2. ~~**Verify env vars in Vercel**~~ — **DONE (verified 2026-07-14).** All five price IDs (`STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID`) plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are present in Production.
3. **Flagged, not yet requested:**
   - logo.dev may return generic monograms for unindexed domains — a confidence/quality filter was offered.
   - Office→Pro switch releases team members immediately; a period-end variant was offered as a follow-up.

## Important decisions / conventions
- **Work autonomously** — act on reasonable assumptions; only ask if essential/destructive/prod. Do things yourself, don't hand over steps.
- **Auto-deploy after edits** — after finishing requested edits, auto commit + push + deploy to prod **unless told "do not push/deploy"**.
- Google OAuth "continue to supabase.co" consent screen is a **Supabase/Google-Cloud dashboard config** fix — **never app code**.
- Identity is email-based everywhere; slug collisions must never block creation.
- Commit trailers used:
  - `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/...`

## Deploy verification (Vercel MCP)
- `get_deployment` with idOrUrl `relationship-app-git-main-menashharooni-3888s-projects.vercel.app`
- teamId `team_dT8Xgx9E4475Q2TVbptBtmeW`, projectId `prj_EzWN9Tr6aw70RelIihfuwJS6pNGP`
- Failed builds → `ERROR` state; last good deploy stays aliased to swiftcard.me.

## Environment notes
- **Beware stray `* 2.*` duplicate files** (Finder/iCloud-style copies). Two of them in `.next/types/` made `npx tsc --noEmit` exit 1 with phantom "Duplicate identifier" / TS6200 errors while all real source was clean — deleting them fixed it. A tracked `.claude/settings.local 2.json` was also removed. If the typecheck gate fails on `.d 2.ts`-style paths, it's junk, not your code.
- Bash `sleep` is blocked directly — run in background then poll with an `until ! pgrep …` loop.
- `.env.local` holds `LOGO_DEV_TOKEN` (sk_…) and Supabase service-role key. `/api/logo-suggest` is auth-gated (401 for guests).
- Enabled Claude Code plugins: vercel, playwright, security-guidance, supabase, humanizer, frontend-design, typescript-lsp. Disabled: github, code-simplifier, context7. Default permission mode: `auto`.
