// Cheap, dependency-free check for whether Apple Wallet is set up. Kept separate
// from the heavy pass builder so server components can gate the "Add to Wallet"
// button without pulling in the signing library.
//
// To turn Apple Wallet ON, set these env vars (from your Apple Developer account):
//   APPLE_PASS_TYPE_ID   – your Pass Type ID, e.g. pass.me.swiftcard.card
//   APPLE_TEAM_ID        – your 10-char Apple Team ID
//   APPLE_PASS_CERT_PEM  – the Pass Type ID certificate, PEM text
//   APPLE_PASS_KEY_PEM   – its private key, PEM text
//   APPLE_PASS_KEY_PASSWORD – key passphrase (only if the key is encrypted)
//   APPLE_WWDR_PEM       – Apple's WWDR intermediate certificate, PEM text
export function hasWalletConfig(): boolean {
  return !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_CERT_PEM &&
    process.env.APPLE_PASS_KEY_PEM &&
    process.env.APPLE_WWDR_PEM
  );
}
