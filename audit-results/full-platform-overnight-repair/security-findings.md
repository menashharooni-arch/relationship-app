# Security / authorization / privacy findings

Method: read-audit of ~90 API routes, the proxy, the service-role client, RLS
migrations, storage, and OAuth/token handling. Status legend: **FIXED** (this
session, committed) · **DOC** (documented, left for review) · **VERIFY** (needs
a dashboard/prod check only you can do).

## Fixed
| # | Sev | Finding | Fix (commit) |
|---|-----|---------|--------------|
| 1 | HIGH | `/api/leads/[id]` PATCH trusted the client's full `tags` array → a user could plant a lead in another org's Leads tab (`sc-office-*`) or strip `sc-locked` to bypass the Free paywall (also pause/unpause automation). | Reserved server-owned tags are preserved from the row; only non-reserved client tags honored. `lib/lead-tags.ts` + `tests/lead-tags.test.ts`. Commit `0a13ac0`. |
| 2 | MED | Public rate limiters keyed off the spoofable leftmost `X-Forwarded-For` → a fresh bucket per request (unbounded img-proxy/link-preview relay, contact-inbox/Resend flooding, analytics/notification spam). | `lib/client-ip.ts` trusts `x-real-ip` / last XFF hop; 8 ingest/contact/proxy routes updated. `0a13ac0`. |
| 3 | MED | `/api/upload` built the storage object key from an unvalidated `field` + attacker filename extension → path traversal + cross-user overwrite (`upsert:true`). | `field` allow-listed to `photo\|logo`; extension derived from the validated MIME. `0a13ac0`. |
| 4 | MED | `/api/twilio/inbound` verified the signature only when `TWILIO_AUTH_TOKEN` was set — **failed open** if unset, letting forged SMS manipulate opt-outs / inject into threads. | Fails closed in production (503 without a token; skip flag honored only outside prod). `0a13ac0`. |
| 5 | MED | `/api/account/retain` applied the retention coupon on every call, with no once-per-customer guard → perpetual free discount. | Once per customer via the server-owned `_retentionUsed` flag, mirroring `/discount`. `0a13ac0`. |

## Documented (lower risk / needs a judgment call)
- **LOW** `office/leads/[id]` status write is gated by the *read* capability `view_org_analytics`, so a `manager` can change lead statuses. Same-org only. Consider a dedicated write capability.
- **LOW** `push/subscribe` upserts on `endpoint` with no owner check — could reassign `user_id` if the (secret) endpoint is known. DELETE is correctly scoped.
- **LOW** `lib/messaging.ts` `UNSUB_SECRET` has a hardcoded fallback string; mitigated because `token-crypto` throws without `OAUTH_SECRET` in prod. Remove the fallback anyway.
- **LOW** `account/downgrade` and `promo/redeem` lack the `officeSubUserBlockMessage` guard the other billing routes have. Not currently exploitable (downgrade hard-gates on `plan==='pro'`; redeem only writes a row cashed at the sub-user-guarded checkout). Add for consistency.
- **LOW** `join/route.ts` skips the invite email-match check when `user.email` is empty (null-email accounts).
- **INFO** `OAUTH_SECRET` doubles as HMAC state key and AES token key; `token-crypto` uses AES-256-CBC without a MAC. Not exploitable as written; separate keys + authenticated encryption would be cleaner.

## VERIFY (you, in the Supabase dashboard — cannot be confirmed from source)
- **The base tables `profiles`, `cards`, `leads`, `notifications`, `card_views` are created outside this repo, so their RLS posture is not in git.** The app authorizes in application code via the service-role client, and several routes (`profile`, `notifications`, `settings/*`) use the *user-session* client trusting RLS. **Confirm `profiles` (esp. `plan`, `stripe_*` columns), `cards`, and `leads` have RLS ENABLED with no client-writable policy** — otherwise the browser's anon/authenticated key can read/write them directly via PostgREST, bypassing every app-layer check. This is the single most important thing to verify.
- Confirm the `card-uploads` storage bucket restricts writes to `name LIKE auth.uid() || '/%'` (belt-and-braces with fix #3).
- Confirm `UPSTASH_REDIS_REST_URL/TOKEN` are set in prod, or rate limits only throttle per warm instance.

## Verified SAFE (coverage highlights)
Service-role client never imported in a `"use client"` file; every `/api/admin/*`
route calls `requireAdmin()` before touching data; Stripe checkout re-verifies
price/amount against Stripe and an env allow-list; webhook signature fails closed;
office cross-org isolation (officeOwnsCard, office-scoped member/role/lead writes,
no client-supplied office_id); OAuth callbacks verify a signed state; `safe-fetch`
SSRF protection is robust (scheme allow-list, private/loopback/rebinding blocked);
CSV export escapes formula injection; profile/notifications/settings scoped by
user.id with `_`-prefixed keys stripped from client input.
