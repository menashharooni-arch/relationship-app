# App Store Connect Checklist (exact manual steps, in order)

_Everything below is owner work in a browser or Xcode. Nothing here is
automatable from this repo. Prerequisites from the Apple Developer portal are
in RELEASE_CHECKLIST.md §A._

## 1. Create the app record

1. appstoreconnect.apple.com → My Apps → **+ → New App**.
2. Platform iOS · Name **SwiftCard: Digital Card & CRM** (30-char limit) ·
   Primary language English (U.S.) · Bundle ID **me.swiftcard.app** · SKU
   `swiftcard-ios-1`.

## 2. App Information

- Subtitle: `Share your card. Keep leads.`
- Category: **Business**; secondary **Productivity**.
- Content rights: does not use third-party content.
- License agreement: standard Apple EULA (our Terms already carry the
  Apple-required clauses at swiftcard.me/terms).

## 3. Pricing & Availability

- Price: **Free**. No in-app purchases exist — do not create any IAP products.
- Availability: all territories (or US-first if preferred).

## 4. Age rating — 2025 questionnaire (mandatory since Jan 31 2026)

Answer the updated questionnaire. Expected answers for SwiftCard: no violence,
no medical, no gambling; **user-generated content: the app hosts user-created
public business cards — answer the UGC/social questions truthfully:**
"infrequent/mild" user-generated content with report + takedown mechanisms;
no social networking features (no messaging between users, no feeds, no
follower graphs). Expected outcome: **4+ (or 13+ if the UGC answer forces
it — accept whatever the questionnaire computes; do not game it).**

## 5. App Privacy

- Privacy Policy URL: `https://swiftcard.me/privacy`
- Fill the labels EXACTLY from `APP_PRIVACY_DISCLOSURE_MATRIX.md`
  ("App Store Connect privacy label answers" section).

## 6. Version page

- Screenshots (see shot list in docs/ios-review/APP-STORE-METADATA.md):
  **6.9-inch iPhone set at 1320 × 2868 px portrait (2026 canonical; smaller
  iPhones auto-scale from it).** iPad sets only if you enable iPad — the
  current target is iPhone; if Xcode's "Designed for iPad" is on, either
  supply a 13-inch iPad set (2064 × 2752) or restrict to iPhone.
- Promotional text / description / keywords: copy-paste from
  docs/ios-review/APP-STORE-METADATA.md.
- Support URL: `https://swiftcard.me/contact` ← NOT /support (that path 404s).
- Marketing URL: `https://swiftcard.me`.
- Version 1.0.0; "What's New": `Your digital business card, now on iPhone.`

## 7. App Review Information

- Sign-in required: YES. Demo credentials: see
  `REVIEWER_DEMO_ACCOUNT_TEMPLATE.md` (run the script, paste the login —
  never commit the password to the repo).
- Notes: paste the block from `APP_REVIEW_NOTES.md`.
- Contact: name, email, and a REAL phone number (required).

## 8. Export compliance

- Info.plist already ships `ITSAppUsesNonExemptEncryption = false`
  (standard HTTPS only), so App Store Connect asks nothing per-build.
  If the question appears anyway: "None of the algorithms mentioned" /
  exempt. Details: `EXPORT_COMPLIANCE_NOTES.md`.

## 9. Build upload (after RELEASE_CHECKLIST §A–D pass)

1. Xcode → Product → Archive (Release, Any iOS Device).
2. Organizer → Validate App first (this runs Apple's privacy-manifest and
   required-reason checks) → fix anything → Distribute App → App Store Connect.
3. In ASC → TestFlight: the build appears; complete the missing-compliance
   prompt if shown (should be none, per §8).
4. Attach the build to version 1.0.0 on the version page.

## 10. Final pre-submit gate

- Run the full `TESTFLIGHT_TEST_PLAN.md` on a real device via TestFlight.
- Re-read `KNOWN_LIMITATIONS.md` — every listed limitation must still be
  accurately reflected in metadata and reviewer notes.
- Submit ONLY when every box in `RELEASE_CHECKLIST.md` is checked.
