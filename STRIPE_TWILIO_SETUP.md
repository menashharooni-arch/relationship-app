# Stripe & Twilio Setup — Manual Dashboard Steps

Everything in the codebase reads Stripe/Twilio credentials from environment
variables only (see `.env.example` and `ENV_KEYS_NEEDED.md`) — there is nothing
hardcoded to change. What's left is dashboard configuration on each platform's
side. This doc is that checklist.

---

## Stripe

**Status as of 2026-07-09: live mode is fully configured and deployed.**
Products/Prices, webhook endpoint, and Customer Portal are all set up in live
mode (see below for what was done). The one remaining step is a real test
transaction with an actual card — see "Test it" below — which nobody but the
account holder can do, since it requires a real payment method.

### 1. Create the Products & Prices (test mode first)

In the Stripe Dashboard (test mode toggle top-right), go to **Product catalog**
and create recurring (subscription) USD prices that exactly match `/pricing`
and `PLAN_PRICES` in `src/lib/plan.ts`:

| Product | Price | Billing |
|---|---|---|
| SwiftCard Pro | $4.99 | Monthly |
| SwiftCard Pro | $54.00 | Yearly |
| SwiftCard Office (per seat) | $3.99 | Monthly, per unit |
| SwiftCard Office (per seat) | $43.09 | Yearly, per unit |

For the Office prices, make sure "Usage is metered" is OFF and quantity is
adjustable at checkout (this is the default) — the app sets quantity to the
seat count.

Product/price **names** are cosmetic only (the app never reads them from
Stripe) — name them however is clearest for your own dashboard/invoices.

Copy each Price ID (`price_...`) into:
`NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`,
`NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID`.

> **Live mode — done.** These 4 are set in Vercel Production and confirmed
> active with the correct amounts ($4.99/mo, $54.00/yr, $3.99/mo-seat,
> $43.09/yr-seat). Several stale/mispriced duplicate prices that existed from
> earlier iterations ($12, $97, $8, $77, and a mismatched $5/seat) were archived
> — archiving, not deleting, so history is preserved but they can't be
> accidentally selected again. The legacy `STRIPE_PRICE_ID` fallback was also
> pointed at the correct Pro Monthly price.

> The checkout route fetches the live Stripe price at request time and refuses
> to check out if its amount doesn't match `PLAN_PRICES` — so a typo here
> surfaces as a checkout error instead of silently over/under-charging someone.

### 2. Get your API key

Developers → API keys → copy the **Secret key** into `STRIPE_SECRET_KEY`. Use
the test-mode key until you're ready to accept real payments.

### 3. Create the webhook endpoint

Developers → Webhooks → **Add endpoint**:

- URL: `https://<your-domain>/api/stripe/webhook`
- Events to send — select exactly these (the app only acts on these five):
  - `checkout.session.completed` — provisions the plan after a successful checkout
  - `invoice.payment_succeeded` — sends the renewal receipt email
  - `invoice.payment_failed` — sends the "update your payment method" email
  - `customer.subscription.updated` — keeps Office seat count in sync with the billing portal
  - `customer.subscription.deleted` — downgrades the account (and any Office members) to Free

Copy the endpoint's **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

> **Live mode — done.** Endpoint created at `https://swiftcard.me/api/stripe/webhook`
> with exactly these 5 events, status `enabled`. Secret is set in Vercel Production.

### 4. Enable the Customer Portal

Settings → Billing → **Customer portal** → Activate. Without this, the "Manage
billing" button (`/api/stripe/portal`) will fail — that route calls
`stripe.billingPortal.sessions.create`, which requires the portal to be
configured at least once. Recommended settings: allow canceling subscriptions,
allow updating payment methods, show invoice history.

> **Live mode — done.** Portal is active with cancel-subscription (at period
> end, with a reason survey), payment-method update, invoice history, and
> email/address/phone updates enabled. Plan/subscription switching through the
> portal is deliberately left **off** — the webhook only syncs Office seat-count
> changes today, not a customer changing plan tier directly through the portal.
> Enable that later once `customer.subscription.updated` handling covers plan
> changes too, not just seat count.

### 5. Test it

