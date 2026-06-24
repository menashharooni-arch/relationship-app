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
| `ADMIN_SECRET` | Make up any long random string (e.g. `swisscard-admin-abc123xyz`). Used to protect `/api/admin/broadcast` and promo code routes. |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys → Create Key. Used for AI follow-up message generation. |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL, e.g. `https://relationship-app-alpha.vercel.app`. Used for card links and unsubscribe URLs in emails. |

---

## Needed Later (payments)

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API Keys → Secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → Webhooks → your endpoint → Signing secret (`whsec_...`) |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Stripe → Products → your Pro monthly price → copy Price ID (`price_...`) |
| `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` | Stripe → Products → your Pro annual price → copy Price ID |
| `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID` | Stripe → Products → your Enterprise price → copy Price ID |

---

## Needed Later (SMS)

| Variable | Where to get it |
|---|---|
| `TWILIO_ACCOUNT_SID` | console.twilio.com → Account Info → Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | console.twilio.com → Account Info → Auth Token |
| `TWILIO_PHONE_NUMBER` | console.twilio.com → Phone Numbers → your number (e.g. `+15550001234`) |

---

## What breaks without each key

| Missing key | What stops working |
|---|---|
| `RESEND_API_KEY` | All emails — welcome, receipts, marketing, promo codes |
| `RESEND_FROM_EMAIL` | Emails may be rejected or go to sandbox only |
| `ADMIN_SECRET` | Admin broadcast + promo code routes return 403 |
| `ANTHROPIC_API_KEY` | AI follow-up message generation returns 500 |
| `NEXT_PUBLIC_APP_URL` | Card links and unsubscribe URLs in emails will be wrong |
| `STRIPE_SECRET_KEY` | Checkout and subscription management |
| `STRIPE_WEBHOOK_SECRET` | Automated receipts on payment won't fire |
| `TWILIO_*` | SMS sending returns 500 |
