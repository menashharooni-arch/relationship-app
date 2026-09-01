# SwiftCard Agent Flow — marketing & monitoring agents

Ten agents, run from GitHub Actions, controlled from **Admin → Website → Agent
Flow** (swiftcard.me/admin/agent-flow, hello@swiftcard.me only).
Nothing runs on its own; you press the buttons.

## Autonomous vs draft-only

| Agent | Acts on | Mode |
|---|---|---|
| 1 Outreach Scout | Reddit/LinkedIn/FB/IG/X | **Draft-only** — finds + writes; you send |
| 2 Link-in-bio Prospects | Instagram (public data) | **Draft-only** — CSV you work by hand |
| 3 SEO | swiftcard.me | Autonomous checks + report (site work already ships in the app) |
| 4 Blog Writer | swiftcard.me/blog | Writes autonomously; **publishes only via your Publish button** (draft mode default; flip `blog.publish_mode` to "auto" in config.json later) |
| 5 Social Content | — | **Draft-only** — scripts/captions for Higgsfield + Buffer/Later |
| 6 Mentions Monitor | Reddit/Quora/forums | **Draft-only** — replies with disclosure; you post |
| 7 Influencer Scout | IG/TikTok/YT/X | **Draft-only** — DM drafts, commission-only pitch |
| 8 Bug Watch | this repo | Autonomous **draft PRs** (the existing `sentry-triage.yml`); never merges. Auto-rollback = existing `deploy-watchdog.yml`, the one fully-autonomous action |
| 9 Security Watch | repo + live site | Autonomous scans → findings queue; CRITICAL emails immediately; never patches |
| 10 Manager | agent tables (+ read-only product counts) | Compiles + emails the digest |

Draft-only is **structural**: the LLM gets only WebSearch/WebFetch (no Bash, no
git, no platform APIs), and the runner's sole write is our own `agent_*`
tables. Pinned by `tests/agent-flow.test.ts`.

## Setup — one command

```
node scripts/agent-flow-setup.mjs
```

That's it. The script applies the schema (Supabase Management API), verifies
the tables, sets the GitHub Actions secrets (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, a freshly minted `AGENT_RELAY_SECRET`), adds the
Vercel env vars the tab needs (`GITHUB_AGENTS_TOKEN` from your gh CLI,
`AGENT_RELAY_SECRET`), and triggers a redeploy. Idempotent — safe to re-run.

Emails need no key in Actions: agents relay through `/api/agent-email`, which
holds the app's own Resend key server-side and can only ever mail the digest
address (Bug Watch still uses the `SENTRY_*` secrets — MONITORING.md).

**One optional secret remains yours:** the LLM key for the research/blog
agents — `gh secret set CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`,
runs on your Max plan) **or** `gh secret set ANTHROPIC_API_KEY` (API billing).
SEO, Security and Manager run with no LLM at all, so the system works today
without it.

**External accounts, only when you want that agent:** Sentry (Agent 8 — steps in MONITORING.md) · Higgsfield (paste video prompts) · Buffer or Later (connect IG/TikTok/YT/LinkedIn/X once; paste approved captions — we deliberately did NOT wire their APIs: drafts stay drafts) · Snyk optional (npm audit + Dependabot cover v1) · Google Search Console (already verified, sitemap submitted).

## Claude Max vs API credits

GitHub Actions can use **either**:
- `CLAUDE_CODE_OAUTH_TOKEN` — run `claude setup-token` locally, paste the token.
  Runs on your **Max subscription** (no separate bill, but shares your plan's
  limits — the caps below exist to protect your own dev headroom).
- `ANTHROPIC_API_KEY` — separate pay-per-use API billing (the repo's existing
  sentry-triage already uses this name).
Set one (or both — API key wins for triage, either works for agents).

## Using the tab

- **Start All** dispatches every enabled agent (manager excluded — run it last).
- **Pause All** sets a DB flag every agent re-reads between steps. Takes effect
  at the **next checkpoint**: instantly between items, worst case one in-flight
  LLM call (~1–3 min). Finished items stay; nothing is half-written; the run is
  marked `paused` with a summary of what it completed.
- **Queue**: filter by agent/type; bulk approve/reject; Approve & Copy puts the
  draft on your clipboard; prospects export as CSV; blog posts publish live.
- **Settings**: enable/disable, per-run item + $ caps, monthly system cap
  (agents refuse to start past it and email you), optional cron schedule (UTC,
  OFF by default — setting one arms the half-hourly scheduler for that agent).
- **History**: every approve/edit/reject + outcomes (Mark sent → Got a reply →
  Converted) so you can see which agents earn their keep.

## Usage estimate (defaults)

Research agents ~$0.30–1.50/run · blog ~$1–3 · seo/security/manager ~$0 (no
LLM) · **full Start-All session ≈ $3–8**, hard-capped per-run and at
$25/month system-wide.

## 20-minute review routine

1. Digest email (2 min): criticals first, failed agents, pending count.
2. Tab → Queue → security findings → Acknowledge/act (3 min).
3. Blog post: skim, Publish or Edit (4 min).
4. Bulk-select outreach/reply drafts; Approve & Copy the good ones into the
   platforms as you go; Reject the rest (8 min).
5. Prospects: Download CSV for the VA; Mark contacted as worked (2 min).
6. Video scripts: Copy to Higgsfield the one you'll shoot (1 min).

## Boundaries honored

No product code or user data is touched by any agent: their write surface is
the `agent_*` tables (plus draft PRs on branches for Bug Watch). The blog and
this admin tab are the only app additions, both additive. Sentry
instrumentation already existed (`src/instrumentation*.ts`, PII-scrubbed,
release-tracked) — nothing product-side was modified for this system.
