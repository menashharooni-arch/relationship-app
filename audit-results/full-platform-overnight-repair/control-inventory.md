# SwiftCard Control Inventory (key interactive surfaces)

Generated 2026-07-15 by reading component source (read-only audit). "States" = loading / disabled-while-busy / success / error feedback, as visible in the component code.

Legend: L = loading indicator, D = disabled while busy, S = success feedback, E = visible error message. ⚠ = missing state worth verifying/fixing.

## 1. Dashboard (`src/app/dashboard/page.tsx`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Card switcher / card list "Edit" links | Navigate between cards / editor | `/dashboard?card=…`, `/cards/[id]/edit` | n/a (links) |
| "Create your card" / "+ New card" | Opens wizard | `/cards/new?add=1` | n/a (link) |
| Card preview + Download (`CardPreviewDownload` → `DownloadCardButton`) | html2canvas PNG of card | client-side; images via `/api/img-proxy` | L ("Saving…"), D, E ("Couldn't save — retry") |
| Share button (`ShareButton`) | navigator.share, else copy link | clipboard | S ("copied"); no E but silent clipboard fallback — acceptable |
| Copy link (`CopyButton`) | Copies card URL | clipboard | S (check state, 22-line component); no E ⚠ minor (clipboard failure silent) |
| More share options (`MoreShareOptions`) | mailto/SMS/QR links | static links | n/a |
| Notification bell + panel (`NotificationBell`, `NotificationsPanel`) | List, mark read, clear, claim referral reward | GET/PATCH/DELETE `/api/notifications`, POST `/api/referrals/claim` | Claim: per-item result incl. error text. Mark-read/clear: fire-and-forget `.catch(() => {})` ⚠ no error surface (low stakes) |
| Upgrade button (`UpgradeButton`) | Starts checkout / links to upgrade | `/upgrade` / `/api/stripe/checkout` | L, D |
| CSV export link | Leads CSV (Pro) | GET `/api/leads/export`; Free users get `/pricing` link instead | n/a (download link) |
| Trial banner, tour banner, first-lead nudge | informational | — | n/a |

## 2. Card editor (`src/app/cards/[id]/edit/CardEditForm.tsx`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Tabs (`content`/design/links/socials…) | Section switcher (`useState tab`) | local | n/a |
| Save changes | Persists card | PATCH `/api/cards/[id]` (or PATCH `/api/profile` for the legacy profile card via `/profile/card`) | L ("Saving…"), S ("Saved!"), E ("Error — try again" + message); validation E ("Full name is required.") |
| Photo/logo upload (`ImageUpload`) | Upload/resize/clear image | POST/DELETE `/api/upload` | L, D, E |
| Logo suggest (`LogoSuggest`) | Company-logo candidates | POST `/api/logo-suggest` | L, E; ⚠ no D on trigger (loading flag only guards result area) |
| Custom designer (`CustomCardDesigner`) | Layout/color editor | local state only (saved by parent Save) | n/a — no fetch of its own |
| Office-managed fields | Company/website/fax/address locked for sub-users | server-provided `org` props → inputs `disabled` | n/a (static lock) |

## 3. New-card wizard (`src/app/cards/new/NewCardWizard.tsx`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Step navigation (1→N) | Multi-step form; progress restored from localStorage | local | validation E per step ("Full name is required.", URL-name check) |
| Publish / Save card | Creates card (guests hit the gate modal → login → `/api/drafts/claim`) | POST `/api/cards`; guest claim via POST `/api/drafts/claim` (`GuestDraftClaim`: L, S, E) | L (`status === "loading"` disables submit), E (server + network: "Couldn't reach the server…") |
| Add link row | Adds custom link | local | D until label+URL valid (`readyToAdd`) |
| Org-managed website field | locked when office brand supplies it | `disabled={!!(org && orgWebsite)}` | n/a |
| Plan step (`showPlan`) | Post-create plan chooser | `/api/stripe/checkout` via UpgradeButton | L, D |

## 4. Settings (`/settings/flows`, `SettingsShell` + section components)

Section rail (one panel at a time, deep-linkable via `?billing=1`/`#section`).

