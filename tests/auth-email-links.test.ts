import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextFromConfirmUrl } from "@/lib/auth-confirm";
// @ts-expect-error — plain .mjs shared with scripts/supabase-auth-emails.mjs
import { AUTH_EMAILS, SENDER_NAME, SITE } from "../supabase/auth-email-templates.mjs";

// ── SwiftCard's auth emails link to swiftcard.me, never supabase.co ──────────
// Supabase's default templates sent "Your sign-in link" with no SwiftCard name
// and a grxmovpmlgmjncnyiyrt.supabase.co button (2026-09-22 review). The links
// now go to /auth/confirm, which verifies the token hash server-side.

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const inner = "https://swiftcard.me/auth/callback?next=" + encodeURIComponent("/cards/new?plan=office&interval=monthly&seats=5&claim=1");
const confirm = (tail: string) => new URL("https://swiftcard.me/auth/confirm?token_hash=pkce_abc&type=email&redirect_to=" + tail);

describe("where an emailed link was going (lib/auth-confirm)", () => {
  it("reads next when Supabase percent-encodes {{ .RedirectTo }}", () => {
    expect(nextFromConfirmUrl(confirm(encodeURIComponent(inner)))).toBe("/cards/new?plan=office&interval=monthly&seats=5&claim=1");
  });

  it("reads next when Supabase leaves {{ .RedirectTo }} as it was — without decoding it twice", () => {
    // The trap: an ordinary query parse decodes the inner %26 into & and cuts
    // next off at "/cards/new?plan=office".
    expect(nextFromConfirmUrl(confirm(inner))).toBe("/cards/new?plan=office&interval=monthly&seats=5&claim=1");
  });

  it("survives Next.js re-serialising the query (the inner next arrives already decoded)", () => {
    // What a production build actually handed the route for the raw case.
    const normalized = encodeURIComponent("https://swiftcard.me/auth/callback?next=/cards/new?plan=office&interval=monthly&seats=5&claim=1");
    expect(nextFromConfirmUrl(confirm(normalized))).toBe("/cards/new?plan=office&interval=monthly&seats=5&claim=1");
    // …and an OAuth-style intent on the callback is not part of next.
    const withIntent = encodeURIComponent("https://swiftcard.me/auth/callback?next=%2Fwelcome%3Ftier%3Doffice&intent=signin");
    expect(nextFromConfirmUrl(confirm(withIntent))).toBe("/welcome?tier=office");
  });

  it("a team invite's sign-in link returns to its /join page", () => {
    const join = "https://swiftcard.me/auth/callback?next=" + encodeURIComponent("/join/2034f34e-80b3");
    expect(nextFromConfirmUrl(confirm(encodeURIComponent(join)))).toBe("/join/2034f34e-80b3");
    expect(nextFromConfirmUrl(confirm(join))).toBe("/join/2034f34e-80b3");
  });

  it("the Site URL fallback and a bare callback mean 'no next'", () => {
    expect(nextFromConfirmUrl(confirm("https://swiftcard.me"))).toBeNull();
    expect(nextFromConfirmUrl(confirm(encodeURIComponent("https://swiftcard.me/")))).toBeNull();
    expect(nextFromConfirmUrl(confirm("https://swiftcard.me/auth/callback"))).toBeNull();
  });

  it("never follows another site, or an unsafe path", () => {
    expect(nextFromConfirmUrl(confirm(encodeURIComponent("https://evil.com/auth/callback?next=%2Fdashboard")))).toBeNull();
    expect(nextFromConfirmUrl(confirm("https://evil.com/dashboard"))).toBeNull();
    expect(nextFromConfirmUrl(confirm(encodeURIComponent("https://swiftcard.me/auth/callback?next=" + encodeURIComponent("//evil.com"))))).toBeNull();
    expect(nextFromConfirmUrl(new URL("https://swiftcard.me/auth/confirm?token_hash=x&type=email&next=https://evil.com"))).toBeNull();
  });

  it("the team invite's own sign-in link (api/join/sign-in-link) keeps its /join next", () => {
    const u = new URL(`https://swiftcard.me/auth/confirm?token_hash=abc&type=magiclink&next=${encodeURIComponent("/join/2034f34e-80b3")}`);
    expect(nextFromConfirmUrl(u)).toBe("/join/2034f34e-80b3");
    expect(code("src/app/auth/confirm/route.ts")).toMatch(/"signup", "magiclink"/);
  });

  it("no redirect_to at all → null; a plain next → that path", () => {
    expect(nextFromConfirmUrl(new URL("https://swiftcard.me/auth/confirm?token_hash=x&type=email"))).toBeNull();
    expect(nextFromConfirmUrl(new URL("https://swiftcard.me/auth/confirm?token_hash=x&type=email&next=%2Fdashboard"))).toBe("/dashboard");
  });
});

