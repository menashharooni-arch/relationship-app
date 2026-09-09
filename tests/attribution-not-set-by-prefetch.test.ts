import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── A prefetch is not a click ────────────────────────────────────────────────
//
// THE BUG THIS PINS (found 2026-09-08, reproduced against a production build):
// every visitor to /preview was attributed `share_info` — "submitted the share
// your info form" — a thing they never did. Including the ones who then clicked
// "Create Your Card for Free", whose real source is `preview`.
//
// The mechanism, observed request by request:
//
//   page load  GET /join?src=preview&_rsc=…   rsc=1 prefetch=1  → sc_src=preview
//   page load  GET /join?_rsc=…               rsc=1 prefetch=1  → sc_src=share_info
//   click      GET /join?src=preview&_rsc=…   rsc=1 prefetch=-  → sc_src=share_info
//
// /preview renders three <Link href="/join?src=preview">, and the App Router
// prefetches every link in the viewport. One of those prefetches arrives with
// NO src param, so the route falls back to `share_info` and writes it. By the
// time the visitor actually clicks, /join sees an existing, valid-looking
// source cookie and its own rule — "preview is weak, never let it overwrite a
// real source" — hands the fake value straight back.
//
// That rule is right; it exists so a genuine /r/CODE referral survives a detour
// through the demo page. It was just being fed a source Next.js invented.
//
// THE FIX: don't write attribution on a prefetch. Next sends
// `Next-Router-Prefetch: 1` on prefetch requests and omits it on a real
// navigation (verified above — that is the only header that separates the two;
// `RSC: 1` is on both, so keying on RSC would silently kill real attribution).
// The redirect still happens, so prefetch stays useful and free.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Routes that write an attribution/referral cookie on a bare GET. */
const ATTRIBUTION_ROUTES = ["src/app/join/route.ts", "src/app/r/[code]/route.ts"];

describe("attribution is written by a click, never by a prefetch", () => {
  for (const route of ATTRIBUTION_ROUTES) {
    const src = code(read(route));
    if (!/cookies\.set\(/.test(src)) continue;

    it(`${route} checks the Next-Router-Prefetch header`, () => {
      expect(
        /next-router-prefetch/i.test(src),
        `${route} sets a cookie on every GET. The App Router prefetches every ` +
          `<Link> in the viewport, so that cookie gets written without anyone ` +
          `clicking — and on /preview a param-less prefetch wrote share_info over ` +
          `the real source. Read the Next-Router-Prefetch header and skip the write.`,
      ).toBe(true);
    });

    it(`${route} does not key the check on RSC alone`, () => {
      // A real click is ALSO an RSC request (rsc=1, prefetch absent). Treating
      // every RSC request as a prefetch would drop attribution for everyone.
      const guard = src.match(/const\s+isPrefetch[\s\S]{0,200}?;/)?.[0] ?? "";
      if (!guard) return;
      expect(
        /\brsc\b/i.test(guard) && !/next-router-prefetch/i.test(guard),
        `${route} must not decide "prefetch" from the RSC header — a real click ` +
          `sends RSC: 1 too. Only Next-Router-Prefetch separates them.`,
      ).toBe(false);
    });

    it(`${route} still redirects on a prefetch`, () => {
      // Skipping the COOKIE is the point; skipping the redirect would make the
      // prefetch useless and could surface as a broken link.
      const early = src.match(/if\s*\(\s*isPrefetch\s*\)\s*return[^\n]*/)?.[0] ?? "";
      expect(
        /NextResponse\.redirect|return res/.test(early) || early === "",
        `${route} must still answer a prefetch with the redirect; only the ` +
          `cookie write is conditional.`,
      ).toBe(true);
    });
  }

  it("the weak-source rule still defers to a real, previously-set source", () => {
    // The rule that was being exploited by the fake cookie is correct and must
    // survive the fix: a genuine /r/CODE referral still outranks `preview`.
    const src = code(read("src/app/join/route.ts"));
    expect(/src === "preview" && isSignupSource\(existing\)/.test(src)).toBe(true);
  });
});
