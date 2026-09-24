# Warm Lead Re-Engagement Alerts + Intent Score — implementation plan

> Decisions already made (2026-09-18):
> - **Pro** gets named alerts and scores. **Free** gets a blurred teaser, with no pricing language.
> - **Tracked per-contact links** are in scope, so manually added and scanned contacts are covered too.
> - **"Met at"** is filled automatically (date + source), plus an owner-set event tag.
> - **Removed 2026-09-23 (owner decision):** the contact panel's "Copy personal link" button and its per-contact "Alert me when they come back" mute switch. Links SwiftCard sends for the owner (SMS/email/share-card/scanner) still carry the token; a contact's lock-screen alerts are stopped only by Not interested / Closed (D5) or the Returning contacts switch in Settings. The per-contact mute and "Copy personal link" items below are history.
> Note: `docs/research/must-have-features.md` does not exist in the repo or in any branch. This plan works from the brief instead.

## Context

Competitors (Popl, Blinq, HiHello, Linq) show anonymous view counts. SwiftCard will tell the owner *which known contact* came back and what they did, and will rank contacts by intent. The make-or-break requirement is that a named alert is never wrong: one misattributed "Priya re-opened your card" costs more trust than ten missed ones. Every rule below is chosen so that **when in doubt, we stay anonymous or silent**. This follows the existing rule that "Someone" is better than a wrong name (`tests/viewer-attribution.test.ts`).

---

## Step 1 findings (summary)

### Tracking
- **Single writers.** `src/lib/record-view.ts` is the only writer of `card_views`. `POST /api/card-events` is the only writer of `card_events` (event types `viewed_card`, `downloaded_vcard`, `clicked_link`).
- **What counts as a view.** A view needs a 2.5s visible dwell (`src/lib/human-gate.ts`). Bots, prefetches, datacenter IPs and the owner are all excluded. Visits within 30 minutes of each other count as one visit.
- **Visitor identity.** The durable id is the httpOnly `sc_vid` cookie (2 years, set in `src/lib/visit-identity.ts`). It adopts the localStorage `kontact_vid` the first time it sees it.
- **Link taps.** A beacon records the **host only**. Taps have no human gate and never notify.
- **No lead links.** Neither `card_views` nor `card_events` carries a `lead_id`.

### Push
- **One notification per visit.** `notifyVisit` (`src/lib/visit-notify.ts`) enforces this with a visit_key and ranks, upgrading the row in place.
- **Delivery policy.** `sendPushToUser` / `decidePush` (`src/lib/push.ts`, `push-policy.ts`) apply:
  - per-category toggles;
  - quiet hours 22:00–08:00, with an 8am catch-up (hourly GitHub workflow);
  - `card_view` alerts **at most once an hour**, with later ones folded into a silent rollup;
  - a daily cap of 5 pushes.
- **Infrastructure.** Pushes are sent inline in the request. There is no Realtime, no edge functions and no DB triggers. The bell polls every 30s. Both Vercel crons are used, so new jobs must be GitHub workflows.

### Leads
- `leads.card_owner` holds the slug.
- `/api/leads` stores the **localStorage** id, not the cookie.
- Manually added and scanned leads have no visitor id.
- The contact panel already shows a timeline via `GET /api/card-events?lead_id=`. It matches on visitor_id **or on email/phone supplied by the client**.
- Every outbound SMS/email link is the plain `/slug`.
- `where_met` is filled in by the owner only.
- Prod: about 13 real leads, 4 with a visitor id, 2 of which returned. That is too few to measure match rates.

