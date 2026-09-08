import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// The Resend SDK RESOLVES with {data, error} on an API rejection — it does not
// throw. Every site that ignored the return value reported success for mail
// that never left: the contact form answered {success:true}, receipts and
// trial mail wrote email_logs rows claiming a send, and sendRawEmail reduced
// the reason to a bare "failed". These pin that each site reads the error and
// reports it (audit 2026-09-08).
describe("a rejected email send is never silent", () => {
  it("sendRawEmail reports the rejection reason, not just 'failed'", () => {
    const s = code("src/lib/messaging.ts");
    expect(s).toMatch(/reportError\("email\.send", error\.message/);
    expect(s).toMatch(/catch \(e\) \{\s*await reportError\("email\.send", e/);
  });

  it("the contact form answers 500 when Resend rejects the message", () => {
    const s = code("src/app/api/contact/route.ts");
    expect(s).toMatch(/const \{ error \} = await resend\.emails\.send\(/);
    expect(s).toMatch(/reportError\("contact\.send"/);
    expect(s).toMatch(/if \(error\) \{[\s\S]*status: 500/);
  });

  it("receipts and dunning log only what actually went out", () => {
    const s = code("src/app/api/stripe/webhook/route.ts");
    expect(s).toMatch(/reportError\("billing\.email\.receipt"/);
    expect(s).toMatch(/reportError\("billing\.email\.payment_failed"/);
    // No email_logs insert may use a possibly-null id any more.
    expect(s).not.toMatch(/resend_id: sent\?\.id/);
  });

  it("trial lifecycle mail logs only what actually went out", () => {
    const s = code("src/app/api/reminders/route.ts");
    expect(s).toMatch(/reportError\("reminders\.trial-ended\.email"/);
    expect(s).toMatch(/reportError\("reminders\.trial-ending-soon\.email"/);
    expect(s).not.toMatch(/resend_id: sent\?\.id/);
  });

  it(".env.example documents every email variable the code reads", () => {
    const env = code(".env.example");
    for (const v of ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "UNSUBSCRIBE_MAILTO", "EMAIL_DAILY_SEND_CAP", "ALERT_WEBHOOK_URL"]) {
      expect(env, v).toMatch(new RegExp(`^${v}=`, "m"));
    }
  });
});