describe("the templates (supabase/auth-email-templates.mjs)", () => {
  const all = Object.entries(AUTH_EMAILS as Record<string, { subject: string; content: string }>);

  it("covers every email SwiftCard's auth can send", () => {
    expect(Object.keys(AUTH_EMAILS).sort()).toEqual(["confirmation", "email_change", "invite", "magic_link", "recovery"]);
    expect(SITE).toBe("https://swiftcard.me");
    expect(SENDER_NAME).toBe("SwiftCard");
  });

  for (const [key, t] of all) {
    it(`${key}: SwiftCard-branded, and every link is on swiftcard.me`, () => {
      expect(t.subject).toContain("SwiftCard");
      expect(t.content).toContain(">SwiftCard</span>");
      expect(t.content).not.toContain("ConfirmationURL");
      expect(t.content).not.toMatch(/supabase\.co/i);
      expect(t.content).not.toContain("{{ .SiteURL }}");
      const hrefs = [...t.content.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      expect(hrefs.length).toBe(1);
      for (const h of hrefs) expect(h.startsWith("https://swiftcard.me/auth/")).toBe(true);
      expect(t.content).toContain("This link goes to swiftcard.me");
    });
  }

  it("confirm links carry the token hash and end with redirect_to", () => {
    for (const key of ["confirmation", "magic_link", "email_change", "invite"]) {
      const href = /href="([^"]+)"/.exec(AUTH_EMAILS[key].content)![1];
      expect(href.startsWith("https://swiftcard.me/auth/confirm?token_hash={{ .TokenHash }}&amp;type=")).toBe(true);
      expect(href.endsWith("&amp;redirect_to={{ .RedirectTo }}")).toBe(true);
    }
    // Supabase's documented type for sign-up confirmation and magic links.
    expect(AUTH_EMAILS.confirmation.content).toContain("type=email&amp;");
    expect(AUTH_EMAILS.magic_link.content).toContain("type=email&amp;");
    expect(AUTH_EMAILS.email_change.content).toContain("type=email_change&amp;");
  });

  it("the reset link goes to the page that verifies its own token hash", () => {
    const href = /href="([^"]+)"/.exec(AUTH_EMAILS.recovery.content)![1];
    expect(href).toBe("https://swiftcard.me/auth/reset-password?token_hash={{ .TokenHash }}&amp;type=recovery");
    expect(code("src/components/ResetPasswordForm.tsx")).toContain("verifyOtp({");
  });
});

describe("/auth/confirm and /auth/callback land a person the same way", () => {
  const confirmRoute = code("src/app/auth/confirm/route.ts");
  const callbackRoute = code("src/app/auth/callback/route.ts");

  it("confirm verifies the hash, and a failed verify never reaches the landing", () => {
    expect(confirmRoute).toContain("supabase.auth.verifyOtp({ token_hash: tokenHash, type })");
    const verifyAt = confirmRoute.indexOf("verifyOtp(");
    const failAt = confirmRoute.indexOf("return authFailedRedirect(origin, next);", verifyAt);
    const landAt = confirmRoute.indexOf("return landAfterAuth(");
    expect(failAt).toBeGreaterThan(verifyAt);
    expect(landAt).toBeGreaterThan(failAt);
  });

  it("a recovery link is handed to /auth/reset-password", () => {
    expect(confirmRoute).toMatch(/if \(type === "recovery"\)[\s\S]*?\/auth\/reset-password/);
  });

  it("both routes use the one shared landing (lib/auth-landing)", () => {
    for (const r of [confirmRoute, callbackRoute]) {
      expect(r).toContain('from "@/lib/auth-landing"');
      expect(r).toContain("landAfterAuth(supabase");
      expect(r).toContain("authFailedRedirect(origin, next)");
    }
    const landing = code("src/lib/auth-landing.ts");
    expect(landing).toContain('new URL("/account-deleted", origin)');
    expect(landing).toContain('new URL("/onboarding", origin)');
    expect(landing).toContain("?link=expired");
  });

  it("/auth/confirm is not behind the login wall", () => {
    const proxy = code("src/proxy.ts");
    const list = /const protectedPaths = \[([^\]]*)\]/.exec(proxy)![1];
    expect(list).not.toContain('"/auth');
  });
});

describe("admin-created accounts get a swiftcard.me setup link", () => {
  it("built from the hashed token, to the page that exists", () => {
    const r = code("src/app/api/admin/create-card/route.ts");
    expect(r).toContain("${APP_URL}/auth/reset-password?token_hash=${encodeURIComponent(hashed)}&type=recovery");
    expect(r).not.toContain("${APP_URL}/reset-password`");
  });
});