Use a [Stripe test card](https://stripe.com/docs/testing) (`4242 4242 4242 4242`,
any future expiry, any CVC) to run a full checkout → confirm the plan upgrades
and a receipt email arrives. Use the Stripe CLI (`stripe trigger invoice.payment_failed`)
or the Dashboard's "send test webhook" to exercise the failure path.

### 6. Real money — the last step, and it can't be automated

**Not yet done — this requires you personally, with a real card.** Everything
above (Products, Prices, webhook, portal, env vars, deployment) is live and
verified via the API. The only thing left is running one real subscription
checkout with an actual card to confirm the full path end-to-end: checkout →
webhook fires → plan upgrades in the app → receipt email arrives. Cancel
right after (Customer Portal or dashboard) if you don't want to keep it running.
This can't be done by an AI agent — it requires a real payment method and your
explicit authorization to move real money.

### 7. Going live (historical — already done for this account)

Test mode and live mode are **completely separate** in Stripe — separate
Products/Prices, separate API keys, separate webhook endpoints/secrets. This
account was activated and copied over from Sandbox on 2026-07-09. For
reference, or if you ever need to redo this on a new Stripe account:

1. Toggle to live mode and recreate the same Products/Prices with the same amounts.
2. Create a new live-mode webhook endpoint (same URL, same 5 events) and copy its secret.
3. Swap `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and all four
   `NEXT_PUBLIC_STRIPE_*_PRICE_ID` values in Vercel's production environment
   for their live-mode equivalents. Don't mix test and live values.
4. Re-run the test checkout once more in live mode with a real card (small
   amount, refund after) to confirm everything is wired end to end.
5. Confirm the live Customer Portal is activated too (test/live portal
   settings are configured separately).

---

## Twilio

### 1. Get a sender

Either:
- **Messaging Service (recommended)** — Console → Messaging → Services →
  Create Messaging Service → add one or more phone numbers as senders. This is
  what lets you scale from a long code to a short code later without changing
  any app code. Copy the Service SID (`MG...`) into `TWILIO_MESSAGING_SERVICE_SID`.
- **Single phone number** — Console → Phone Numbers → buy a number, copy it
  (E.164 format, e.g. `+15550001234`) into `TWILIO_PHONE_NUMBER`. Only needed
  if you're not using a Messaging Service.

### 2. Point inbound SMS at the app

The app receives replies (including STOP/START) at `POST /api/twilio/inbound`.
Configure the webhook:
- **Messaging Service**: the service's Integration tab → "Send a webhook" →
  `https://<your-domain>/api/twilio/inbound`, method `HTTP POST`.
- **Single number**: the number's configuration page → "A message comes in" →
  Webhook → same URL, method `HTTP POST`.

### 3. Get your credentials

Console → Account → Account Info → copy **Account SID** into
`TWILIO_ACCOUNT_SID` and **Auth Token** into `TWILIO_AUTH_TOKEN`. The inbound
webhook route validates every request's Twilio signature against this token —
don't skip this in production.

### 4. Opt-out handling — avoid double-replying

The app already replies to STOP/START itself (`src/app/api/twilio/inbound/route.ts`)
and maintains its own suppression list. If you also enable Twilio's **Advanced
Opt-Out** on the Messaging Service, Twilio will intercept STOP/START and reply
automatically *without* forwarding the message to your webhook — meaning our
own opt-out list would never get updated. Pick one:
- Leave Twilio's Advanced Opt-Out **off** and let the app's own STOP/START
  handling be authoritative (current design), or
- Turn it on and separately sync Twilio's suppression list into
  `message_opt_outs` (not currently built).

### 5. A2P 10DLC registration (US SMS, required)

If you're sending to US numbers from a long code, Twilio (and US carriers)
require **A2P 10DLC brand + campaign registration**, or messages will be
filtered/throttled/blocked. Console → Messaging → Regulatory Compliance →
A2P 10DLC. This is a compliance step on Twilio's side, independent of any code
here — budget a few business days for carrier vetting before relying on SMS
in production.

### 6. Local development

Twilio needs a public URL to reach your inbound webhook — use a tunnel (e.g.
`ngrok http 3000`) and set that as the webhook URL rather than setting
`TWILIO_SKIP_VALIDATION=true`, so signature validation is exercised the same
way it will run in production. Only use `TWILIO_SKIP_VALIDATION` as a last
resort for quick local testing, and never in a deployed environment.
