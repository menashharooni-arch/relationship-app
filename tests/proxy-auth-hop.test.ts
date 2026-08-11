import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── The proxy's auth check, and why it is getClaims ──────────────────────────
//
// proxy() runs on EVERY navigation to a portal route, plus every prefetch of
// one. getUser() is a network call to Supabase's auth server, so that was
// 200–600ms of dead time on cellular before any page code ran — underneath
// every loading skeleton, delaying the one thing that makes a tap feel
// answered. getClaims() verifies the JWT locally against the project's JWKS.
//
// Three properties make that swap safe, and each fails SILENTLY if undone:
// session refresh still happening, the project actually using asymmetric keys,
// and the pages still doing their own full check. This pins them.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const proxy = () => read("src/proxy.ts");
/** Source minus comments — the comments necessarily discuss getUser(). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the proxy does not make a network call to check auth", () => {
  it("uses getClaims, not getUser", () => {
    const src = code(proxy());
    expect(src).toMatch(/supabase\.auth\.getClaims\(\)/);
    expect(src, "getUser() in the proxy is a per-navigation network round trip").not.toMatch(
      /supabase\.auth\.getUser\(/,
    );
  });

  it("reads the user id from the required `sub` claim", () => {
    // sub is a REQUIRED claim on a Supabase access token, so its absence is the
    // same signal `user === null` used to be. Reading the wrong path here would
    // make userId permanently null — i.e. sign everyone out — while still
    // compiling and still passing a naive "is getClaims used" check.
    const src = code(proxy());
    expect(src).toMatch(/claimsResult\?\.claims\?\.sub \?\? null/);
  });

  it("still gates on that id everywhere it used to gate on the user", () => {
    const src = code(proxy());
    expect(src, "login wall").toMatch(/if \(!userId && isProtected/);
    expect(src, "soft-delete guard").toMatch(/if \(userId && isProtected\)/);
    expect(src, "soft-delete lookup").toMatch(/\.eq\("id", userId\)/);
    expect(src, "shell landing branch").toMatch(/userId \? "\/dashboard" : "\/login"/);
  });

  it("keeps carrying rotated auth cookies onto every redirect", () => {
    // getClaims() calls getSession(), which REFRESHES an expired session and
    // writes new cookies through the setAll handler. A bare
    // NextResponse.redirect() would drop them and desync the browser session —
    // the reason this helper exists at all.
    const src = code(proxy());
    expect(src).toMatch(/function redirectWithAuthCookies/);
    expect(src).not.toMatch(/return NextResponse\.redirect\(new URL/);
  });
});

describe("the guarantees that make local verification acceptable", () => {
  it("the soft-delete check is still enforced in the proxy", () => {
    // Local verification proves the token is signed and unexpired; it does not
    // re-check the user server-side. This DB guard is what still catches an
    // account soft-deleted mid-session, so it must not be dropped as "slow".
    const src = code(proxy());
    expect(src).toMatch(/_deleted/);
    expect(src).toMatch(/account-deleted/);
  });

  it("protected pages still do their own full getUser check", () => {
    // The proxy is a fast pre-filter, not the only gate. Every one of these
    // validates server-side, which is what catches a hard-deleted account
    // inside the access token's remaining lifetime.
    for (const page of [
      "src/app/dashboard/page.tsx",
      "src/app/contacts/page.tsx",
      "src/app/share/page.tsx",
      "src/app/settings/flows/page.tsx",
    ]) {
      expect(read(page), `${page} relies on the proxy alone`).toMatch(/auth\.getUser\(\)/);
    }
  });
});