| Control | What it does | Route/API | States |
|---|---|---|---|
| Flow settings form (`FlowSettingsForm`) | Automation toggles/messages | PATCH `/api/settings/flows` | L, D, S, E |
| Email preferences (`EmailPreferencesForm`) | Marketing email toggle | PATCH `/api/settings/email-preferences` | L, S, E |
| Zapier (`ZapierSettings`) | Webhook URL save + test ping | PATCH/POST `/api/settings/zapier` | L, D, S, E |
| Integrations (`IntegrationsSettings`) | Connect/disconnect Google/HubSpot/LinkedIn | `<a href>` → `/api/integrations/*/connect`; DELETE `/api/integrations/*` | Disconnect: D; result flash read from redirect query param (E shown). Connect is a plain link — no L possible (full-page nav), fine |
| CRM events (`CrmEventSettings`) | CRM dispatch toggles | PATCH `/api/settings/crm` | L, D, E |
| Manage cards (`ManageCards`) | Delete a card (confirm dialog) | DELETE `/api/cards/[id]` | confirm(), D (`deletingId`), E |
| Billing (`BillingManager`) — see §8 | | | |
| Manage account (`ManageAccount`) | Delete account flow (reason, retention offer, downgrade alternative) | POST `/api/account/delete` (+ `/api/account/retain`, `/api/account/downgrade` offers) | L, D, E |
| Push (`EnablePushButton`) | Web-push opt-in | POST `/api/push/subscribe` | permission-driven states |
| Refer a friend (`ReferAFriend`) | Copy referral link, claim rewards | `/api/referrals/claim` | S (copied), E |

## 5. Office admin (team / leads / branding)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Create office form (`CreateOfficeForm`) | First-run office creation | POST `/api/office` | L, D, E |
| Add member (`TeamActions.AddMemberButton`) | Invite modal; auto "buy a seat & invite" branch when out of seats | POST `/api/office/invite`; GET/POST `/api/stripe/subscription/seats` | L, D, S (invite URL + copy), E; seat purchase L/E |
| Invite row actions (`InviteRowActions`) | Resend / cancel invite / copy link | POST `/api/office/invite` (resend), DELETE `/api/office/members` | confirm step, S (copied), E |
| Remove member (`RemoveMemberButton`) | Remove + optional drop-seat | DELETE `/api/office/members`, POST seats | D (`busy`), confirm, E |
| Role select (TeamList/member page) | Change member role | POST `/api/office/role` | (in TeamList: optimistic w/ success mark) |
| Leads table (`LeadsTable`) | Filter by person/status/search; per-lead status dropdown | PATCH `/api/office/leads/[id]` | optimistic update with `pending` flag + `failed` rollback (E as row state); ⚠ no global error toast, and no pagination (whole list rendered — fine at current scale) |
| Branding editor (`OfficeBranding`) | Colors/logo/company fields | PATCH `/api/office/brand`, upload via `/api/upload` | L, D, S, E |
| Card actions (`OfficeCardActions`) | Edit managed fields; take card offline/online (confirm) | PATCH `/api/office/cards/[id]` | D (`busy`), E; confirm() for offline |
| Attention list (`AttentionList`) | One-click fixes (e.g. re-invite) | `/api/office`, `/api/office/invite` | L, D, E |
| Add seat (`AddSeatButton`) | Buy an extra seat | POST `/api/stripe/subscription/seats` | L, D, E |

## 6. Site-owner admin marketing (`src/app/admin/marketing/MarketingClient.tsx`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Broadcast compose + "Send test" / "Send to segment" | Marketing email blast | POST `/api/admin/broadcast` (GET for counts) | D (`sending` + required fields), confirm modal for real send, S/E (`result`) |
| Sent-emails log | View past sends | GET `/api/admin/broadcast/logs`, `/logs/[id]` (SentEmailsModal) | modal |
| Domain check | Verify Resend DNS | GET/POST `/api/admin/email-domain` | D (`domainChecking`), copy-DNS rows with S (copied) |
| Create promo code | New promo | POST `/api/admin/promo-codes` | D (`promoBusy`), E (`promoError`) |
| **Delete promo code** | Removes a code | DELETE `/api/admin/promo-codes?id=` | ⚠ **no confirm, no disabled-while-busy, no error handling** — inline `onClick={async () => { await fetch(…DELETE); loadPromos(); }}` (MarketingClient.tsx:407) |
| Send promo email | Email a code to a segment | POST `/api/admin/promo-codes/send` | modal, D (`promoSending` + required fields), S/E (`promoSendResult`) |

