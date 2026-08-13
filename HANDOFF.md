# SwiftCard — Session Handoff

_Last updated: 2026-08-12 (design-transfer session)_

## Just finished — design transfer ("Copy a card or template you like")
The custom-designer button now REBUILDS an uploaded card design with the
owner's own details. Two engines in `/api/design-transfer`:
1. **Image editing** (Gemini `gemini-2.5-flash-image`) — pixel-faithful, but
   **blocked: the Gemini key is FREE tier (quota 0 for image gen)** and Menash
   declined upgrading. Tried first (cheap 429) so it self-upgrades if billing
   ever appears.
2. **Measure-and-typeset (LIVE, free)** — vision measures geometry/colors
   (`PRECISE_SCAN_PROMPT`), we typeset with Satori (`renderFaceImage` in
   `src/lib/design-transfer.tsx`). Text can never be misspelled. Validator
   synthesizes a missing `name` slot (never rejects for it).

Approved image → `customLayout.faceImage` (guarded sink: https + our hosts,
see `normalizeCustomLayout`) → `FaceCard` in `CustomCard.tsx` renders it with
the live QR overlaid bottom-right. Preview modal in `CustomCardDesigner.tsx`
(side-by-side + checklist + "Make it editable blocks instead" fallback).

**E2E verified in prod 2026-08-12**: `node scripts/design-transfer-e2e.mjs`
(signs in as applereview@ demo Pro, real call, fetches the stored PNG). PASS.
Menash has NOT yet judged reconstruction quality on his own templates — next
session: have him retry, iterate on PRECISE_SCAN_PROMPT fidelity if needed
(fonts are Satori-default sans; serif/gradients/photos not reproduced).

## Open items, in priority order
1. **Twilio A2P (US outbound SMS blocked)** — campaign FAILED on 30896
   (MESSAGE_FLOW/opt-in). Fix is designed: add https://swiftcard.me/sms-consent
   + live example card URL to the opt-in field via Console "Fix Campaign"
   (Console-only fields; API can't). **Blocked on Menash entering the SMS MFA
   code** (phone …0348). Ticket #28933836 has the history. See memory:
   twilio-swiftcard-state.
2. **Notifications audit findings (task #4)** — workflow confirmed 3 real
   defects (full detail: `.claude` workflow journal wf_fa1d8ca8-c2f).
   **Two are FIXED and deployed (2026-08-12, commit 71f48c9)**; one is left
   because it's a feature build needing Menash's product call:
   - STILL OPEN — `viewed_card` notifications DON'T EXIST:
     `api/card-events/route.ts` only notifies on `downloaded_vcard`. A contact
     viewing a card never hits the bell/panel/push. Menash explicitly wants
     this ("bulletproof view notifications") → build the viewed_card branch +
     per-(contact,day) dedupe. Deliberately NOT built blind: the dedupe window
     and whether a view should push are his calls, not defaults.
   - FIXED — limit(20) cliff. All five capped reads (the API's scoped query
     and its no-migration fallback; the dashboard's panel, bell, and fallback)
     now order `read` ascending before `created_at` descending, so unread rows
     can never be pushed out of the window by recent read history. Pinned by
     `tests/notification-reach.test.ts`. Not done: true unread count +
     pagination — the badge still caps at the 20 fetched rows, which only
     shows once someone has 20+ unread (it renders "9+" past 9 anyway).
   - FIXED — `contact_saved` now calls `sendPushToUser` alongside the row,
     gated on `insertNotification`'s return so a dedupe-race loser doesn't
     buzz for a row it never wrote. Same test pins it.
   - 19 more findings were mapped but NOT verified (session limit): journal
     has them (dedupe windows, IP rate-limit swallowing, cross-device
     attribution, silent insertNotification failures…). Re-run verify via
     `Workflow resumeFromRunId: wf_fa1d8ca8-c2f` or verify by hand.
3. **Apple**: App Store 1.0.0 still WAITING_FOR_REVIEW (submitted 8/10 pm).
   TestFlight public link LIVE: testflight.apple.com/join/4dvTeNgJ. Build 6
   current. `scripts/approval-watch.mjs` polls Apple+Twilio.
4. **Google sign-in branding** — submitted 8/11, pending Google review
   (days). When verified, consent screen shows "SwiftCard" + logo. Custom
   auth domain (auth.swiftcard.me) = Supabase Pro $35/mo, declined for now.
5. **Parked decisions**: Apple NFC pass certification application (needed for
   the sideways full-bleed pass Menash mocked — awaiting his go); CRM
   smoke-test harness (needs him to create HubSpot/Pipedrive/HighLevel
   sandboxes); marketing DashboardDemo/PreviewClient still show the removed
   "Total leads" header (sync or leave).

## This session also shipped (all deployed + tested)
- Wallet pass final spec: card edge-to-edge in strip (blur-extended sides),
  big QR block bottom, no fields (`wallet.ts`, `wallet-strip.tsx`).
- "Made with SwiftCard" blurb on EVERY plan, pinned by
  tests/badge-universal.test.ts. On the CARD page it renders under "Saved to
  Contacts!" in the Save Contact section (moved there 2026-08-13 from the
  bottom of the page — it replaced the blue "Create your free card" button and
  routes to the same /cards/new?src=save_contact_cta). SwiftLinks keeps its own
  footer attribution.
- 14-day Pro trial: already existed end-to-end; homepage now advertises it
  (web only — never in the iOS shell, App Review 3.1.1).
- Contacts activity feed: two-line rows, uniform 13px/10px type.
- Settings "Advanced account settings" row un-dimmed (quiet flag removed).
- Quick Contacts header: count + "Total leads" removed.

## Gotchas rediscovered this session
- Vercel runtime logs expire in ~1h — capture immediately after a repro.
- Concurrent Claude sessions share this worktree: stage explicit paths only.
- The Twilio Console has fields the public Messaging API doesn't
  (privacy/T&C URLs, opt-in) — never resubmit A2P via API for those.
