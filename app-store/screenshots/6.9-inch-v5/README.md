# 6.9-inch App Store screenshots (1320 × 2868) — v5

Built 2026-09-10 by `scripts/appstore-compose-v5.mjs` from the same `_raw`
captures as v3/v4 (Lena Brooks, photographer; real screens of the running app).

**NOT uploaded.** The unreleased 1.0.2 version still holds v4; the live 1.0.1
listing still shows v2. Never submit, and never replace a staged set, without
Menash's explicit go.

## Why v5 exists

> "make sure our newest pictures show an actual iPhone and not just a random
> screen to make the pictures look more alive real and more professional"

v4's device was a rounded rectangle with a 14px edge that ran off the bottom of
the canvas. It had no bottom, no home indicator, a hairline where the titanium
should be, and a Dynamic Island usually hidden behind a pop-out. It read as a
floating UI panel, not a phone.

## What changed

- **The whole device is in frame.** A phone with no bottom edge can only read as
  a panel — the eye needs the closed silhouette. This is the change that does
  most of the work, and it costs screen size: the glass is 960px wide, not 1180.
- **Real proportions, from the hardware.** iPhone 16 Pro Max is 163.0 × 77.6 mm
  with a 73.3 × 159.2 mm display, so the body is 2.1005:1 (v5 renders 2.108:1)
  and the black border is ~2.1mm — about 3% of the body width. v4 drew it at
  1.2%, which is why it looked like a screen with a keyline.
- **The glass shows exactly one viewport.** Captures are 1320 × 2868, the 6.9"
  screen is 1320 × 2868, and the glass keeps that ratio exactly — so a frame
  shows precisely what someone holding the phone would see. `y` stopped being a
  crop and became what it should always have been: how far the page is scrolled.
- **Titanium, not a keyline.** A multi-stop gradient with specular bands near
  both vertical edges; that bright catch is what reads as metal at thumbnail size.
- **The parts that say iPhone:** correctly-sized Dynamic Island (125 × 36.7pt)
  with its camera lens, home indicator, Action button / volume pair / power /
  Camera Control in their real positions, a diagonal glass sheen, and a contact
  shadow so the device sits on the art rather than floating in front of it.
- **Pop-outs moved to the side edges.** They hung off the TOP edge in v4, which
  against a whole phone would cover both the sub-heading and the Dynamic Island.
  Off a side edge they still break the silhouette — same depth cue — with the
  caption and the island left alone.
- **The status bar colour is now measured, not typed.** The captures have no
  status bar, so one is drawn on; its background has to match the page at that
  scroll position or there is a seam across the top of the glass. v4 hand-set it
  per frame, and four of the ten had drifted. `topColour()` decodes the capture
  and samples the first row under the bar, so re-tuning a scroll offset can no
  longer leave a mismatched bar behind.

## Unchanged from v4, deliberately

The same real captures, the same pop-out components carrying the seeded
account's own numbers, the same headlines and sub-captions. Only the device and
the layout that follows from it moved.

## Capture notes

- Frames 09 and 10 are now `y: 0`. Their captures are exactly one viewport tall
  (2868), so with the glass showing a whole viewport there is nothing to scroll
  past; v4 offset them by 200 / 610 to fill a shorter window.
- Pop-out values are typed into `appstore-compose-v5.mjs` and must match the raw
  capture: 4,345 card views, best day Sep 3 · 700, Portland 3,193 (2,574 / 619).
  Re-check them after every re-capture.
- All ten verified 1320 × 2868, RGB with no alpha channel — App Store Connect
  rejects screenshots that carry one.

## Rebuild

    node scripts/appstore-compose-v5.mjs           # all ten
    ONLY=01,06 node scripts/appstore-compose-v5.mjs  # just those two

`GLASS_W` is the single number that sets the device scale; everything else —
bezel, rail, corner radii, status bar, island, home indicator, pop-out bands —
is derived from it, so the whole frame stays proportional if it changes.
