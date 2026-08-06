// ── The one same-origin guard for `?next=` ───────────────────────────────────
//
// `next` arrives from the query string (app/login/page.tsx reads it straight
// out of searchParams and passes it to LoginForm; auth/callback reads it off
// the request URL), so it is ATTACKER-CONTROLLED and must never reach a
// navigation unchecked.
//
// This lives in one file because the duplicated-inline version is what caused
// the bug: the check was written by hand in four places, missed entirely in the
// password sign-in path, and the three that had it shared a hole. A link to the
// REAL SwiftCard login form then became a credential-phishing hop — the victim
// types real credentials on the real site and is handed to the attacker's page
// immediately after a SUCCESSFUL sign-in, which is the convincing version.
//
// Rejected, and why each matters:
//   "https://evil.com"  absolute — obvious.
//   "//evil.com"        protocol-relative; new URL("//evil.com", origin)
//                       resolves to https://evil.com/.
//   "/\evil.com"        also protocol-relative. Browsers and the WHATWG URL
//                       parser normalise a backslash to a forward slash for
//                       special schemes, so this escapes a naive "//" check.
//                       Verified: new URL("/\\evil.com", "https://swiftcard.me")
//                       === "https://evil.com/". This is the one the old
//                       hand-written guards let through.
//
// Returns the path unchanged when safe, or null — callers fall back to their
// own default destination.
export function safeNextPath(next?: string | null): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
