import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    // support@ — a team invitation is the platform writing to a stranger on a
    // customer's behalf. The route passes sender:"support" (api/office/invite).
    const from = senderFrom(invite().fromName, "support");
    expect(from).toBe("Dana (Acme Realty) via SwiftCard <support@swiftcard.me>");
    // The bug this replaces: header said "SwiftCard", body said "Dana invited you".
    expect(from).not.toBe(BASE);
  });

  it("a hostile office name cannot break the From header", () => {
    const from = senderFrom('Dana <evil@x.com>\r\nBcc: leak@x.com (Acme)', "support");
    expect(from).not.toMatch(/[\r\n]/);
    expect(from.match(/</g)!.length).toBe(1);
    expect(from.endsWith("<support@swiftcard.me>")).toBe(true);
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

  // Unknown inviter name / unknown company: the old stand-in strings were read
  // as words in the sentence — "A invited you…", "create your your new team
  // digital business card", "added you to the your new team team".
  it("an inviter with no name on file is never a fragment like 'A'", () => {
    const e = invite({ ownerFirst: null });
    expect(e.subject).toBe("You're invited to create your Acme Realty digital business card");
    expect(e.html).toContain("You've been added to the <strong>Acme Realty</strong> team on SwiftCard");
    expect(e.html).toContain("because a team admin entered your email address");
    expect(e.fromName).toBe("Acme Realty");
  });

  it("an office with no company name reads as a sentence, not a placeholder", () => {
    const e = invite({ officeName: null });
    expect(e.subject).toBe("Dana invited you to create your company digital business card");
    expect(e.html).toContain("Dana added you to their team on SwiftCard");
    expect(e.html).not.toMatch(/your new team|My Office|the\s+team/);
    expect(e.html).toContain("Sent by SwiftCard · New York, NY");
    expect(e.fromName).toBe("Dana");
  });

  it("neither known: plain SwiftCard From, still a real sentence", () => {
    const e = invite({ ownerFirst: null, officeName: null });
    expect(e.subject).toBe("You're invited to create your company digital business card");
    expect(e.html).toContain("You've been added to a team on SwiftCard");
    expect(senderFrom(e.fromName, "support")).toBe("SwiftCard <support@swiftcard.me>");
  });

  it("a company already named '… Team' doesn't get a second 'team'", () => {
    expect(invite({ officeName: "Sales Team" }).html).toContain("the <strong>Sales Team</strong> on SwiftCard");
  });

  it("tells Apple users to share their email so the app can find the invite", () => {
    expect(invite().html).toContain("Choose <strong>Share My Email</strong>");
  });
});

// ── App Store badge: added to the invite on 2026-09-02, removed again on
// 2026-09-06 — the invite has exactly one door. ──────────────────────────────
describe("office invite App Store badge", () => {
  // 2026-09-06 the app was kept OUT of the invite: installing first and
  // signing in with Google stranded people in a personal Free account with the
  // invite still pending. Owner, 2026-09-16: "when the subuser gets the email
  // ... they just download the app and then they log in with the same email".
  // That path now works (onboarding, the dashboard and /welcome all route a
  // pending invite to Join), so the invite names the app and the address to use.
  it("tells the invitee they can use the app with their invited address", () => {
    const html = buildInviteEmail({ ownerFirst: "Ada", officeName: "Acme", inviteUrl: "https://swiftcard.me/join/tok123", inviteEmail: "sam@acme.com" }).html;
    expect(html).toContain("Get the <strong>SwiftCard</strong> app from the App Store and create your account with <strong>sam@acme.com</strong>");
    // Still one button: the claim link. No store badge competing with it.
    expect(html).not.toContain("apps.apple.com");
  });

  it("the paths that make the app door safe are in place", () => {
    const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    expect(read("src/app/onboarding/page.tsx")).toContain('intent === "signin" && !(await findPendingInviteForEmail(user.email, user.id))');
    expect(read("src/app/welcome/page.tsx")).toContain("if (invite) redirect(`/join/${encodeURIComponent(invite.token)}`)");
    expect(read("src/components/JoinSignIn.tsx")).toContain("if (native) {");
    expect(read("src/components/JoinButton.tsx")).toContain("/cards/${json.firstCardId}/edit?joined=1");
  });

  it("the welcome email rides the same switch (appStoreEmailBlock)", () => {
    const tpl = readFileSync(join(process.cwd(), "src/lib/email-templates.ts"), "utf8");
    expect(tpl).toMatch(/\$\{appStoreEmailBlock\(/);
    const lib = readFileSync(join(process.cwd(), "src/lib/app-store.ts"), "utf8");
    expect(lib).toMatch(/if \(!APP_STORE_URL\) return "";/);
  });
});
