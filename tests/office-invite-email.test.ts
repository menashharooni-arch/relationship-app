import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildInviteEmail } from "@/lib/office-invite-email";
import { senderFrom } from "@/lib/messaging";
import { htmlToText } from "@/lib/email-text";

// The office invite is the only mail SwiftCard sends to someone with no prior
// relationship to us, and it was the only send site that bypassed sendRawEmail.
// These assert the real built values — not that the source contains a pattern.

const BASE = "SwiftCard <hello@swiftcard.me>";

function invite(over: Partial<Parameters<typeof buildInviteEmail>[0]> = {}) {
  return buildInviteEmail({
    ownerFirst: "Dana",
    officeName: "Acme Realty",
    inviteeFirst: "Sam",
    inviteUrl: "https://swiftcard.me/join/tok123",
    ...over,
  });
}

describe("office invite email", () => {
  const prev = process.env.RESEND_FROM_EMAIL;
  beforeEach(() => { process.env.RESEND_FROM_EMAIL = BASE; });
  afterEach(() => {
    if (prev === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prev;
  });

  it("From names the inviter and the office on the verified address", () => {
    const from = senderFrom(invite().fromName);
    expect(from).toBe("Dana (Acme Realty) <hello@swiftcard.me>");
    // The bug this replaces: header said "SwiftCard", body said "Dana invited you".
    expect(from).not.toBe(BASE);
  });

  it("a hostile office name cannot break the From header", () => {
    const from = senderFrom('Dana <evil@x.com>\r\nBcc: leak@x.com (Acme)');
    expect(from).not.toMatch(/[\r\n]/);
    expect(from.match(/</g)!.length).toBe(1);
    expect(from.endsWith("<hello@swiftcard.me>")).toBe(true);
  });

  it("both unsubscribe links point at an endpoint that answers POST", () => {
    const url = "https://swiftcard.me/api/unsubscribe/contact?token=a.b";
    const { html } = invite({ unsubscribeUrl: url });
    const href = html.match(/href="(https:\/\/swiftcard\.me\/api\/unsubscribe[^"]*)"/)?.[1];
    expect(href).toBeTruthy();
    expect(new URL(href!).pathname).toBe("/api/unsubscribe/contact");
  });

  it("omits the unsubscribe block entirely when signing is unavailable", () => {
    const { html } = invite({ unsubscribeUrl: null });
    expect(html).not.toContain("Unsubscribe from SwiftCard emails");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("or unsubscribe below");
  });

  it("carries a sender-identity block and says how the address was obtained", () => {
    const { html } = invite();
    expect(html).toContain("on behalf of Acme Realty");
    expect(html).toContain("New York, NY");
    expect(html).toContain("added you to");
  });

  it("the derived text part keeps BOTH the accept link and the unsubscribe URL", () => {
    const url = "https://swiftcard.me/api/unsubscribe/contact?token=a.b";
    const text = htmlToText(invite({ unsubscribeUrl: url }).html);
    // Guards the parity that dropping the hand-maintained text body buys: the
    // two MIME parts are now derived from one source and cannot disagree.
    expect(text).toContain("/join/tok123");
    expect(text).toContain("/api/unsubscribe/contact");
  });

  it("an office name containing markup is escaped, not rendered", () => {
    const { html } = invite({ officeName: '<img src=x onerror=alert(1)>' });
    expect(html.includes("<img src=x")).toBe(false);
    expect(html.includes("&lt;img")).toBe(true);
  });

  it("prints the destination host as visible text", () => {
    expect(invite().html).toContain("This link goes to swiftcard.me");
  });

  it("falls back to a safe host label when the invite URL is unparseable", () => {
    expect(invite({ inviteUrl: "not-a-url" }).html).toContain("This link goes to swiftcard.me");
  });
});

// ── App Store badge (owner order 2026-09-02): the invite carries a download
// option for the sub-user — but ONLY once the app is actually listed. ─────────
describe("office invite App Store badge", () => {
  it("absent while the app is unpublished (no appStoreUrl)", () => {
    const html = invite().html;
    expect(html).not.toMatch(/App.Store/);
    expect(html).not.toMatch(/apps\.apple\.com/);
  });

  it("present, linked, and escaped once the listing URL exists", () => {
    const html = invite({ appStoreUrl: "https://apps.apple.com/app/id6798875872" }).html;
    expect(html).toContain('href="https://apps.apple.com/app/id6798875872"');
    expect(html).toContain("Download on the");
    expect(html).toMatch(/SwiftCard iPhone app/);
    // The route passes the module constant, wired for real:
    const route = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "src/app/api/office/invite/route.ts"), "utf8");
    expect(route).toMatch(/appStoreUrl: APP_STORE_URL/);
  });

  it("the welcome email rides the same switch (appStoreEmailBlock)", () => {
    const tpl = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "src/lib/email-templates.ts"), "utf8");
    expect(tpl).toMatch(/\$\{appStoreEmailBlock\(/);
    const lib = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "src/lib/app-store.ts"), "utf8");
    expect(lib).toMatch(/if \(!APP_STORE_URL\) return "";/);
  });
});
