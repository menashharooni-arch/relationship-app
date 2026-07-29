import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { unsubUrl, marketingHeaders, welcomeEmail } from "@/lib/email-templates";

// unsubUrl() used to return /unsubscribe — a PAGE route. In Next 16 a urlencoded
// POST there is treated as a possible Server Action, skips the 405 branch, and is
// answered 200 by the static prerender without running any code. Every mailbox
// provider doing RFC 8058 one-click therefore recorded the opt-out as honored
// while the mail kept coming. These tests exist to stop that regressing.

describe("one-click unsubscribe URL", () => {
  it("targets a route handler, not the page", () => {
    // Parsed pathname, not toContain: "/api/unsubscribe?token=" would also
    // "contain" the old "/unsubscribe?token=" substring.
    expect(new URL(unsubUrl("tok")!).pathname).toBe("/api/unsubscribe");
  });

  it("URL-encodes the token", () => {
    expect(unsubUrl("a b+c/d")).toContain("a%20b%2Bc%2Fd");
  });

  it("yields no URL for a blank token, so no header is emitted", () => {
    expect(unsubUrl("")).toBeUndefined();
    expect(unsubUrl("   ")).toBeUndefined();
  });

  it("templates render the relationship line, never href=\"undefined\", with no token", () => {
    const { html } = welcomeEmail({
      firstName: "A",
      cardUrl: "https://swiftcard.me/card/a",
      unsubscribeUrl: unsubUrl(""),
    });
    expect(html).toContain("you have an account with SwiftCard");
    expect(html.includes("undefined")).toBe(false);
  });

  it("marketingHeaders emits both RFC 8058 headers, bracketed", () => {
    const h = marketingHeaders(unsubUrl("tok")!);
    expect(h["List-Unsubscribe"]).toBe("<https://swiftcard.me/api/unsubscribe?token=tok>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  // STRUCTURAL GUARD — deliberate exception to "assert behavior, not source".
  // Proving a POST is actually served would need a booted server; this is the one
  // assertion that catches a future author repointing the header at a page route.
  it("STRUCTURAL: the path unsubUrl points at is served by a route handler exporting POST", () => {
    const { pathname } = new URL(unsubUrl("t")!);
    const routeFile = join(process.cwd(), "src/app", pathname, "route.ts");
    expect(existsSync(routeFile)).toBe(true);
    expect(readFileSync(routeFile, "utf8")).toMatch(/export async function POST/);
  });
});
