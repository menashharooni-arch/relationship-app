import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeNextPath } from "@/lib/safe-next";

// OPEN REDIRECT GUARD.
//
// `?next=` is read from the query string and handed to a navigation. Before
// this it was checked by four hand-written copies of the same expression: the
// password sign-in path had none at all (it navigated to the raw value), and
// the three that had one shared a hole.
//
// The attack is convincing precisely because nothing looks wrong: the victim
// follows a link to the GENUINE SwiftCard login form, types real credentials
// into the real site, signs in successfully — and is then dropped on the
// attacker's page, which can ask for anything.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("safeNextPath", () => {
  it("allows ordinary same-origin paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/join/abc123")).toBe("/join/abc123");
    expect(safeNextPath("/cards/new?add=1")).toBe("/cards/new?add=1");
  });

  it("blocks absolute URLs", () => {
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("http://evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("blocks protocol-relative //evil.com", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
  });

  it("blocks the BACKSLASH form, which the old guards let through", () => {
    // The regression that mattered. Browsers and the WHATWG URL parser
    // normalise "\" to "/" for special schemes, so "/\evil.com" is
    // protocol-relative even though it passes a naive startsWith("//") check.
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/\\\\evil.com")).toBeNull();
  });

  it("resolves nothing off-origin — the property that actually matters", () => {
    // Asserting the OUTCOME, not the rule: whatever survives the guard must
    // still be on our origin once resolved the way the callback resolves it.
    const origin = "https://swiftcard.me";
    for (const probe of [
      "/dashboard", "//evil.com", "/\\evil.com", "https://evil.com",
      "/\\/evil.com", "////evil.com", "/legit/path",
    ]) {
      const safe = safeNextPath(probe);
      if (safe === null) continue;
      expect(new URL(safe, origin).origin, `"${probe}" escaped the origin`).toBe(origin);
    }
  });

  it("treats empty and missing input as no redirect", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("every consumer uses the shared guard", () => {
  // The bug was duplication, so this pins that the duplicates are gone. A new
  // hand-written check is how this comes back.
  const CONSUMERS = ["src/components/LoginForm.tsx", "src/app/auth/callback/route.ts"];

  it.each(CONSUMERS)("%s imports safeNextPath", (f) => {
    expect(read(f)).toMatch(/from "@\/lib\/safe-next"/);
  });

  it.each(CONSUMERS)("%s has no hand-rolled startsWith guard left", (f) => {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code, `${f} still hand-rolls the next check`).not.toMatch(
      /startsWith\("\/"\)\s*&&\s*!.*startsWith\("\/\/"\)/,
    );
  });

  it("the password sign-in path does not navigate to a raw redirectTo", () => {
    // The exact line that shipped the hole.
    const code = read("src/components/LoginForm.tsx");
    expect(code).not.toMatch(/location\.href\s*=\s*redirectTo\s*\?\?/);
    expect(code).toMatch(/location\.href\s*=\s*safeNextPath\(redirectTo\)\s*\?\?/);
  });
});
