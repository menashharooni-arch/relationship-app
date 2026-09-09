# 6.9-inch App Store screenshots (1320 × 2868) — v4

Built 2026-09-09 by `scripts/appstore-compose-v4.mjs` from the same `_raw`
captures as v3 (Lena Brooks, photographer; real screens of the running app).
**Uploaded to the unreleased 1.0.2 version on 2026-09-09** (replacing v3); it goes live
with the next build submission. The live 1.0.1 listing still shows the v2 set. Never
submit without Menash's explicit go.

## What changed from v3, and why

- **Pop-outs.** One or two real UI elements per frame float off the glass over
  the device edge with a deep shadow: the 4,354 stat, Jordan's share-back
  notification, Portland's 3,250 views, the sent follow-up email, the source
  badges, the Add to Apple Wallet button. Every value is the seeded account's
  own number, the same the screen behind it shows. Nothing is invented.
- **Shorter, larger headlines** in Geist (the app's typeface), one accent
  phrase each. Sub-captions cut to one idea.
- **Background with depth**: brand-blue gradient, a glow behind the device, a
  diagonal light sheen and film grain.
- **Device**: side buttons, specular top edge, layered shadow; starts at
  y=900 (v3: 985) so more of the app shows.
- **The dead band is gone.** v3 had ~300px of empty navy between the caption
  and the phone; the pop-outs now live there.

## Capture notes

- Re-captured 2026-09-09 with username `lenabrooks-photography` (v3 showed
  `alex-rivera-21416935` on the Share options frame).
- Pop-out values are typed into `appstore-compose-v4.mjs` and must match the
  raw capture: 4,345 card views, best day Sep 3 · 700, Portland 3,193
  (2,574 / 619). Re-check them after every re-capture.
