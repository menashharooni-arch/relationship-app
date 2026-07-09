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
| `GEMINI_API_KEY` (or OPENAI/ANTHROPIC) | AI follow-up generation falls back to generic templates |
| `NEXT_PUBLIC_APP_URL` | Card links, email links, and OAuth redirects will point at the wrong domain |
| `OAUTH_SECRET` | Google & HubSpot "Connect" fail (can't encrypt tokens) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Contacts integration |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot integration |
| `STRIPE_SECRET_KEY` | Checkout and subscription management |
| `STRIPE_WEBHOOK_SECRET` | Automated receipts on payment won't fire |
| `TWILIO_*` | SMS sending returns 500 |
