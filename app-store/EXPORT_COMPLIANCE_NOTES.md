# Export Compliance Notes

## Status: exempt (standard encryption only)

The app is a WKWebView shell over HTTPS plus Capacitor plugins. Its only
cryptography:

- TLS/HTTPS via the OS (URLSession/WKWebView) — Apple-provided.
- Keychain/Data Protection via the OS — Apple-provided.
- No custom or third-party encryption algorithms are implemented or bundled.
  (Server-side crypto — Supabase auth, our AES-GCM token storage — runs on
  our servers, not in the app binary, and is irrelevant to export review.)

Under US EAR §740.17(b) and Apple's export guidance, apps limited to
Apple-OS-provided encryption for HTTPS/auth are **exempt** from the annual
self-classification report and the French declaration.

## What's already done in the repo

`ios/App/App/Info.plist`:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

This suppresses the per-build export-compliance questionnaire in App Store
Connect/TestFlight.

## If App Store Connect still asks

Answer: uses encryption → **only** standard encryption provided by Apple's
operating system → exempt. No documentation upload required. No France
declaration required (exempt apps are out of scope).

## Revisit only if

- A custom crypto library (libsodium, OpenSSL, a VPN/E2E feature) is ever
  bundled into the app binary → re-answer truthfully and file the annual
  self-classification report.
