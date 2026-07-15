# Performance / dependency / lint findings

## Dependency vulnerabilities (`npm audit --omit=dev`)
**4 moderate, 0 high, 0 critical.** All fixes require breaking downgrades, so
per the audit policy (no major framework change unless fixing Critical/High)
they are **left in place and documented**:

| Package | Severity | Path | Why not fixed |
|---------|----------|------|---------------|
| `postcss` <8.5.10 (XSS in stringify) | moderate | transitive under `next` 16.2.9 | `npm audit fix --force` wants to install **next@9.3.3** — a catastrophic downgrade. Wait for a Next patch bump. |
| `joi` <17.13.4 (RangeError on nested input) | moderate | under `passkit-generator` (Apple Wallet) | fix downgrades `passkit-generator` to 3.1.2 (breaking); joi is only reachable via wallet-pass generation with trusted server input. Low real exposure. |

Action for you: bump `next` when 16.2.x ships the postcss fix; re-run `npm audit`.

## Lint (`npx eslint .`)
**6 errors + 3 warnings, all `react-hooks/set-state-in-effect`, all
pre-existing** in files not touched this session:
`src/components/SettingsShell.tsx`, `WelcomePlan.tsx`, `ImageUpload.tsx`,
`DashboardLink.tsx`, `BillingManager.tsx`, `src/app/checkout/CheckoutClient.tsx`,
`src/app/preview/PreviewClient.tsx`, `src/app/api/leads/route.ts`,
`src/app/terms/page.tsx`.

- These are non-blocking (the production build succeeds).
- Several are deliberate one-time localStorage/hash reads on mount (some already
  carry `eslint-disable` comments). Rewriting them to `useSyncExternalStore` or
  lazy initial state is a real change per call site and risks subtle regressions;
  not appropriate to sweep blindly overnight. Left for a focused pass.
- **All files created/changed this session are lint-clean** (ProfilePhotoSuggest,
  SentEmailsModal, ManageAccount, CardEditForm, settings page, office-brand,
  office-roles, admin broadcast).

## Query/perf notes (from reading, not profiled)
- Dashboard already batches its below-the-fold reads into one `Promise.all`
  (good). Tonight's Traffic change widened one existing query from 30→60 days of
  view timestamps for the same card(s) — same query, slightly more rows; bounded
  by a single card's view volume, no new round trip.
