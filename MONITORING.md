# Production monitoring

Everything below is monitoring only. No application logic was changed — see
[What was NOT touched](#what-was-not-touched) at the bottom.

Nothing in here is active until you add the secrets in the checklists. With no
secrets, Sentry is disabled, the triage job exits green having done nothing, and
the watchdog stands down. That is deliberate: merging this is a no-op until you
deliberately arm it.

## What watches what

| Layer | What it catches | Who can act |
|---|---|---|
| Sentry (client / server / edge) | Runtime errors, unhandled rejections, API route failures, slow pages and slow DB calls | Reports only |
| Vercel Analytics + Speed Insights | Real-user traffic and Core Web Vitals | Reports only |
| Uptime monitor | Whole site or a key page being down | Alerts you |
| Daily triage job | Yesterday's new/recurring Sentry issues → one **draft PR** each | Opens drafts. **Cannot merge or deploy** |
| Deploy watchdog | A deploy that starts breaking the site for real users | **Rolls production back.** Nothing else |

---

## 1. Sentry

### Environment variables to add in Vercel

Vercel → your project → Settings → Environment Variables.

| Variable | Value | Environments | Why |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Your project DSN | Production, Preview | Turns Sentry on. Public by design — a DSN only allows *sending* events |
| `SENTRY_ORG` | Your Sentry org slug | Production, Preview | Build-time only, for source map upload |
| `SENTRY_PROJECT` | Your Sentry project slug | Production, Preview | Build-time only |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (below) | Production, Preview | Build-time only. **Secret** |

Optional:

| Variable | Default | Why you'd change it |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.1` in production, `1` elsewhere | Performance traces are billed per event. Raise it temporarily when chasing a slow endpoint |

Leave `SENTRY_*` off Development unless you want local errors in Sentry.

If you skip `SENTRY_AUTH_TOKEN`, everything still works — you just get minified
stack traces instead of readable ones. Source map upload is gated on that token
being present, so a missing token never fails the build.

### Steps in the Sentry dashboard

1. **Create the project.** New Project → platform **Next.js** → name it `swiftcard`.
   Copy the DSN it shows you into `NEXT_PUBLIC_SENTRY_DSN`.

2. **Create an auth token.** Settings → Developer Settings → Custom Integrations →
   *Create New Internal Integration*. Name it `swiftcard-ci`. Scopes:

   - `project:read` — the triage job and watchdog read issues
   - `project:releases` — source map upload on deploy
   - `event:read` — read event counts
   - `org:read` — resolve the org

   Copy the token once; it isn't shown again. Use the same token for both Vercel
   and GitHub, or make two if you'd rather scope them separately.

3. **Lock down PII — do this before you send real traffic.**
   Settings → Security & Privacy:

   - **Data Scrubber** — ON
   - **Use Default Scrubbers** — ON
   - **Prevent Storing of IP Addresses** — ON

   The code already strips contact data before anything is sent (see
   [The PII guarantee](#the-pii-guarantee)). These settings are a second,
   independent layer at Sentry's end — belt and braces on the same promise.

4. **Set up alerts.** Alerts → Create Alert:

   - *Issues* → "a new issue is created" → notify you. This is the one that
     matters; it fires the moment something novel breaks.
   - *Issues* → "an issue affects more than 10 users in 1 hour" → notify you.
     This is your outage alarm.

   Skip the noisier defaults until you know your normal volume.

5. **Confirm environments.** After the first deploy you should see `production`
   and `preview` as separate environments. Filter your alerts to `production`
   only, or preview deploys will page you while you're still working.

### Verify it's working

Do this on a **preview** deploy, not production.

1. Add a deliberate throw to any page — e.g. `throw new Error("sentry smoke test")`
   in a server component.
2. Push to a branch, open the preview URL, hit that page.
3. In Sentry you should see the event within a minute, in the `preview`
   environment, with a **readable** stack trace pointing at your source file (not
   minified `chunk-abc123.js`). If it's minified, `SENTRY_AUTH_TOKEN` isn't set.
4. Open the event and check every section — Additional Data, Breadcrumbs,
   Request, Tags. **There must be no email address, phone number, or person's
   name anywhere in it.** The `user` section should show an id and nothing else.
5. Remove the throw.

Step 4 is the one worth doing carefully. It's the only way to confirm the PII
promise end to end against a real event rather than trusting the unit tests.

---

## 2. Uptime and speed

### Speed Insights and Analytics

**Speed Insights is live.** It's enabled in the dashboard and the app loads
`/_vercel/speed-insights/script.js` from Vercel's own edge in production — no npm
package, no third-party request.

**Web Analytics is off, and its script tag has been removed.** The earlier claim
here — that an unenabled script "404s harmlessly" — was wrong in practice. A
disabled feature's script does not exist, so every production page load fetched
a 404 that Vercel answers with an HTML error page, and the browser then logged
`Refused to execute script … MIME type ('text/html') is not executable` on top.
One guaranteed failed request plus a console error, on every page, for every
visitor, for a feature nobody had turned on.

To turn it on, do both:

1. Vercel → your project → the **Analytics** tab → Enable.
2. Add the tag back in `src/app/layout.tsx`, next to the Speed Insights one:
   `<Script src="/_vercel/insights/script.js" strategy="afterInteractive" />`

Order matters — add the tag before enabling and you're back to 404s.

### Uptime pings

Vercel does not do uptime checks — it can't tell you the site is down, because if
it's down Vercel is often the reason. You need an outside-in check.

**Sentry Uptime Monitors** (simplest, you're already paying for Sentry):
Alerts → Uptime Monitors → Create. One monitor per URL below, 1–5 minute
interval, alert after 2 consecutive failures (one failure is usually a network
blip, not an outage).

| URL | What it proves | Expect |
|---|---|---|
| `https://swiftcard.me` | Marketing site is serving | 200 |
| `https://swiftcard.me/login` | Portal entry point is reachable | 200 |
| `https://swiftcard.me/card/<your-card-slug>` | **The product actually works** — this page hits the database | 200 |
| `https://swiftcard.me/pricing` | Static rendering is healthy | 200 |

The card URL is the important one. The homepage is static and will happily serve
from cache while the database is down; a real card page cannot. Use your own
card's slug so a monitor failure never emails a customer.

Also worth adding: `https://swiftcard.me/api/reminders` is your daily cron. If
Vercel's cron stops firing, automations silently stop sending and nobody notices.
Don't ping it (that would trigger sends) — instead check Vercel → Settings →
Cron Jobs occasionally, or set a Sentry alert on it going quiet.

Free alternatives if you'd rather not use Sentry quota: UptimeRobot (50 monitors
free, 5-minute interval) or Better Stack (10 monitors free, 30-second interval).
Either is fine. What matters is that the check comes from outside Vercel.

---

## 3. Daily triage job

`.github/workflows/sentry-triage.yml` runs at 06:15 UTC. It pulls unresolved
Sentry issues from the last 24 hours and opens **one draft PR per issue** with a
proposed fix and a plain-English writeup. If it can't confidently diagnose
something, it opens a plain issue instead of guessing at a patch.

### GitHub secrets to add

Repo → Settings → Secrets and variables → Actions → *Secrets*:

| Secret | Value |
|---|---|
| `SENTRY_ORG` | Your Sentry org slug |
| `SENTRY_PROJECT` | Your Sentry project slug |
| `SENTRY_AUTH_TOKEN` | The `swiftcard-ci` token from above |
| `ANTHROPIC_API_KEY` | An Anthropic API key |

### Two things to do in GitHub

1. **Create the labels** so the PRs and issues are filterable: `sentry-triage`,
   `needs-diagnosis`, `production`, `watchdog`. Issues → Labels → New.
   (The workflow retries without labels if they're missing, so this is cosmetic.)

2. **Turn on branch protection for `main`.** Settings → Branches → Add rule for
   `main` → *Require a pull request before merging*.

   This is the backstop that matters. The workflow is written so it cannot merge
   or push to main — draft PRs only, no `gh pr merge` anywhere in the file, and a
   guard that aborts if it ever finds itself on `main`. But those are properties
   of a file that could be edited. Branch protection is enforced by GitHub and
   doesn't depend on the workflow staying correct. **Please do this one.**

### Tuning

Repo → Settings → Secrets and variables → Actions → *Variables*:

| Variable | Default | Effect |
|---|---|---|
| `TRIAGE_MAX_ISSUES` | `5` | Max PRs per night. A bad deploy can produce dozens of distinct issues; this stops you waking up to 40 PRs |
| `TRIAGE_MIN_EVENTS` | `2` | Ignore one-off blips |

You can also run it on demand: Actions → *Sentry triage (drafts only)* → Run
workflow.

### What it will never do

No `deployments` permission, so it cannot deploy or promote anything. It won't
touch `.github/workflows/`, `next.config.ts`, `package.json`, or `supabase/`. It
won't weaken a test to make a fix pass — if an existing test contradicts its fix,
it's instructed to treat that as evidence the fix is wrong and write it up
instead. Every PR is a draft. **Read the diff before you mark one ready.**

---

## 4. Auto-rollback watchdog

`.github/workflows/deploy-watchdog.yml` — the only automation here allowed to
change production on its own.

**Important:** Vercel has no built-in "roll back when errors spike." Rolling
releases advance on a timer or on manual approval, and `vercel rollback` is a
manual command. There is no dashboard toggle for this, so it's built here:
after each production deploy the watchdog soaks for 5 minutes, asks Sentry how
many errors *this deploy introduced*, and if it's genuinely bad, calls Vercel's
rollback API to point production at the last known-good build.

### GitHub secrets to add

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Create at Vercel → Account Settings → Tokens. Scope it to this project |
| `VERCEL_PROJECT_ID` | `prj_EzWN9Tr6aw70RelIihfuwJS6pNGP` |
| `VERCEL_TEAM_ID` | `team_dT8Xgx9E4475Q2TVbptBtmeW` |

Plus the four Sentry secrets from section 3 — it reuses them.

### Run it in dry-run mode first

Set repo **variable** `ROLLBACK_DRY_RUN` = `1`.

For the first week it will watch every deploy and, when it *would* have rolled
back, open an issue saying so — without touching production. That lets you see
whether the thresholds match your real traffic before handing it the keys. When
you're happy, delete the variable to arm it.

### Thresholds

It rolls back only when **both** are crossed within the soak window, counting
only errors this deploy *introduced*:

| Variable | Default | Meaning |
|---|---|---|
| `ROLLBACK_MIN_EVENTS` | `25` | At least 25 error events |
| `ROLLBACK_MIN_USERS` | `5` | Affecting at least 5 distinct users |
| `ROLLBACK_SOAK_MINUTES` | `5` | How long to watch before judging |

Requiring both is the whole trick. Either alone misfires: one user stuck in a
retry loop can produce 300 events without anything being wrong, and three errors
across three users is ordinary internet noise. Together they describe an actual
outage. `tests/deploy-watchdog.test.ts` covers both of those false-positive
cases specifically.

Errors that already existed before this deploy are not counted — rolling back
can't fix a bug that shipped last week.

### What happens when it fires

1. Production is pointed back at the previous build. Users are on working code
   within about a minute.
2. An issue is opened describing what broke, how many users were hit, and which
   build it rolled back to.
3. **The bad commit stays on `main`.** Nothing is reverted in git, no branch is
   touched, no PR is opened. Fix forward and deploy normally.

To undo a rollback: Vercel → Deployments → find the newer build → Promote to
Production.

### Why this is safe to automate

A rollback re-points traffic at a build that was already live and healthy. It
deletes nothing and rewrites no history, it's reversible in one click, and its
worst case is "the site is running yesterday's code" — strictly better than "the
site is broken." That's why this one is allowed to act while the triage job isn't.

The workflow has `contents: read` only, so it literally cannot write code, and no
`deployments: write`, so it cannot create or promote a deploy. And if a newer
deploy lands while it's still soaking, the run is cancelled rather than acting on
a stale verdict.

---

## The PII guarantee

**Contact data never leaves our stack.** Sentry sees stack traces and shapes,
never people. Enforced in `src/lib/sentry-scrub.ts`, which every runtime routes
through via `beforeSend` and `beforeSendTransaction`:

- `sendDefaultPii: false` — no IPs, no cookies, no request headers by default
- Request bodies, cookies and query strings are **deleted**, not filtered
- Headers are allow-listed down to `user-agent`, `content-type`, `accept-language`
- The user object is reduced to an opaque account id and nothing else
- Every remaining string is walked and anything email- or phone-shaped is redacted

That last one is the important one. The leak is rarely a field called `email` —
Postgres puts the offending *value* in its error text (`duplicate key value
violates unique constraint ... (jordan@acme.com)`), fetch failures embed whole
URLs, and a breadcrumb can carry an entire request body. So rather than trusting
a list of safe fields, the scrubber redacts by shape across the whole payload.

If scrubbing ever throws, the event is **discarded** rather than sent unscrubbed.
Failing closed is the only safe direction when the alternative is leaking a
customer's contacts.

Session Replay and profiling are deliberately **off**. Replay records the DOM,
and on a contacts page the DOM *is* the customer's contact list.

`tests/sentry-scrub.test.ts` proves all of this, including that it does *not*
over-redact — line numbers, ports, timestamps and card slugs survive, because a
scrubber that eats your stack traces has traded a leak for a blind spot.

---

## What was NOT touched

No application logic changed. Specifically:

- No route handler, server action, or database query was modified
- No component behaviour, styling, or copy changed
- No plan gating, billing, automation, or integration code was touched
- No SQL, no migration, no Supabase change
- `next.config.ts` gained only the `withSentryConfig` wrapper — the existing
  headers, redirects and settings inside it are byte-for-byte unchanged
- `src/app/layout.tsx` gained two `<script>` tags, production-gated. Nothing
  else in it changed
- The existing `reportError()` / `ClientErrorReporter` → `/api/client-error`
  path still works exactly as before. Sentry sits alongside it, not instead of it

Verified by a clean production build, typecheck, lint, and the full test suite.
