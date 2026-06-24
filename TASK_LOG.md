# Task Log — Swisscard

Most recent session at top.

---

## Session: 2026-06-23 / 2026-06-24

### What Was Built

#### 1. Email / Notifications System
**Status: Code complete. Blocked on env vars (RESEND_API_KEY not yet set).**

Files created:
- `supabase/email-system.sql` — 4 new tables. **Already run successfully in Supabase.**
- `src/lib/email-templates.ts` — shared HTML email templates: welcome, promo, receipt, marketing
- `src/app/api/welcome/route.ts` — updated: uses new templates, creates email_preferences row, logs send
- `src/app/api/admin/broadcast/route.ts` — send marketing email to free/pro/all users
- `src/app/api/admin/promo-codes/route.ts` — create + list promo codes (admin only)
- `src/app/api/admin/promo-codes/send/route.ts` — email a promo code to a user segment
- `src/app/api/promo/redeem/route.ts` — user redeems a promo code (checks expiry, eligibility, duplicate)
- `src/app/api/settings/email-preferences/route.ts` — user updates their own email opt-ins
- `src/app/api/unsubscribe/route.ts` — one-click unsubscribe (GET redirects, POST for mailto clients)
- `src/app/unsubscribe/page.tsx` + `UnsubscribeContent.tsx` — unsubscribe landing page
- `src/components/EmailPreferencesForm.tsx` — toggle UI for marketing + receipt emails

Files updated:
- `src/app/api/stripe/webhook/route.ts` — sends automated receipt on `checkout.session.completed` AND `invoice.payment_succeeded` (monthly renewals)
- `src/app/settings/flows/page.tsx` — added Email Preferences section using EmailPreferencesForm

#### 2. Save Contact — "Try 1 Month Free" promo
**Status: Working.**

Files updated:
- `src/components/LeadCaptureForm.tsx` — done state now shows blue promo card with "Try 1 month free" → `/login?mode=signup`

#### 3. Multi-card Editor
**Status: Working.**

Files created:
- `src/app/api/cards/[id]/route.ts` — PATCH (update fields) + GET (fetch card), ownership verified by `user_id`
- `src/app/cards/[id]/edit/page.tsx` — server page, loads card, guards ownership
- `src/app/cards/[id]/edit/CardEditForm.tsx` — client form with:
  - Live preview (updates as you type)
  - Card info tab (all fields)
  - Design tab (all 5 templates as clickable previews)
  - Saves to `cards` table — each card is independent

Files updated:
- `src/app/dashboard/page.tsx` — extra cards in "My Cards" now show **Edit** + **View →** buttons

#### 4. Card Creation (RLS fix — previous session)
**Status: Working.**
- `src/app/api/cards/route.ts` — switched to `getAdminSupabase()` so free users can create cards without RLS error

#### 5. Contacts/Leads (previous session)
**Status: Working.**
- `src/app/api/leads/[id]/route.ts` — PATCH + DELETE with admin client + ownership check
- `src/app/api/leads/manual/route.ts` — manual contact creation
- `src/components/LeadCard.tsx` — collapsible, flow toggle, preset picker, AI messages, SMS, notes, delete
- `src/components/AddContactModal.tsx` — manual contact form modal

#### 6. AI Messages
**Status: Code complete. Blocked on ANTHROPIC_API_KEY.**
- `src/app/api/ai/suggest-messages/route.ts` — generates 3 tailored messages using Haiku

#### 7. SMS
**Status: Code complete. Blocked on Twilio keys.**
- `src/app/api/sms/send/route.ts` — sends SMS via Twilio

---

## Older Sessions (reference only)

- Fixed hero phone mockup on landing page (hand-crafted inline card, no template component)
- Fixed LiveDemo CardScreen to portrait layout that fits phone frame
- Built LeadPipeline kanban with dark theme + follow-up badges
- Built FlowSettingsForm with preset configuration
- Built dashboard 2-column layout with sticky right panel
- Built onboarding 3-step flow
- Built 5 card templates with QR codes
- Built contacts page with search, alphabetical sort, activity timeline
- Built notification bell with unread badge
- Built analytics chart (30-day views)
- Built QR download, card PNG download, share button
- Built Zapier webhook, Google Contacts sync, HubSpot sync
