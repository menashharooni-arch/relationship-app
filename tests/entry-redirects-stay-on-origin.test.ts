import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The two entry links must land you on the site you came from ──────────────
//
// THE BUG THIS PINS (found 2026-09-08, reproduced against a production build):
//
//   GET http://localhost:3222/join?src=save_contact
//     → location: https://swiftcard.me/cards/new
//   GET http://localhost:3222/r/ABC123
//     → location: https://swiftcard.me/login?mode=signup
//
// Both routes built their destination from
// `process.env.NEXT_PUBLIC_APP_URL || "https://swiftcard.me"` — a build-time
// constant — instead of the request they were answering. On production those
// are the same string, so production was fine. Everywhere else they are not:
//
//  1. Every Vercel preview deploy and every dev box threw the visitor onto
//     production the moment they used a "Make your own card" CTA. The one
//     funnel you most want to exercise before shipping could not be exercised
//     anywhere but live.
//
//  2. Worse, and silently: both routes SET COOKIES on the response
//     (SRC_COOKIE for attribution, REF_COOKIE for the referral code) and then
//     sent the browser to a different origin, which never sees them. /join's
//     own comment promised "the source cookie is set either way, so
//     attribution survives the detour" — off-origin, it does not.
//
// THE FIX: `new URL(path, req.url)` — the pattern src/proxy.ts,
// src/app/auth/callback/route.ts and the unsubscribe routes already use.
// Identical on production, correct everywhere else.
//
// NOT banned globally: the OAuth integration routes legitimately need an
// absolute APP_URL, because the provider redirects back to a registered
// absolute redirect_uri. This test names only the first-party entry routes.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** First-party entry points: our own URL in, our own URL out, cookies on the way. */
const ENTRY_ROUTES = ["src/app/join/route.ts", "src/app/r/[code]/route.ts"];

describe("entry redirects stay on the origin the visitor arrived at", () => {
  for (const route of ENTRY_ROUTES) {
    it(`${route} names no build-time absolute URL at all`, () => {
      // Asserted on the whole file, not just the redirect argument: /join
      // assembled its destination into a `dest` variable first, so a check that
      // only read `NextResponse.redirect(...)` saw the variable name and passed
      // while the bug sat two lines above it.
      const src = code(read(route));
      const hit = src.match(/APP_URL|https:\/\/swiftcard\.me/);
      expect(
        hit,
        `${route} builds a destination from a build-time constant (${hit?.[0]}). ` +
          `On a preview deploy or a dev box that throws the visitor onto production and ` +
          `drops the cookies this route just set. Use new URL(path, req.url).`,
      ).toBeNull();
    });

    it(`${route} builds its destination from the incoming request`, () => {
      const src = code(read(route));
      expect(
        /new URL\([^)]*req(uest)?\.url\s*\)/.test(src),
        `${route} must resolve its destination against the request it is answering ` +
          `(new URL(path, req.url)), the way proxy.ts and auth/callback already do.`,
      ).toBe(true);
    });
  }

  it("an entry route that sets a cookie never sends the browser to another origin", () => {
    // The two facts have to hold together: a Set-Cookie is scoped to the
    // responding origin, so a cross-origin redirect on the same response
    // throws the cookie away. This is the invariant that actually broke.
    for (const route of ENTRY_ROUTES) {
      const src = code(read(route));
      if (!/res\.cookies\.set\(/.test(src)) continue;
      expect(
        /APP_URL|https:\/\/swiftcard\.me/.test(src.slice(src.indexOf("NextResponse.redirect("))),
        `${route} sets a cookie and redirects — the redirect must stay on this origin ` +
          `or the cookie is discarded before anything can read it.`,
      ).toBe(false);
    }
  });
});
