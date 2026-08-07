// ── Apple .p8 private key normalization ──────────────────────────────────────
//
// APPLE_PUSH_PRIVATE_KEY and APPLE_SIGN_IN_PRIVATE_KEY hold the PEM text of an
// Apple auth key. `vercel env add < AuthKey_XXX.p8` stores real newlines and
// Node hands them back intact, so the happy path needs nothing.
//
// The unhappy path is the common one: paste the same key into the Vercel web
// UI (or any dashboard that escapes on the way in) and the value arrives as the
// four characters `\` `n` instead of a newline. `crypto.sign` then throws
// "error:1E08010C:DECODER routines::unsupported" — and both call sites treat a
// throw as a soft failure, so push and Apple token revocation would go quietly
// dead with nothing in the logs pointing at the key.
//
// One function, used by both, so the two can't drift.

/**
 * Turn whatever shape the environment handed us into PEM Node will parse.
 * Handles literal `\n` escapes, surrounding quotes (some dashboards keep them),
 * and CRLF. Returns the input untouched when it is already fine.
 */
export function normalizeApplePrivateKey(raw: string): string {
  let key = raw.trim();
  // Dashboards that quote the whole value.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  // The actual fix: escaped newlines back into real ones.
  key = key.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n/g, "\n");
  // PEM parsers want a trailing newline after the END line.
  return key.endsWith("\n") ? key : `${key}\n`;
}
