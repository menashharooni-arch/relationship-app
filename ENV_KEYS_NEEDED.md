# Environment Variables — Swisscard

Add these to `.env.local` for local dev AND to Vercel (Settings → Environment Variables) for production.
Do NOT commit `.env.local` to git.

---

## Already Set (do not touch)

| Variable | What it does |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role — bypasses RLS (keep secret) |

---

## Needed Now (emails + AI)

| Variable | Where to get it |
|---|---|
| `RESEND_API_KEY` | resend.com → Login → API Keys → Create API Key |
| `RESEND_FROM_EMAIL` | The "from" address for all emails. Format: `Swisscard <hello@yourdomain.com>`. Must be a verified sender/domain in Resend. For testing you can use `onboarding@resend.dev` (Resend sandbox — only sends to your own email). |
| `ADMIN_EMAILS` | Comma-separated emails allowed into the **Admin Panel** at `/admin` (plan toggling, analytics, promo codes, broadcast). e.g. `you@gmail.com,partner@company.com`. Your email MUST be here to see `/admin`. |
| `ADMIN_SECRET` | Long random string. Only protects the automated `/api/admin/promo-codes/send` endpoint. The Admin Panel itself is gated by `ADMIN_EMAILS`, not this. |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key. Primary AI provider for follow-up generation (cheaper than Anthropic). Optional fallbacks: `OPENAI_API_KEY` (used first if set), `ANTHROPIC_API_KEY`. |
| `NEXT_PUBLIC_APP_URL` | Your production URL: `https://swiftcard.me`. Used for card links, email links, AND OAuth redirect URIs — must match the domain registered in your OAuth apps. |

---

## Needed for CRM Integrations (Google Contacts, HubSpot)

> Zapier needs no env var — each user pastes their own webhook URL in Settings → Integrations, which also carries conversation-notification and view events to any CRM.

| Variable | Where to get it |
|---|---|
| `OAUTH_SECRET` | **Required** for Google/HubSpot connect. A 32-byte key as 64 hex chars. Generate with `openssl rand -hex 32`. Encrypts the stored OAuth tokens. |
| `GOOGLE_CLIENT_ID` | console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID (Web application). Also enable the **People API**. |
| `GOOGLE_CLIENT_SECRET` | Same Google OAuth client. |
| `HUBSPOT_CLIENT_ID` | developers.hubspot.com → your app → Auth tab. |
| `HUBSPOT_CLIENT_SECRET` | Same HubSpot app → Auth tab. |

Register these **redirect URIs** in each OAuth app (must match `NEXT_PUBLIC_APP_URL` exactly):
- Google → `https://swiftcard.me/api/integrations/google/callback` · scope `https://www.googleapis.com/auth/contacts`
- HubSpot → `https://swiftcard.me/api/integrations/hubspot/callback` · scope `crm.objects.contacts.write`

---

## Needed Later (payments)

See **`STRIPE_TWILIO_SETUP.md`** for the full dashboard walkthrough (products, prices, webhook events, test vs. live mode).

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API Keys → Secret key. Use a **test-mode** key (`sk_test_...`) until you're ready to accept real payments; switch to `sk_live_...` only when going live. |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → Webhooks → your endpoint → Signing secret (`whsec_...`). Test mode and live mode each have their own endpoint and their own secret — don't mix them. |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Stripe → Product catalog → your Pro monthly price → copy Price ID (`price_...`). Must be $4.99/mo to match `/pricing`. |
| `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` | Stripe → Product catalog → your Pro annual price → copy Price ID. Must be $54.00/yr to match `/pricing`. |
| `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID` | Stripe → Product catalog → your Office (per-seat) monthly price → copy Price ID. Must be $3.99/mo per seat. |
| `NEXT_PUBLIC_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID` | Stripe → Product catalog → your Office (per-seat) annual price → copy Price ID. Must be $43.09/yr per seat. |
| `STRIPE_PRICE_ID` | Optional legacy fallback for `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`. Leave unset if the monthly price ID above is set. |
| `STRIPE_RETENTION_COUPON_ID` | Optional. A Stripe Coupon ID applied on the account-cancellation "retain" offer. |

Test/live mode are **completely separate catalogs** in Stripe — a test Price ID will not work with a live secret key. When you're ready to go live, recreate the Products/Prices in live mode (same amounts) and swap every Stripe value above for its live-mode equivalent. `src/app/api/stripe/checkout/route.ts` fetches the real Stripe price at checkout time and rejects the request if its amount doesn't match `PLAN_PRICES` in `src/lib/plan.ts` — keep that file in sync if you ever change a displayed price.

---

## Needed Later (SMS)

See **`STRIPE_TWILIO_SETUP.md`** for the full dashboard walkthrough (buying a number, Messaging Service, inbound webhook).

| Variable | Where to get it |
|---|---|
| `TWILIO_ACCOUNT_SID` | console.twilio.com → Account Info → Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | console.twilio.com → Account Info → Auth Token |
| `TWILIO_MESSAGING_SERVICE_SID` | console.twilio.com → Messaging → Services → your service SID (`MG...`). Preferred over a bare phone number — set this OR `TWILIO_PHONE_NUMBER` below. |
| `TWILIO_PHONE_NUMBER` | console.twilio.com → Phone Numbers → your number (e.g. `+15550001234`). Only needed if you're not using a Messaging Service. |
| `TWILIO_SKIP_VALIDATION` | Leave unset/`false` everywhere except local dev without a public tunnel. Bypasses the inbound-webhook signature check — never set to `true` in production. |

---

## What breaks without each key

| Missing key | What stops working |
|---|---|
| `RESEND_API_KEY` | All emails — welcome, receipts, marketing, promo codes |
| `RESEND_FROM_EMAIL` | Emails may be rejected or go to sandbox only |
| `ADMIN_SECRET` | Admin broadcast + promo code routes return 403 |
| `GEMINI_API_KEY` (or OPENAI/ANTHROPIC) | AI follow-up generation falls back to generic templates |
| `NEXT_PUBLIC_APP_URL` | Card links, email links, and OAuth redirects will point at the wrong domain |
| `OAUTH_SECRET` | Google & HubSpot "Connect" fail (can't encrypt tokens) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Contacts integration |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot integration |
| `STRIPE_SECRET_KEY` | Checkout and subscription management |
| `STRIPE_WEBHOOK_SECRET` | Plan upgrades, receipts, failed-payment emails, and cancellations won't process |
| `NEXT_PUBLIC_STRIPE_*_PRICE_ID` | Checkout rejects the request with "Unknown plan price" |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS sending returns "not configured" (fails safely, no 500) |
| `TWILIO_MESSAGING_SERVICE_SID` / `TWILIO_PHONE_NUMBER` | Same — at least one of these two is also required for SMS to send |
