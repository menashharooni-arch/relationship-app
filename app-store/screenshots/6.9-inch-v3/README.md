# 6.9-inch App Store screenshots (1320 × 2868) — v3

Eight frames, built 2026-09-06, replacing the v2 set. Same persona (Lena
Brooks, photographer), same real screens, a stronger frame.

## What changed from v2, and why

- **The phone is bigger and runs off the bottom edge.** A search-result
  thumbnail is ~200px tall. v2 fitted the whole phone inside the frame, so the
  app itself was a third of the pixels. v3 lets the device bleed off the
  bottom, which is how every top-grossing listing buys screen size.
- **Status bar and Dynamic Island inside the glass.** The captures are web
  renders with no system chrome; a bare page in a phone silhouette read as a
  website in a picture frame. Light pages get a bar in their own page colour,
  the Swift Links photo cover gets white glyphs laid over the image.
- **A kicker pill names the feature** above the headline, and one phrase per
  headline is set in the accent tint. v2's flat white text had no hierarchy.
- **The tab bar no longer floats mid-screen.** Full-page captures paint
  position:fixed chrome once at the first viewport's bottom edge, so v2's
  dashboard frame had the tab bar sitting above the traffic chart.
  `appstore-capture.mjs` now hides `.sc-tabbar` and `.sc-help-bubble` for
  full-page shots.
- **Crops start on clean edges.** Every y offset was chosen from the capture
  on disk so no frame opens on a half-sliced card or ends on a half button.
- **Nine frames became eight.** v2's fifth frame (Swift Links tiles) showed
  the same page as the fourth once the links went compact.

## The set, in listing order

Search results show the first three, so the story has to land there.

| # | Kicker | Caption | Screen |
|---|---|---|---|
| 01 | Digital business card | Your card. One link. | public card, top |
| 02 | Save contact | They save you in one tap | Save Contact + share-back form |
| 03 | Contacts | Every lead, in your pocket | Contacts with source badges |
| 04 | Swift Links | All your links, one page | cover photo, bio, socials, links |
| 05 | Swift Signature | Your card in every email | signature preview dialog |
| 06 | Analytics | See exactly who's looking | Share buttons + traffic chart |
| 07 | Share | QR, NFC and Apple Wallet | Share options incl. Add to Apple Wallet |
| 08 | Follow-ups | It writes the follow-up for you | contact detail → automations |

Every frame is a real screen of the running app (Apple 2.3.3): a caption, a
status bar and a device frame around a real capture are allowed, a mocked-up
slide is not.

## Regenerating

    node scripts/appstore-capture.mjs     # real screens  → app-store/screenshots/_raw
    node scripts/appstore-compose.mjs     # framed set    → this directory

The capture script creates a throwaway Supabase account on whatever
`.env.local` points at, seeds it, drives a real login, and deletes everything
in a finally block. See the comments in it for the traps it encodes.

## Uploading

`scripts/asc-upload-screenshots.mjs` defaults to the 1.0.0 localization, which
is live and cannot accept screenshots. Target the pending version:

    ASC_LOCALIZATION_ID=077d36d9-9903-46b1-8a9a-0b5ac3226bf5 \
      node scripts/asc-upload-screenshots.mjs app-store/screenshots/6.9-inch-v3

It deletes and recreates the APP_IPHONE_67 set, so the listing mirrors this
directory exactly rather than appending.