## 7. Public card (`src/app/card/[username]/page.tsx`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Save contact (`SaveContactButton`) | Downloads vCard (headshot embedded), then share-back sheet | client vCard; events → `/api/card-events`, `/api/analytics/event`; share-back → POST `/api/leads` | Download: D-guard (`downloading`), S (saved). Share-back form: L, D, S ("done"); ⚠ **on failed lead POST it silently resets to idle — no visible error message** (SaveContactButton.tsx:201-206) |
| Lead capture form (`LeadCaptureForm`) | Visitor shares info with owner | POST `/api/leads` | L, D, S, E, plus "limit" state for free-plan lead cap |
| Add to Wallet (`AddToWalletButton`) | Download .pkpass | GET `/api/wallet/pass?card=` | plain link — ⚠ no loading/error UI (a 501/404 response yields raw JSON in browser) |
| Action links / socials (`CardActionLinks`, `SocialLinkIntercept`) | tel/mailto/social taps, tracked | POST `/api/card-events` (fire-and-forget) | n/a |
| View/event trackers (`CardEventTracker`, `TrackEvent`) | Analytics | POST `/api/views/[username]`, `/api/analytics/event` | invisible |

## 8. Billing (`src/components/BillingManager.tsx`, `/checkout`, `/upgrade`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Billing summary load | Current sub, seats, schedule | GET `/api/stripe/subscription` | L, E |
| Keep Subscription | Undo scheduled cancel | POST `/api/stripe/subscription/keep` | L ("Reactivating…"), D, E |
| Change Plan modal | Monthly↔annual, pro↔office w/ proration preview | POST `/api/stripe/subscription/preview`, `/change-plan` | L, D, E, S (notice) |
| Cancel modal | Reason prompt → 50% retention discount → cancel | POST `/api/stripe/subscription/discount`, `/cancel` | L, D, E, S |
| Seat manager (Office) | Increase/schedule-decrease seats | GET/POST `/api/stripe/subscription/seats` | L, D, E |
| Manage payment (`ManageBillingButton`) | Stripe portal | POST `/api/stripe/portal` | L, D |
| Checkout (`CheckoutClient`) | Order summary → Stripe; promo code entry | POST `/api/stripe/checkout` (+ change-plan/preview when already subscribed) | L, D, E |
| Upgrade page (`UpgradeClient`) | Plan/interval/seat picker | links to `/checkout?…` | n/a (pure links) |

## 9. Contacts / leads (`src/components/ContactsClient.tsx`, `LeadCard`, `AddContactModal`)

| Control | What it does | Route/API | States |
|---|---|---|---|
| Search / filter / sort / card filter | client-side filtering | local | n/a |
| Lead detail drawer: notes, where-met, status, contact fields | Inline edits | PATCH `/api/leads/[id]` | L (per-field saving flags), D, S, E |
| AI sequence generator | Draft follow-ups | POST `/api/leads/[id]/generate-sequence` | L (`draftLoading`), D, E |
| Message / SMS send (`LeadCard`) | Follow-up email/SMS | GET/POST `/api/leads/[id]/message`, POST `/api/sms/send`, `/api/ai/suggest-messages` | L, D, S, E |
| Pause/reset channels | Per-contact email/SMS pause | PATCH `/api/leads/[id]` | D, S |
| Delete lead | Removes contact | DELETE `/api/leads/[id]` | confirm + E |
| Add contact (`AddContactModal`) | Manual lead | POST `/api/leads/manual` | L, D, E |
| vCard download | Save lead to phone | GET `/api/leads/vcard?id=` | link |
| Share my card (`ShareMyCardButton`/`share-card`) | Send card to lead | POST `/api/leads/share-card` | L/E in LeadCard flow |

## Flags summary (controls missing a state)

1. **`MarketingClient.tsx:407` — Delete promo code**: no confirm, no busy/disabled state, no error handling on the DELETE.
2. **`SaveContactButton.tsx:201-206` — public-card share-back submit**: failed POST `/api/leads` silently resets the button to idle; visitor gets no error message (comment acknowledges the data-loss concern but UI shows nothing).
3. **`AddToWalletButton.tsx`** (16 lines): bare link to `/api/wallet/pass` — error responses (wallet not configured, inactive card) render as raw JSON; no loading/error UI.
4. **`NotificationsPanel.tsx`** mark-read/clear actions swallow failures (`.catch(() => {})`) — low stakes but state can silently desync.
5. **`LeadsTable.tsx` (office leads)**: status change failure only flips a per-row `failed` flag (rollback happens); no message telling the admin *why*; list is unpaginated.
6. **`CopyButton.tsx`**: clipboard failure is silent (no error branch).
7. **`LogoSuggest.tsx`**: trigger not disabled while the lookup is in flight (loading flag exists but only gates results rendering).
