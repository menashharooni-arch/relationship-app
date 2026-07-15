# Stripe / billing / webhooks / seats findings

Method: read-audit only — **there are no Stripe API keys in the local env**, so
no live test-mode flow was executed. Code-level fixes are committed; everything
needing live verification is in the BLOCKED section. Status: **FIXED** ·
**DOC** · **BLOCKED** (needs test-mode keys).

## Fixed (correctness / fail-closed only — none can cause an incorrect charge)
| # | Sev | Finding | Fix (commit) |
|---|-----|---------|--------------|
| 1 | CRITICAL | Webhook marked an event processed (INSERT into `stripe_events`) BEFORE running the handler. A handler that threw returned 500 for a retry that was then skipped as a duplicate → **event dropped forever** (customer never provisioned, or a cancellation never applied). | `clearStripeEvent()` releases the dedup marker in the webhook's catch so Stripe's retry re-processes. `lib/stripe-idempotency.ts`, commit `0328edc`. |
| 4 | HIGH | `change-plan` defaulted Office seats to the plan MINIMUM (2) when `seats` was omitted → an Office→Office call slammed quantity to 2 and the webhook trim loop deleted active members. | Defaults to the current Stripe quantity; rejects reductions below seats-in-use (409); adds a transition idempotency key (#12). `0328edc`. |
| 6B | HIGH | `customer.subscription.deleted` set `plan='free'` for the matched profile even when that user was still an active member of a paid office (their own personal sub ended). | Restores `enterprise` + re-links `office_id` when the user is an active member of an enterprise-owner office. `0328edc`. |
| 6A | MED | An office sub-user who joined while holding their OWN personal subscription was permanently 403-blocked from cancel/keep/portal — billed forever with no way out. | `officeSubUserBlockMessage({allowIfOwnSubscription})` lets them manage their own sub. `0328edc`. |
| 5 | MED | Resending a revoked/declined/expired invite skipped the seat gate → invites overbooked past purchased seats. | Seat gate now runs unless the existing row is genuinely `pending`. `0328edc`. |
| 10 | LOW | Unmapped checkout price silently defaulted to `pro`; seats fell back to an arbitrary `?? 5`. | Alerts via `reportError`; seats fall back to `OFFICE_MIN_SEATS`. `0328edc`. |
| 11 | LOW | A null `current_period_end` stored `scheduled_seats_at=null`, which the cron never matches → reduction never applied, customer keeps paying. | Rejects the schedule (503) when Stripe returns no period end. `0328edc`. |
| 13 | LOW | Invite email send failure was swallowed; UI still said "invite sent". | Route returns `emailSent` for a copy-link fallback. `0328edc`. |

## Documented — NOT fixed (would change charge amounts or need live Stripe)
- **#2 HIGH — no ordering/stale-event protection on `customer.subscription.updated`.** Out-of-order delivery lets an older snapshot overwrite newer seat state and the trim loop delete the newest member. **Fix:** re-retrieve the subscription from Stripe in the handler and/or track last-processed `event.created`. Not applied blind — money-adjacent, needs a live out-of-order replay.
- **#3 HIGH — scheduled seat reductions applied by a daily cron with `proration_behavior:"none"`.** If the cron runs after the renewal invoice, the customer is billed a full cycle for seats they gave up, no credit. **Fix:** use a Stripe Subscription Schedule / pending update, or `create_prorations` when applied post-renewal. Needs a test-clock run.
- **#7 MED — receipt emails** link to the merchant-only Stripe dashboard, use a fabricated invoice number, and hardcode `interval:"Monthly"` (annual buyers get "Monthly" receipts). **Fix:** `invoice.hosted_invoice_url` + `invoice.number` + interval from the price. Needs live email verification.
- **#8 MED — dedup fails open / table optional.** **VERIFY** `stripe_events` exists in prod (`supabase/stripe-events-dedup.sql`), else redeliveries reprocess.
- **#9 MED-LOW — `BillingManager` shows prices from hardcoded `PLAN_PRICES`,** so grandfathered/discounted customers see wrong amounts; `renewalCents` ignores active discounts. Display-only; the seats GET already returns real `perSeatCents`.

## BLOCKED — needs Stripe test-mode keys (please run before merge)
1. End-to-end checkout for all four prices: verify plan mapping, office creation, seat count, receipt wording.
2. Webhook retry-after-500 (confirms fix #1 live).
3. Out-of-order `subscription.updated` replay (confirms #2 still open).
4. Scheduled seat reduction across a real renewal with a test clock (confirms #3).
5. `change-plan` Office→Office with `seats` omitted (confirms fix #4 — quantity must stay current).
6. Grace-period: failed renewal (card `4000 0000 0000 0341`) → cron cancel → downgrade; recovery clears it.
7. **Stripe Dashboard portal config:** verify the default portal does NOT allow quantity/plan changes to unlisted prices (a portal seat change bypasses every in-app guard). Config, not code.
8. Confirm `stripe_events` exists in prod, and that `profiles` RLS forbids self-updating `plan`/`stripe_*` via PostgREST.

## Verified SAFE
Webhook signature fails closed; client cannot choose price/amount at checkout
(env allow-list + live price match); office min seats enforced server-side;
duplicate-subscription 409; seat increases charge-then-write with a transition
idempotency key; join-time seat cap + post-activation recount prevents overflow;
cancel/keep are `cancel_at_period_end` with the webhook doing the real downgrade;
preview pins `prorationDate` so quote==charge; trials/promos server-derived;
Terms/auto-renew wording present at checkout.
