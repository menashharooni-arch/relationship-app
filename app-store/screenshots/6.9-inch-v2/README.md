# 6.9-inch App Store screenshots (1320 × 2868)

Nine frames, built 2026-09-04, replacing the v1 set in `../6.9-inch`.

**Why v1 was replaced.** It was captured as evidence for App Review, not as
marketing — shot 1 was the LOGIN screen and shot 5 was a "Couldn't find that
card" 404 page, both live on the listing. It also could not show Swift Links,
the Signature or the contacts CRM, because those need a signed-in session.

## The set, in listing order

Search results show the first three, so the story has to land there.

| # | Caption | Screen |
|---|---|---|
| 01 | Your card. One link. | public card — photo-first template, headshot + violet panel |
| 02 | They save you in one tap | same page, Save Contact + share-back form |
| 03 | Every lead, in your pocket | Contacts, with source badges |
| 04 | All your links, one page | Swift Links — cover photo, bio, six socials |
| 05 | Video, photos, booking | Swift Links tiles — featured, 2×2 grid, quick rows |
| 06 | Your card in every email | Swift Signature preview |
| 07 | See exactly who's looking | Dashboard traffic, real chart |
| 08 | QR, NFC and Apple Wallet | Share options, incl. Add to Apple Wallet |
| 09 | It writes the follow-up for you | Contact → follow-up automations |

The demo persona is **Lena Brooks, photographer** — the same persona the
marketing site's hero showcase uses, and her headshot (`public/showcase/lena.jpg`)
already ships in this repo, so the set shows a real face without licensing a
stock photo.

**The design was chosen by rendering the candidates, not by reading the preset
list** — `scripts/appstore-explore.mjs` seeds one throwaway account, gives each
candidate its OWN card slug (the public page is cached per URL, so patching one
card and re-shooting silently re-serves the first design), and shoots them side
by side.

What won, and why:

- **Card — `photo-first`, `#0a0a0a` panel, `#111827` accent.** The headshot is
  the only colour on the card and the buttons go near-black. The violet gradient
  this replaced fought both the photo and the page around it.
- **Swift Links — the `aura` Look, `linkIconFill: "accent"`, all links
  `compact`.** Two findings behind that: `linkIconFill` only renders monotone on
  some Looks (`aura` and `sand` do; `onyx`, `midnight` and `paper` keep the
  brand colours), and `linkButtonStyle` had no effect at all here. What DOES
  control the noise is per-link `size` — a link with no preview image falls back
  to a gradient picked by index, so a page of `featured`/`grid` tiles renders as
  a rainbow. Rows fixed it.

Every frame is a real screen of the running app inside an identical frame:
same background, same caption block, same device geometry. Apple 2.3.3 wants
screenshots that show the app in use; a caption and a device frame around a
real screen are allowed, a mocked-up slide is not.

## Regenerating

    node scripts/appstore-capture.mjs     # real screens  → app-store/screenshots/_raw
    node scripts/appstore-compose.mjs     # framed set    → this directory

`appstore-capture.mjs` creates a throwaway Supabase account, seeds it with a
card, links, contacts and a fortnight of views, drives a real browser through a
real login as the iOS shell, and deletes everything afterwards. Four things it
learned the hard way, all encoded in the script:

- the submit button is `Sign in →`; `Sign in` matches the tab above the form;
- `_aiConsent: "accepted"` must be seeded or the AI consent dialog covers every
  screen — that is what made "Add to Apple Wallet" look missing;
- the shell paints a splash over the first viewport, so the dashboard needs a
  wait before a full-page shot or the overlay bakes into the top third;
- "Add to Apple Wallet" only renders inside the native shell, behind
  **Other ways to share** — hence the `window.Capacitor` shim.

## Uploading

`scripts/asc-upload-screenshots.mjs` defaults to the 1.0.0 localization, which
is live and cannot accept screenshots. Target the pending version:

    ASC_LOCALIZATION_ID=077d36d9-9903-46b1-8a9a-0b5ac3226bf5 \
      node scripts/asc-upload-screenshots.mjs app-store/screenshots/6.9-inch-v2

It deletes and recreates the APP_IPHONE_67 set, so the listing mirrors this
directory exactly rather than appending.
