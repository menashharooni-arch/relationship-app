# NFC & "tap to share" — capability verdict

Honest summary of what NFC can and cannot do for SwiftCard, so we never promise a
tap-to-share experience the platform blocks.

## TL;DR

| Surface | Can SwiftCard use NFC? | How |
|---|---|---|
| **Physical NFC tag/card** (sticker, PVC card, keychain) | **Yes** | The tag stores the card URL. Any phone tap opens the card — no app needed by the recipient. This already works and is the recommended path. |
| **Android phone (Chrome) writing a tag** | **Yes** | Web NFC (`NDEFReader`) writes the URL to a blank tag from the browser. Implemented in `src/components/NFCWriter.tsx`. |
| **iPhone writing a tag from the browser** | **No** | Safari/iOS has **no Web NFC**. Users write the tag with a free app (e.g. "NFC Tools") using the copyable link — the component already falls back to this. |
| **iPhone *emulating* a tag / tap-to-share from the app** | **No (for us)** | Host Card Emulation for arbitrary data isn't open to third parties; iPhone NFC tag *reading* needs a native app with the Core NFC entitlement — not a website. |
| **Apple Watch NFC (read or write) for third parties** | **No** | Core NFC is **not available on watchOS**. Watch NFC is reserved for Apple Pay, Transit, Home/Car/Student/Gym keys. Tag writing is **not supported** on Apple Watch, and there is no public NFC SDK for it. |

## What's technically possible

- **Passive NFC tags carrying the card URL.** This is the whole product need and
  it works on every modern phone: encode `https://swiftcard.me/card/<username>`
  onto an NDEF tag; a tap opens the card in the recipient's browser. No app, no
  approval, no entitlement.
- **Writing tags on Android Chrome via Web NFC** — already built.
- **Manual tag writing everywhere else** (iPhone/desktop) via a third-party NFC
  app and the copyable link — already the fallback in `NFCWriter.tsx`.

## What requires a native app (NOT possible from this website)

- **iPhone reading/writing NFC in-app**: requires a native iOS app using
  **Core NFC** with the `com.apple.developer.nfc.readersession.formats`
  entitlement, an Apple Developer membership, and provisioning. A website cannot
  access Core NFC.
- **Contactless payment-style "tap"** (HCE / Secure Element): on iPhone this now
  needs the NFC & Secure Enclave entitlement (iOS 18.1+), a signed commercial
  agreement with Apple, and fees — and it's for payment credentials, not sharing
  a business-card URL. Not applicable to SwiftCard.

## What CANNOT be done at all (platform-blocked)

- **Apple Watch NFC for a third-party app.** No Core NFC on watchOS, no tag
  writing, no tap-to-share. The Watch's NFC is locked to Apple's own Wallet
  credentials. The only Watch presence SwiftCard can have is the **Apple Wallet
  pass** (see `docs/APPLE_WATCH.md`), which shows the card + QR — recipients scan
  the QR; there is no NFC tap from the Watch.

## Recommendation on `src/components/NFCWriter.tsx`

The component is currently **unwired** (not rendered anywhere — confirmed by grep;
it only appears in its own file). It is correct and fail-safe:

- On **Android Chrome** it writes the tag directly.
- On **iPhone / unsupported browsers** it detects the lack of `NDEFReader`,
  explains the limitation, and offers the copyable link for a manual NFC app.

**Recommendation: surface it** on the card's share/QR screen (owned by
`card-editor` / dashboard), passing the card URL as `url`. It degrades gracefully
everywhere and adds a real "buy a tag, write it once, tap to share" path that
matches the physical-card use case. Because it's a client component with an
internal capability check, there is **no server config and nothing to fail** when
NFC isn't available — it just shows the manual fallback. Wiring it in is a
one-line mount for the owning agent; this doc is the go-ahead + rationale.

## Sources
- Core NFC is iPhone-only; **not available on Apple Watch** — Apple Developer
  Forums ("Core NFC on watchOS?", "Apple Watch NFC Tags").
- Apple Watch NFC limited to Apple Pay / Wallet credentials; tag writing not
  supported; no public NFC SDK — GoToTags Core NFC overview.
- iPhone third-party NFC payments (iOS 18.1) require the NFC & Secure Enclave
  entitlement + commercial agreement — MacRumors, "Apple is Opening Up the
  iPhone's NFC Chip."
