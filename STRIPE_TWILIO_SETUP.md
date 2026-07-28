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

### 0. What is live today (as of July 27, 2026)

This repo is **public** — the SIDs below are recorded in `CREDENTIALS-RUNBOOK.md`
(gitignored), not here.

| Thing | Value |
| --- | --- |
| Account | Twilio CLI profile `swiftcard`; Account SID in the runbook |
| Sending number | **+1 (917) 905-7335** — friendly name "SwiftCard NYC", SMS/MMS/Voice (public: it's printed on `/sms-terms`) |
| Messaging Service | "SwiftCard" (`MG…`, see runbook); the number is its only sender |
| Inbound webhook | `https://swiftcard.me/api/twilio/inbound` (POST), set on **both** the Messaging Service and the number itself |
| `useInboundWebhookOnNumber` | `false` — the Service webhook wins; the number's own webhook is the fallback if it ever leaves the Service |
| Vercel env (Production) | `TWILIO_ACCOUNT_SID`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_PHONE_NUMBER` set. `TWILIO_AUTH_TOKEN` set as of the first live send test |
| Status callback | `https://swiftcard.me/api/twilio/status` (POST), passed per-message on create — records the CARRIER's verdict on each text |
| A2P 10DLC | **Not registered** — no brand, no campaign. See step 5. **This is the current delivery blocker.** |

> ### ⚠️ "It said Sent but the text never arrived"
>
> This is the expected symptom of the unregistered A2P 10DLC campaign above, and
> it is **not** an app bug. Creating a message via the Twilio API is only an
> ACCEPTANCE: the call returns `201` with status `queued`, so `sendSms()`
> correctly reports `sent` and the message is logged. Delivery is decided later
> by the US carrier, which **silently drops** traffic from an unregistered 10DLC
> number (error **30034**).
>
> The app now hears about this: every send passes a `statusCallback`, and
> `/api/twilio/status` writes the real outcome back onto the logged message, so
> the conversation thread shows "Not delivered" instead of "Sent" and an ops
> alert fires. That makes the failure visible — it does **not** make it deliver.
> Only completing step 5 does.

`sendSms()` requires Account SID **and** Auth Token **and** a sender, so with the
Auth Token missing it returns `not_configured` and the app behaves exactly as it
did before the number existed — no sends, no errors. Adding
`TWILIO_AUTH_TOKEN` is the single switch that turns SMS on.

The number is named in the customer-facing compliance copy at `/sms-terms` and
`/sms-consent`; if the sending number ever changes, update those two pages.

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

### 5. A2P 10DLC registration (US SMS, required) — **the current blocker**

US carriers require **brand + campaign registration** before they will deliver
traffic from a 10-digit long code. Until this is done every text is accepted by
Twilio and then silently dropped by the carrier (error 30034). Console →
Messaging → Regulatory Compliance → A2P 10DLC.

**This cannot be automated.** It is a legal attestation tied to a real business
identity (EIN, registered address, an authorized representative) submitted to
The Campaign Registry, and it bills a one-time brand fee plus a monthly campaign
fee. It has to be submitted by the account holder. Everything below is the
answer sheet so the console session is short — the app-side facts are filled in;
only the business identity fields are blank, because nobody but you can supply
them and a wrong value means rejection and a re-vetting fee.

#### 5a. You supply these (Customer Profile + Brand)

| Field | Value |
|---|---|
> **This repo is public.** The brand identity values — EIN, registered address,
> representative's phone — are in `CREDENTIALS-RUNBOOK.md` (gitignored) under
> "A2P brand identity", not here. Copy them from there into the console.

| Field | Value |
|---|---|
| Legal business name | `SWIFT CARD INC` (public: it's on `/company`) |
| Business Tax ID (EIN) | see runbook |
| Business type | Private Corporation |
| Business industry | Technology / Professional Services |
| Registered address | see runbook — must match IRS records, not a mailbox |
| Business website | `https://swiftcard.me` |
| Authorized representative | Menash Harooni, Founder & Authorized Representative; phone in runbook |
| Brand contact email | `hello@swiftcard.me` — receives a 2FA code |

Answer **Yes** when asked whether the business has a registration number (Tax
ID). There is an EIN, so this is not a Sole Proprietor brand — that path caps
the account at one number and lower throughput.

> `HELP_REPLY` in `src/app/api/twilio/inbound/route.ts` already tells recipients
> the business is **"Swift Card Inc"**. If the EIN letter says anything else,
> that string is wrong and must be corrected — a mismatch between the registered
> brand and the name in the HELP message is a compliance defect on its own.

Brand type: choose **Low-Volume Standard** (under ~6,000 segments/day, lower
monthly fee). It is the same vetting as Standard with cheaper throughput, and
current volume is nowhere near the ceiling.

> ### ⚠️ Don't submit before ~2026-08-07 — each attempt is billed
>
> The 2026-07-23 attempt was rejected for "EIN/legal-name mismatch" even though
> the values above match the CP 575A character for character. The cause is
> timing, not data: the EIN was issued **2026-07-17**, and TCR checks it against
> third-party verification databases that lag IRS issuance by 2–4 weeks.
> Resubmitting sooner bills the brand fee again and fails the same way.
>
> Run the free step in parallel: open a Twilio support ticket now attaching the
> CP 575A ("Swift Card Inc - EIN.pdf" in Google Drive). Support can sometimes
> accept the IRS letter directly instead of waiting on the third-party data. If
> that hasn't resolved it, submit brand + campaign in one clean pass Aug 7–10.
>
> There is no urgency: as of 2026-07-28 only 1 of 25 phone-bearing leads is
> tagged `sms-ok` and it has no follow-up sequence, so nothing is queued.

#### 5b. Campaign — use these values verbatim

Campaign vetting is where registrations fail, almost always because the opt-in
description doesn't match the real product or the samples don't match real
traffic. These are taken from the actual code, so they will.

**Use case:** Mixed / Customer Care.

**Campaign description:**
> SwiftCard is a digital business card service operated by Swift Card Inc. When
> someone taps or scans a SwiftCard user's card, they may choose to submit their
> own name, phone number and email through the "Share My Info" form on that
> user's card page, having been told next to the submit button that doing so
> means receiving follow-up texts. Those recipients get a follow-up text from
> the card owner containing a link to that owner's contact card, and optionally
> the owner's scheduled follow-up messages. All traffic sends from one number,
> +1 (917) 905-7335, owned and operated by Swift Card Inc, which is the sole
> sender of record and handles STOP/HELP centrally for the whole platform;
> SwiftCard users do not bring or control their own numbers.

> ⚠️ Do not describe the opt-in as a "separate consent checkbox" anywhere in
> this filing. There is no checkbox — submission is the consent (see 5b's opt-in
> description). Attesting to a checkbox a reviewer can't find on the live page
> is a rejection, and the wording above is deliberately consistent with it.

**Sample message 1** (`src/app/api/leads/share-card/route.ts`):
> Hi Alex! Jordan Reed here - save my contact information in the link below.
> https://swiftcard.me/card/jordanreed?shared=1
> via SwiftCard · Reply STOP to opt out

**Sample message 2** (HELP auto-reply, `api/twilio/inbound`):
> SwiftCard (Swift Card Inc): follow-up messages sent on behalf of SwiftCard
> users. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt
> out. Support: hello@swiftcard.me or swiftcard.me/contact

**Sample message 3** (a paid-plan follow-up — `buildSmsBody({ paid: true })`
drops the "via SwiftCard" line, so include this one and don't tell the reviewer
attribution is universal):
> Hi Daniel - thanks for stopping by the booth. Sending my details as promised,
> pricing sheet is on my card page.
>
> — Rachel Lim, Northbridge Design
> https://swiftcard.me/card/rachel-lim

**Opt-in description** — this is the field that gets registrations rejected, so
it must describe what the form *actually* does. SwiftCard uses
**consent-by-submission with an adjacent disclosure**, not a separate checkbox
(see the warning below before you submit):
> Web form, following an in-person interaction. A visitor taps or scans a
> SwiftCard user's physical card, which opens that user's card page. The visitor
> then chooses to submit their own name, phone number and email through the
> "Share My Info" form. Directly adjacent to the submit button, visible before
> submission, the form states: "By sharing, you agree to texts & emails via
> SwiftCard. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt
> out, HELP for help," followed by links
> to the SMS Terms and the Privacy Policy. Submitting the form is the
> affirmative opt-in. Consent is then recorded server-side as an `sms-ok` flag
> that the browser cannot set on its own; automated messages are sent only to
> contacts carrying that flag, and capture paths that never displayed the
> disclosure (business-card scanner, manual entry) are never auto-texted.

> #### Disclosure size — resolved 2026-07-28
>
> The disclosure used to render at **8px**, which is not "clear and conspicuous"
> under TCPA/CTIA and reads to a campaign reviewer as burying it. The owner
> approved the change and it is now **11px** (`SmsConsentCheckbox.tsx`), with
> the two missing CTIA elements — message frequency and HELP — added, since
> submission is the only consent signal. 11px is the floor — never go below it.
> The copy is also trimmed to the shortest form that keeps all six required
> elements; shortening it further fails review.
>
> Also note the component is *named* `SmsConsentCheckbox` but renders no
> checkbox — it is a disclosure paragraph. The name is historical.

> #### ⚠️ Retake the screenshots before submitting
>
> `/sms-consent` embeds `share-form.png` and `consent-closeup.png`, which still
> show the **old 8px checkbox** flow. They are static images and cannot be
> regenerated automatically. A reviewer comparing them against the live card
> page will see a mismatch. Retake both from a real card page before filing.

**Opt-in evidence URLs:** `https://swiftcard.me/sms-consent` and
`https://swiftcard.me/sms-terms` (both name the sending number).

**Campaign attributes:** subscriber opt-in **YES**, opt-out **YES**, HELP
**YES**, embedded link **YES** (`swiftcard.me` only — the app never uses a
public URL shortener, which carriers reject), embedded phone number NO,
age-gated NO, direct lending NO, affiliate marketing NO.

> **Know this before you submit.** SwiftCard sends on behalf of its users, which
> is adjacent to ISV/reseller territory. Registering as a Direct brand is
> defensible here — one number, owned by Swift Card, users who never bring or
> control a number of their own, and SwiftCard's own STOP/HELP handling on every
> message — but it is the detail a reviewer is most likely to question. The
> description and samples above state it openly rather than hiding it, which is
> the safer posture.
>
> Don't claim "every message carries 'via SwiftCard' attribution": paid plans
> suppress that line by design (`buildSmsBody({ paid: true })` — Pro is sold as
> "100% your brand"), which is why sample 3 shows a message without it.
> STOP/HELP handling, not the attribution line, is what's actually universal.

#### 5c. Attach the campaign

Attach the approved campaign to the existing **"SwiftCard"** Messaging Service
(`MG…`, in the runbook). +1 (917) 905-7335 is already its only sender, so no
number changes are needed. Nothing in the app changes — `sendSms()` already
sends through that Service.

#### 5d. Verify it actually worked

Brand review is usually minutes but can take 7+ business days if it goes to
manual vetting; **campaign review is currently running 10–15 days**. When the
campaign shows `APPROVED`, send one real text from Share → Share by Text and
watch the contact's conversation thread: the status callback added in `85e92c3`
will flip it to **Delivered**. If it still reads "Not delivered", the campaign
is approved but the number isn't attached to it — check the Messaging Service's
sender pool. Don't trust the green "Sent" check for this; that only means Twilio
accepted the message, which was true the whole time it was failing.

### 6. Local development

Twilio needs a public URL to reach your inbound webhook — use a tunnel (e.g.
`ngrok http 3000`) and set that as the webhook URL rather than setting
`TWILIO_SKIP_VALIDATION=true`, so signature validation is exercised the same
way it will run in production. Only use `TWILIO_SKIP_VALIDATION` as a last
resort for quick local testing, and never in a deployed environment.