### Accuracy hazards this plan must neutralise
| # | Hazard | Effect on alerts |
|---|---|---|
| H1 | The lead stores the localStorage id while views store the cookie id, and the two drift apart | Missed returns |
| H2 | Shared device / shared browser | Wrong name |
| H3 | Email/phone fallback trusts client-supplied fields | Forgeable names |
| H4 | **The device-wide `swiftcard_visitor` blob names a visitor to owners they never gave details to** ("Looks like Priya viewed your card" on owner B's card) | Privacy leak, live today |
| H5 | Email link scanners (SafeLinks, Proofpoint, Mimecast) | Fake "opened" alerts on tracked links |
| H6 | The CRAWLER regex's bare `instagram\|snapchat\|pinterest` drops real in-app-browser visitors | Missed returns |
| H7 | `uq_card_views_device_bucket` is enforced unconditionally, so two people on the same Wi-Fi with the same iPhone build merge into one visit | A contact's view is swallowed |
| H8 | An owner who is signed out on an unclaimed device and once submitted their own form | "You re-opened your card" |
| H9 | The `card_view` hourly rollup and milestone rank collisions | The named alert gets buried or suppressed |
| H10 | Link taps: host only, no gate, no label | Can't say "tapped your listings link" |
| H11 | The privacy policy doesn't disclose `sc_vid` or the linking of visits to contacts | Compliance gap, already present today |

---

## Step 2 — the plan

### 2.1 Visitor identification (make-or-break)

**Recommendation: build a small identity graph of device bindings.** A lead is bound to one or more browsers (`sc_vid` values). Each binding records how it was earned. There are two primary sources, the cookie at form submit and the tracked link, plus a verified-account source. Nothing is inferred from IP, user agent or fingerprinting.

| Binding source | How it's earned | What it recognises | Weakness |
|---|---|---|---|
| **`form`** | The browser submitted this owner's lead form. The server binds the **resolved `sc_vid`** at `/api/leads`, which fixes H1. | The same phone or laptop coming back: via history, rescanning the QR, re-tapping the NFC card, or opening the link from Messages in Safari | A new device, a cleared cookie, or an in-app browser with its own cookie jar |
| **`link`** | The browser opened a **per-contact tracked link** that SwiftCard sent to this lead (follow-up SMS/email, share-card, manual message, scanner send, or "Copy personal link"). The binding is credited **only after the human gate passes, client-side**, never on the server hit (H5). | Every device the contact opens our messages on. This recovers cleared cookies, second devices and in-app browsers, and it is the **only** way to cover manual and scanned contacts. | A forwarded link. Mitigated below. |
| **`account`** (optional, cheap) | A signed-in SwiftCard viewer whose **auth email** equals the lead's email. The server verifies it. | SwiftCard-to-SwiftCard networking | Few visitors are signed in |

**Why this and not tracked links alone:**
- Tracked links only work after the owner has sent something.
- The highest-intent return is often the unprompted one: the person who submitted at an event and comes back three days later from their browser history. Only the form cookie catches that.
- Tracked links are the recovery and expansion channel. Every follow-up re-binds whatever device the contact is using now.

**Why not the localStorage id:** Safari ITP evicts script-written storage after 7 days without interaction. The server-set httpOnly `sc_vid` is not evicted that way. localStorage stays only as the first-sight adoption source.

**Tracked-link mechanics**
- **URL.** `https://swiftcard.me/<slug>?ct=<token>`. The token is 10 random base62 characters (about 59 bits). It is opaque and holds no PII or lead id. It is stored in `contact_links`.
- **Tracker.** `CardEventTracker` reads `ct` from `location.search`, then **immediately strips it** with `history.replaceState`, so copying the address bar never leaks it.
- **Binding.** The tracker sends `ct` in the view POST *after* `waitForHuman`. The server validates the token (owner scope, not revoked, rate-limited lookup) and binds the resolved `sc_vid` to the lead.
- **Scanners.** The server never credits a GET. JS-less previewers and scanners (iMessage/Slack previews, most email scanners) therefore do nothing. JS-executing sandboxes are stopped by `webdriver`, datacenter-IP exclusion (`request-geo.ts`, where most scanners live) and the dwell.
- **Forwarding.** A token can bind at most **3 devices**. The first device bound by a link is named. A **later device bound by the same token that has never been bound by a form** is announced honestly as "Your link to Priya was opened on another device". It is never announced as "Priya re-opened". (Decided D3.)
- **iOS Link Tracking Protection** strips only a known list of parameters such as `fbclid` and `gclid`. A custom `ct` is not on it. Add a test that pins the parameter name so no one renames it to a listed one.

**Resolution at ingest (`resolveKnownContact`):**
1. The owner is resolved to `owner_id`. The lookup runs across **all of that owner's cards**, because Priya may open a second card.
2. Look up active bindings for `(owner_id, visitor_id)`.
   - **No binding** → anonymous. This is today's behaviour, including the hedged client-blob "Looks like X" name, which is **kept for now (decided D10)**. A named re-engagement alert is never produced from the blob.
   - **One lead** → known contact at confidence `form`, `link` or `account`.
   - **Two or more distinct leads** (a shared device, or a family iPad at an open house) → **ambiguous → anonymous**. The exception is when the leads share an email or phone (the same person submitted twice); then the newest lead wins.
3. **Supersede rule.** When a *different* person submits this owner's form on an already-bound browser, the old binding is marked `superseded_at`. The newest submitter owns the browser and ambiguity cannot build up.
4. **Owner guard (H8).** Never bind, and never name, if the lead's email or phone equals the owner's profile or auth email or phone, or if the device is claimed by the owner in `user_devices`.
5. **"Wrong person?" feedback.** Every named alert and every timeline row can be marked wrong. That unbinds the device, and the event is logged. This is both the trust valve and the accuracy metric.
6. **Coverage by case:**
   - **Cleared cookies:** the contact is lost until the next tracked link or form submit. We accept this rather than guess.
   - **Multiple devices:** the union of all bindings, and visits across devices collapse to one alert (§2.4).

### 2.2 Data model (one migration file, `supabase/warm-lead-alerts.sql`)

Menash applies it himself (SQL editor pre-filled URL, or MCP on an explicit "run it").

- **`contact_devices`** (new)
  - Columns: `id uuid pk`, `lead_id uuid → leads(id) on delete cascade`, `owner_id uuid → auth.users on delete cascade`, `visitor_id text not null`, `bound_via text check in ('form','link','account')`, `link_id uuid null → contact_links(id) on delete set null`, `bound_at timestamptz default now()`, `last_seen_at timestamptz`, `superseded_at timestamptz null`, `wrong_at timestamptz null`.
  - `unique (lead_id, visitor_id)`.
  - Index `(owner_id, visitor_id) where superseded_at is null and wrong_at is null`. This is the hot lookup.
- **`contact_links`** (new)
  - Columns: `id uuid pk`, `token text unique not null`, `lead_id → leads on delete cascade`, `owner_id`, `card_slug text`, `channel text check in ('sms','email','share_card','manual_copy','scanner')`, `lead_message_id uuid null → lead_messages on delete set null`, `created_at`, `first_opened_at`, `open_count int default 0`, `devices_bound int default 0`, `revoked_at`.
  - Index `(lead_id, created_at desc)`.
- **`card_events`**: add `lead_id uuid null → leads on delete set null`, `lead_confidence text null`, `target_label text null` (link label, capped at 60 characters). Index `(lead_id, created_at desc) where lead_id is not null`.
- **`card_views`**: add `lead_id uuid null → leads on delete set null`. Same partial index.
- **`notifications`**: add `lead_id uuid null → leads on delete set null`. This replaces the name-substring matching in `NotificationsPanel.tsx`. Add `opened_at timestamptz` for measurement.
- **`leads`**: no score columns (scores are computed at read time, §2.5). `where_met` is reused for the met-at context.
- **Owner event tag**: `profiles.customization._event = {label, until}`. JSONB, no DDL, written through the existing verified-write helper pattern (`src/lib/push-prefs.ts`).
- **Push pref**: add a `contact_return` key to `_push`. JSONB, no DDL.
- **RLS**:
  - The new tables have RLS **enabled with no policies**, so only the service role can use them. This matches `card_events` and `lead_messages`. All access goes through server routes scoped by `ownsLead()` / `getOwnerUsernames()`.
  - The new columns on `leads` and `notifications` inherit the existing own-row policies.
- **Backfill**: bind every existing `leads.visitor_id` as `form`. Only 4 real rows exist, so this is trivial.
- **Constraint fix (H7)**: recreate `uq_card_views_device_bucket` so it applies only to identity-minted rows. This matches the rule `record-view.ts` already states.

### 2.3 Event pipeline

**Recommendation: keep it inline in `POST /api/card-events`.**
- This is the existing, tested path. The tests already require that `notifyVisit` is the only notifier.
- It adds zero new infrastructure: no Realtime, no DB trigger, no edge function.
- The alternatives were rejected:
  - **DB trigger + pg_net + edge function**: new infrastructure, and APNs signing would move out of `src/lib/apns.ts`.
  - **Realtime**: not used anywhere, and push must be server-driven regardless.

Flow for a view or a click:

```
tracker (after human gate) ──POST {visitor_id, ct?, event_type, target, target_label}
  → existing gates (rate, bot, prefetch, active, owner, hosting, 30-min dedupe)
  → resolveVisitIdentity → sc_vid
  → ct? bindViaLink(token, sc_vid)          (only reached by human-gated requests)
  → resolveKnownContact(owner_id, sc_vid) → {lead, confidence} | anonymous | ambiguous
  → insert card_events / card_views with lead_id
  → notifyVisit(contact_returned | contact_link_opened | upgrade)   (§2.4)
  → after(): touch contact_devices.last_seen_at, contact_links.open_count
```

- **Latency:** the 2.5s dwell, plus about 0.3–1s of server work, plus 1–2s for APNs or web push. That is **about 4–6s from the contact opening the card to the owner's lock screen.** The in-app bell stays within its 30s poll. The feed polls every 10s while it is visible (a cheap change; Realtime can come later if needed).
- **Scores** are computed at read time (§2.5). There is no cron and nothing to go stale.

### 2.4 Alert rules

**What alerts** (known contact only; for other visitors, today's anonymous behaviour is unchanged):

| Event | Condition | Result |
|---|---|---|
| Re-open (card or Swift Links) | A new recorded visit from a bound device that starts **more than 30 min after the lead was captured**. Earlier visits are the capture visit, which `new_lead` already announced. | `contact_returned` alert |
| Link tap during that visit | Known contact | **Upgrades the same row in place** ("…and tapped your Calendly link"). It re-pushes only when the tap is on a high-intent link (§2.5). |
| vCard download | Known contact | Upgrade in place, silent |
| First open of a tracked link | `link` binding just earned | `contact_returned` with "opened the link you sent" copy |
| Forwarded link on a new device | Same token, second or later device | Bell row only: "Your link to Priya was opened on another device". No push. |

**Throttling:**
- **Visit key for known contacts** is `slug:lead:<lead_id>:<bucket>` (instead of the visitor id). Two of Priya's devices in the same half hour produce **one** notification.
- **Rank**: insert `contact_returned` at **1.5**. It sits above `card_viewed` and below `milestone`, so a milestone can still upgrade the row and the milestone ledger stays intact (H9). Tests pin the order.
- **New push category `contact_return`**, labelled "Returning contacts" with the hint "A contact you've met opens your card again".
  - **Exempt** from the `card_view` one-alert-an-hour rollup.
  - Has its **own cap**: at most **1 push per contact per 24h** and **5 `contact_return` pushes per day** in total.
  - Does **not** count toward the existing daily cap of 5.
  - Extra visits beyond those caps still write or upgrade bell rows silently.
- **Quiet hours** apply. Add the type to `CATEGORY_FOR_TYPE` in `/api/push/catchup` so it can headline the 8am summary.
- **Per-contact mute**: a `muted` tag on the lead (reusing the existing tag-flag pattern) suppresses pushes. Bell rows are still written.
- **Status**: contacts marked `not_interested` or `dissolved` still show in the bell but never push (decided D5).

**User settings (in the existing `PushPreferencesForm`):**
- the Returning contacts toggle (on by default);
- "Only Hot & Warm contacts" (off by default; Stage C);
- per-contact mute in the contact panel;
- quiet hours reused as they are.

**Copy** (title ≤ 40 characters, body ≤ 60, via the existing `fitBody`; no selling language):
- **Pro:** title "Priya re-opened your card". Body "3rd visit this week · tapped Calendly", or "Met at RE/MAX Summit · 2nd visit".
- **Free:** title "A contact re-opened your card", body "Open SwiftCard to see who". The name is blurred in the bell through a new name mark, generalised from the location marks in `src/lib/location-privacy.ts`, so it is redacted server-side and never hidden only with CSS.
- **Locked Free leads** (over the cap) never have their name surfaced. This mirrors the teaser in `/api/leads`.
- **Tap target:** `/contacts?card=<slug>&lead=<id>`. The app opens on the contact screen, never a lock-screen action (standing rule).

### 2.5 Scoring (Stage C) — one documented function, `src/lib/intent-score.ts`

```ts
export const INTENT = {
  halfLifeDays: 7,           // recency decay: weight × 0.5^(ageDays / 7)
  windowDays: 30,            // events older than this contribute nothing
  weights: {
    return_visit: 3,         // each distinct visit after capture (per 30-min visit, all devices)
    link_tap: 2,
    high_intent_link_tap: 4, // booking/listing hosts (calendly.com, cal.com, acuityscheduling.com,
                             //   zillow.com, realtor.com, …) or an owner-starred link
    vcard_download: 3,
    inbound_reply: 5,        // lead_messages direction='in'
  },
  hot:  { minScore: 8, maxDaysSinceLast: 3 },
  warm: { minScore: 3, maxDaysSinceLast: 14 },   // otherwise Cold
};
export function scoreContact(events, now): { tier, score, reason, lastEngagedAt }
```

- **Reason text** is built from **counts, never the number**. It shows the two largest contributors: "viewed 4× this week, tapped Calendly". Counts come from visits (30-min windows), not raw rows, and no trend is invented (standing rule).
- **Inputs:** only events with `lead_id` set, non-superseded, not marked wrong, from the last 30 days. Capture itself adds nothing. A brand-new lead is Warm only if it comes back.
- **Recalculation:** at read time. The contacts page and the dashboard load the owner's lead-linked events for the last 30 days in one indexed query and score in TypeScript. Decay is automatic, with no cron and no stale column.
- **Scale:** switch to a stored score updated in `after()` plus a daily GitHub workflow only if an owner goes over about 5k linked events a month.
- **Location** is never an input. It hits the IP-geo ceiling, and Free accounts can't see it.

### 2.6 UI (reusing existing components)
- **Bell and `NotificationsPanel`:**
  - Named row with a tier pill and the reason.
  - Tapping uses `notifications.lead_id`, replacing the name-substring match.
  - A "Wrong person?" action on the row.
  - Free gets a blurred name through `NotificationBody`'s smudge, generalised from `BlurredPlace`.
- **Contacts list (`ContactsClient.tsx`):**
  - An `IntentBadge` pill (Hot, Warm; nothing for Cold, since negative labels aren't shown) next to the name.
  - The misnamed "activity" sort (it actually sorts by `follow_up_date`) is replaced with **"Follow up first"**: tier, then last engaged.
  - Hot/Warm filter chips.
- **Contact detail panel:**
  - A badge plus a reason line, and a "Copy personal link" button (mints a `manual_copy` token).
  - A mute toggle.
  - The timeline switches to `lead_id`-stamped events. The client email/phone fallback is kept only for legacy rows and labelled as unverified.
- **Dashboard:**
  - A **"Follow up first"** card at the top of the Quick Contacts column, above the Notifications/Contacts toggle (`dashboard/page.tsx` around line 1194).
  - Up to 5 Hot/Warm contacts, each with a reason and a one-tap route into the contact.
  - **Hidden when empty**, so there are no negative analytics.
  - Free shows "2 contacts are warming up" with blurred names and no pricing copy.
- **Share page (`/share`, where the QR lives):** an "At an event?" chip that sets `_event.label` until midnight local time. Leads captured while it is active get `where_met` stamped. Without it, the alert falls back to "met Sep 18 via QR".
- **Knowledge base:** update `src/lib/knowledge/docs/` (contacts, dashboard, notifications) in the same PRs, as required by `AGENTS.md`.

### 2.7 Privacy
- **Only leads can be named.** A contact is named only through a binding the owner earned: the contact exchanged details, or the owner sent them a link. Anonymous visitors stay anonymous.
- **H4 (cross-owner "Looks like X")** stays as it is for now (decided D10). It is documented here so it can be revisited.
- **Disclosure at collection.** No line on the form (decided D1). The privacy policy is therefore the **only** disclosure, so the policy update in B4 is required before Stage B ships.
- **Privacy policy (`src/app/privacy/page.tsx`)** needs three new items:
  - the `sc_vid` cookie (purpose, 2 years);
  - that visits, link taps and downloads by people who shared their details are shown to that card owner;
  - per-contact links in messages, retention, and how a visitor asks for removal.
  It also needs one correction: "cookies only for sign-in and security" is already inaccurate.
- **EU/UK visitors:** treated the same as everyone else (decided D2). This carries legal risk; revisit when EU usage appears.
- **Deletion:**
  - Deleting a lead cascades to `contact_devices` and `contact_links`.
  - `card_events.lead_id` and `card_views.lead_id` are set to null, so the history becomes anonymous.
  - Notifications tied to that lead (`notifications.lead_id`) are **deleted** (decided D8).
  - The unsubscribe link also revokes that contact's tokens.
  - The account purge (`src/lib/account-purge.ts`) gets the two new tables.

### 2.8 Edge cases
| Case | Handling |
|---|---|
| Owner views own card | Existing session and `sc_device` exclusion, plus the owner guard on binding (§2.1 step 4) |
| iMessage/Slack/WhatsApp previews | No JS, so no event. The UA denylist is already in place. `ct` is credited only after the human gate. |
| Email scanners | Datacenter-IP exclusion + webdriver + 2.5s visible dwell. The server GET never credits. A UA/IP test matrix is added. |
| Shared device or kiosk | Supersede on a new submit, ambiguity leads to anonymous, and the owner's own kiosk device is excluded as owner traffic |
| Forwarded tracked link | 3-device cap; second or later devices get honest "another device" copy and no push |
| Deleted contact | Cascade / set null (§2.7) |
| Same person submitted twice | Leads with a shared email or phone are treated as one person; the newest wins |
| IG/Snap in-app browsers | Fix H6: match `Instagram <ver>` as an app UA, not a bot. Tests are added. |
| Same Wi-Fi + same iPhone | Fix H7 (conditional unique index) |
| Office members | Alerts go to the card's owner (the member). Admins get a team "Follow up first" view in Stage C (decided D6, PR C5). |

### 2.9 Testing and success measurement
- **Unit tests:**
  - `intent-score.test.ts`: fixtures for each tier, decay, reason strings, no invented trends.
  - `known-contact.test.ts`: form/link/account binding, ambiguity, supersede, owner guard, wrong-person unbind, device cap.
- **Route tests (in-memory DB, the `tests/view-identity.test.ts` pattern):**
  - H1 drift fixed.
  - A return 31 minutes later alerts.
  - A return within 30 minutes doesn't.
  - Two devices produce one alert.
  - A scanner-shaped request never binds.
  - Free redaction of names in push, bell and API.
  - Rank and milestone interplay.
  - Caps.
- **Source invariants:**
  - Only `notifyVisit` notifies.
  - No `sendPushToUser` in the routes.
  - The `ct` parameter name is pinned.
  - The token is stripped with `replaceState`.
  - No lock-screen actions.
- **Render and QA:**
  - `npm run test:render` for the badge, dashboard card and panel.
  - `qa:sweep` and `qa:flows` against a production build.
- **Live probe:** a demo-sales-style probe with no push subscribers, to exercise binding and alerts without buzzing a real phone. Clean up afterwards.
- **Manual end to end:**
  1. Phone A submits the form.
  2. 31 minutes later, phone A reopens → named push.
  3. The owner sends an SMS follow-up and phone B opens it → B is bound and a push arrives.
  4. B forwards the link to phone C → an "another device" bell row and no push.
- **Metrics** (via the existing `product_events` + `notifications.opened_at`):
  - Trust: "Wrong person?" rate per named alert. **Target under 2%.** This is the kill switch metric.
  - Coverage: share of real leads with at least one live binding; share of returns identified by form vs link.
  - Funnel: alert → opened (push tap stamps `opened_at`) → owner action on that lead within 24h (outbound `lead_messages`, call/text tap) → inbound reply or stage moved to meeting/won.
  - Baseline: the same funnel for leads with no alert.
  - Business: Free teaser tap → upgrade.

---

## Step 3 — PR sequence (each on its own `feature/warm-lead-*` branch → PR → review → merge; never direct to main)

Migrations are separate files applied by Menash. Code must tolerate columns that don't exist yet (the existing 42703/PGRST204 retry pattern), so merge order and apply order can't break production.

**Stage A — Identity**
| PR | Scope | Key files | Effort |
|---|---|---|---|
| A0 | Commit this plan | `docs/plans/warm-lead-alerts.md` | S |
| A1 | Fix H1: `/api/leads` resolves `sc_vid` via `resolveVisitIdentity` and sets the cookie | `src/app/api/leads/route.ts`, `tests/view-identity.test.ts` | S |
| A2 | Accuracy fixes: H6 in-app browser UAs, H7 conditional device index | `src/lib/bot-detection.ts`, `supabase/view-device-index-fix.sql`, tests | S |
| A3 | Schema: `contact_devices`, `contact_links`, `lead_id` columns, `target_label`, `notifications.lead_id/opened_at`, backfill | `supabase/warm-lead-alerts.sql` | M |
| A4 | `src/lib/known-contact.ts`: bind at capture, `resolveKnownContact` at ingest, owner guard, ambiguity; stamp `lead_id`; timeline GET by `lead_id` | `api/card-events/route.ts`, `api/leads/route.ts`, `record-view.ts`, `viewer-identity.ts`, `card-event-notify.ts`, tests | M |
| A5 | Tracked links: `src/lib/contact-links.ts` mint/validate; tracker reads, strips and sends `ct` after the gate; the server binds with the device cap; wired into `messaging.ts` (SMS + email), `share-card`, the manual message route and `scanner/send`; "Copy personal link"; unsubscribe revokes | listed files + `CardEventTracker.tsx`, `ContactsClient.tsx` | L |
| A6 | Link-tap labels (`target_label`) from `SwiftLinkButtons`/`CardActionLinks`/`SocialIcons` | `track-link-click.ts` + call sites | S |

**Stage B — Alerts (first ship = A + B)**
| PR | Scope | Key files | Effort |
|---|---|---|---|
| B1 | `contact_return` category, rank 1.5, lead-scoped visit key, per-contact and daily caps, catch-up mapping, settings toggle, copy, Free name mark, `lead_id` deep link | `push-policy.ts`, `visit-notify.ts`, `push.ts`, `push/catchup/route.ts`, `location-privacy.ts` → name marks, `notification-privacy.ts`, `PushPreferencesForm` | L |
| B2 | Feed: `NotificationsPanel` uses `lead_id`, 10s poll while visible, "Wrong person?" unbind route, per-contact mute; push-tap `opened_at` | `NotificationsPanel.tsx`, `NotificationBell.tsx`, `api/notifications`, new `api/contacts/[id]/unbind` | M |
| B3 | Met-at: "At an event?" chip on `/share`, stamping `where_met`, auto-context fallback | `src/app/share/*`, `api/leads/route.ts` | M |
| B4 | Privacy policy, lead-form disclosure line, knowledge base docs, account-purge coverage | `privacy/page.tsx`, `LeadCaptureForm.tsx`, `knowledge/docs/*`, `account-purge.ts` | S |

**Stage C — Scoring**
| PR | Scope | Key files | Effort |
|---|---|---|---|
| C1 | `intent-score.ts` + fixtures | `src/lib/intent-score.ts`, tests | M |
| C2 | Contacts: `IntentBadge`, "Follow up first" sort, Hot/Warm filter, reason in the detail panel | `ContactsClient.tsx`, `contacts/page.tsx` | M |
| C3 | Dashboard "Follow up first" card (hidden when empty, Free teaser) | `dashboard/page.tsx`, new `FollowUpFirst.tsx`, render test | M |
| C4 | Tier in alert copy, "Only Hot & Warm" setting, admin metrics view for the trust and funnel numbers | `card-event-notify.ts`, `push-policy.ts`, `/admin/analytics` | M |
| C5 | Office admin team "Follow up first" view across members' cards | `src/app/office/*`, `src/lib/office-analytics.ts` | M |

---

## Decisions (Menash, 2026-09-18)
| # | Question | Decision |
|---|---|---|
| D1 | Line on the lead form saying the owner may see revisits | **No line.** The privacy policy (B4) is the only disclosure. |
| D2 | EU/UK cookie consent for `sc_vid` | **Same for everyone.** No consent gating. |
| D3 | Forwarded tracked link opened on another device | **"Your link to Priya was opened on another device"**, bell only, no push. |
| D4 | Push caps for `contact_return` | **1 per contact per 24h, 5 per day in total**, outside the existing 5/day cap. |
| D5 | Not interested / Closed contacts | **Bell only, no push.** |
| D6 | Office admins | **Yes**, a team "Follow up first" view (PR C5). |
| D7 | Retention of name-linked visit history | **Forever** (until the contact or account is deleted). |
| D8 | Contact deleted | **Delete the notifications tied to that contact.** |
| D9 | High-intent links | **Built-in host list** (booking and listing sites). |
| D10 | Cross-owner "Looks like X" naming (H4) | First "keep for now", then **reversed: fixed** (PR B4). The privacy policy could not truthfully say a visitor is named only to the owner they shared with while it stayed. |

## Build notes (2026-09-18): where the build differs from the plan above

| PR | What changed | Why |
|---|---|---|
| A2 | H7 was only half fixed. A row is given no device key when the request carried the `sc_vid` cookie. Cookie-less browsers keep the key. | The unique index is also what collapses a cookie-less browser's fresh-id reloads (the tests depend on it). Two *first-time* visitors on one Wi-Fi with identical phones still merge. That can't be told apart from one browser reloading. |
| A3 | Added `contact_devices.link_device_index` and `push_log.lead_id`. | Forwarded-link devices (D3) and the per-contact push cap (D4) need them. |
| B1 | A link tap upgrades the visit's bell row **silently**. It never re-pushes. | D4 is 1 push per contact per day, so a second push in the same visit would be capped anyway. |
| B4 | H4 fixed: views no longer send the visitor blob, and the server names an anonymous visitor only from the owner's own contact record. | D10 reversed (see above). |
| C1 | Warm threshold is **1.5**, not 3. | One return visit decays below 3 within a day. One return now stays Warm for about a week. |
| C4 | Setting is **"Only Hot contacts"**, not "Only Hot & Warm". | A contact who has just come back always scores at least Warm, so "Hot & Warm" could never filter anything. |
| B3 | The "At an event?" chip is on the dashboard's Share box, not `/share`. | `/share` is the Links page. The QR code people scan lives on the dashboard. |
| A5 | `/api/scanner/send` still sends a plain card link. | It has no lead id at send time. |

**PRs:** #48 (this plan), then A1 #49, A2 #50, A3 #51, A4 #52, A5 #53, A6 #54, B1 #55, B2 #56, B3 #57, B4 #58, C1 #59, C2 #60, C3 #61, C4 #62, C5 #63. Each one is stacked on the one before it, so merge them in order. **`supabase/warm-lead-alerts.sql` (#51) must be applied** before anything is recognised. Until then the code behaves as it does today.
