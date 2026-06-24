# Next Steps — Swisscard

Tasks in priority order. Do one at a time.

---

## 1. Add environment variables (you do this — not code)

Add these to `.env.local` AND to Vercel (dashboard → Settings → Environment Variables):

```
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Swisscard <hello@yourdomain.com>
ADMIN_SECRET=any-long-random-string-you-pick
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

**How to test after adding:**
- Create a new account → check inbox for welcome email
- Go to a card page → fill out "Share your info" → submit → owner should get a notification email

---

## 2. Add `invoice.payment_succeeded` to Stripe webhook (you do this)

In Stripe dashboard → Developers → Webhooks → your endpoint → Add events → add:
- `invoice.payment_succeeded`

This makes renewal receipts fire every month automatically.

---

## 3. Test the multi-card editor

Steps to test:
1. Go to Dashboard → My Cards → click **+ Add card**
2. Fill in username (e.g. `john-work`) and name → Create
3. You should see the new card in "My Cards" with an **Edit** button
4. Click **Edit** → change name/title → switch to Design tab → pick a template → Save
5. Visit `/card/john-work` — should show the new card with the chosen template
6. Confirm the primary card at `/card/[original-username]` is NOT affected

---

## 4. Test the "Try 1 Month Free" promo on the card page

Steps to test:
1. Open your card link in an incognito window (e.g. `/card/yourusername`)
2. Fill out the "Share your info" form at the bottom
3. Press **Share My Info**
4. You should see: green checkmark "Info sent!" + blue "Try 1 month free" promo card

---

## 5. Make phone required, email optional on lead capture form

Right now the public card form asks for name + email (required) + phone (optional).
The plan is to flip this: **phone required, email optional**.

File to change: `src/components/LeadCaptureForm.tsx`
- Change `type="email"` input from `required` to optional
- Change `type="tel"` input to `required`

---

## 6. Bigger QR code on card templates

The QR on each card template is currently 76px. Plan: make it bigger and easier to scan, pinned bottom-right.

Files to check: `src/components/card-templates/*.tsx` and `src/components/card-templates/types.tsx` (MiniQR component).

---

## 7. Promo code input on pricing page

The API for redeeming promo codes exists at `POST /api/promo/redeem` but there's no UI for users to enter a code.

File to update: `src/app/pricing/page.tsx`
- Add a "Have a promo code?" input field
- On submit, call `/api/promo/redeem` and show the discount

---

## 8. Wire up Stripe payments (when ready)

Once you have Stripe keys:
- Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` to env
- Add `invoice.payment_succeeded` to Stripe webhook (step 2 above)
- Test a checkout → confirm receipt email arrives

---

## 9. Wire up Twilio SMS (when ready)

Once you have Twilio keys:
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to env
- Test: open a contact in the dashboard → expand → AI Messages → Send SMS

---

## 10. Admin broadcast emails (when Resend is set up)

To send a marketing email to all free users:

```bash
curl -X POST https://your-app.vercel.app/api/admin/broadcast \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "segment": "free",
    "subject": "Your subject here",
    "headline": "Big headline",
    "message": "Body copy here.",
    "ctaLabel": "Upgrade now",
    "ctaUrl": "https://your-app.vercel.app/pricing"
  }'
```
