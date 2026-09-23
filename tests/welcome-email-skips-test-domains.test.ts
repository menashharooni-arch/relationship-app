import { describe, it, expect, vi } from "vitest";

// ── No mail to an address that cannot receive it ─────────────────────────────
//
// 2026-09-23 audit: 1,081 welcome emails in email_logs were addressed to the
// QA harness's `*@swiftcard-test.invalid` accounts, 1,008 of them with a Resend
// id — really sent, really bounced, every one a mark against swiftcard.me's
// sender reputation. `.invalid` is reserved (RFC 2606) so it can never resolve.
//
// The welcome sender now asks lib/test-mailbox.ts first, before it touches the
// database or the mail provider.

const sent: unknown[] = [];
let dbTouched = 0;

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    from: () => { dbTouched++; throw new Error("the database must not be consulted for a test mailbox"); },
  }),
}));
vi.mock("@/lib/email-prefs", () => ({ ensureEmailPreferences: async () => {} }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (msg: unknown) => { sent.push(msg); return { data: { id: "re_x" }, error: null }; } };
  },
}));

import { isTestMailbox, QA_MAIL_DOMAIN } from "@/lib/test-mailbox";
import { sendWelcomeEmail } from "@/lib/welcome-email";

describe("isTestMailbox", () => {
  it("recognises the QA domain and the RFC 2606 reserved names", () => {
    for (const e of [
      `qa-flows-123@${QA_MAIL_DOMAIN}`,
      `QA-Probe@${QA_MAIL_DOMAIN.toUpperCase()}`,
      "someone@anything.invalid",
      "someone@example.test",
      "someone@foo.example",
      "someone@localhost",
    ]) expect(isTestMailbox(e), e).toBe(true);
  });
  it("leaves real addresses alone, including unusual but real domains", () => {
    for (const e of [
      "aaron@malvecapital.com",
      "hello@swiftcard.me",
      "person@example.com",       // example.com is a REAL, reservable-looking but routable domain
      "person@invalid-corp.com",  // "invalid" inside the name is not the TLD
      "person@test.co.uk",
      "",
      null,
      undefined,
    ]) expect(isTestMailbox(e), String(e)).toBe(false);
  });
});

describe("sendWelcomeEmail with a test mailbox", () => {
  it("returns skipped and touches neither the database nor Resend", async () => {
    expect(await sendWelcomeEmail("u-qa", `qa-sweep-1@${QA_MAIL_DOMAIN}`)).toBe("skipped");
    expect(dbTouched).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
