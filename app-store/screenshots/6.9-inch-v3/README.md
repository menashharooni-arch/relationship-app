# 6.9-inch App Store screenshots (1320 × 2868) — v3

Ten frames (Apple's maximum), built 2026-09-06, replacing the v2 set. Same
persona (Lena Brooks, photographer), real screens, a busier account and a
stronger frame.

## What changed from v2, and why

- **The account behind the screens is a working Pro account.** v2's seed had
  five contacts with no notes, zero Swift Link views, "No notifications yet"
  and a fortnight of double-digit view days — an empty product. The seed now
  writes a month of views on both surfaces (≈4,300 card, ≈2,000 Swift Links,
  one spike day, weekend dips, repeat visitors), six contacts with company,
  town, where-you-met, notes, a share-back message, `sms-ok` consent and a
  running email + text sequence (day-0 items already sent), card_events for
  the Conversation tab, a sent follow-up with a reply in `lead_messages`, and
  three notifications. Nothing on any frame reads "No notes", "Not set",
  "no flow" or `0`.
- **The share-back is shown happening.** Frame 02 is the public card with
  the "Share your info with Lena" form filled in as Jordan; frame 03 has
  Jordan in Contacts; frames 04–05 open Jordan's record. One lead, followed
  from the tap to the follow-up.
- **The phone is bigger and runs off the bottom edge.** A search-result
  thumbnail is ~200px tall; v2 fitted the whole phone inside the frame, so
  the app was a third of the pixels.
- **Status bar and Dynamic Island inside the glass.** Bare web renders in a
  phone silhouette read as a website in a picture frame.
- **A kicker pill names the feature** above the headline, and one phrase per
  headline is set in the accent tint.
- **The tab bar no longer floats mid-screen.** Full-page captures paint
  position:fixed chrome once at the first viewport's bottom edge; v2's
  dashboard frame had the tab bar above the chart. `appstore-capture.mjs`
  hides `.sc-tabbar` and `.sc-help-bubble` for full-page shots.
- **The contact detail scrolls inside a panel**, so a full-page shot stops at
  the first automation card. The capture scrolls the panel to "Notes &
  context" and takes a viewport shot (`contact-detail-automations`).
- **Crops start on clean edges**, chosen from the capture on disk.

## The set, in listing order

Search results show the first three, so the story has to land there.

| # | Kicker | Caption | Screen |
|---|---|---|---|
| 01 | Digital business card | Your card. One link. | public card, top |
| 02 | Share back | They save you, then share back | Save Contact + the share-back form filled in |
| 03 | Contacts | Every lead, in your pocket | six contacts with source badges |
| 04 | Contact | Who they are, where you met | Jordan: contact info, notes, where met |
| 05 | Follow-ups | It writes the follow-up for you | notes → automations, email sequence on, day-0 sent |
| 06 | Analytics | See exactly who's looking | Month: 3,529 / 1,727 views, 30-bar chart, notifications |
| 07 | Locations | Know which towns find you | Locations tab, eight towns split card / links |
| 08 | Swift Links | All your links, one page | cover photo, bio, socials, links |
| 09 | Swift Signature | Your card in every email | signature preview dialog |
| 10 | Share | QR, NFC and Apple Wallet | Share options incl. Add to Apple Wallet |

Every frame is a real screen of the running app (Apple 2.3.3): a caption, a
status bar and a device frame around a real capture are allowed, a mocked-up
slide is not. The numbers are seeded, not invented on the frame — they are
what the app computed from the rows the seed wrote.

## Regenerating

    node scripts/appstore-capture.mjs     # real screens  → app-store/screenshots/_raw
    node scripts/appstore-compose.mjs     # framed set    → this directory

The capture script creates a throwaway Supabase account on whatever
`.env.local` points at, seeds it, drives a real login, and deletes every row
it wrote (card_views on both keys, card_events, lead_messages, notifications,
leads, card, profile, auth user) in a finally block.

## Uploading

`scripts/asc-upload-screenshots.mjs` defaults to the 1.0.0 localization, which
is live and cannot accept screenshots. 1.0.1 shipped (2026-09-08) still on the
v2 set — it was submitted before this set existed and locked. This set is
attached to **1.0.2** (created 2026-09-08, Prepare for Submission; description,
keywords and promo text carried over), and goes live when 1.0.2 is submitted
with a build:

    ASC_LOCALIZATION_ID=efacc7ef-d168-43b7-9751-cf49f0cb2046 \
      node scripts/asc-upload-screenshots.mjs app-store/screenshots/6.9-inch-v3

Re-shot 2026-09-08: the 09-06 dashboard frame had its newest four days flat
(3,529 views instead of the 4,354 seeded) because the first 1000-row
`card_views` batch failed silently. The seed now checks every batch.

It deletes and recreates the APP_IPHONE_67 set, so the listing mirrors this
directory exactly rather than appending. A version that is Waiting for Review
refuses the delete (409) — remove it from review first.
