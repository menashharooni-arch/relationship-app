import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Personal mail must not announce itself as a mailing list ─────────────────
//
// Reported from the field: a card shared by email from the Share button landed
// in the recipient's Gmail PROMOTIONS tab instead of the primary inbox.
//
// The cause was not copy or images. Every send went through sendRawEmail /
// sendBrandedEmail, and both attached List-Unsubscribe + List-Unsubscribe-Post
// unconditionally. List-Unsubscribe is the header that DEFINES a mailing list,
// and Gmail reads it as a primary Promotions signal — so a message one person
// typed and sent to one other person was telling Gmail it was bulk mail.
//
// The rule these tests pin is by WHO PRESSED SEND:
//   • a human, just now            → personal: true, no list headers
//   • a scheduler / cron / sequence → headers stay, unchanged
//
// Both directions matter. Dropping the headers from automated mail would be a
// real compliance regression, and putting them back on personal mail would
// silently reintroduce the Promotions bug with no visible symptom in the app.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const messaging = () => read("src/lib/messaging.ts");

describe("the sender decides headers by who pressed send", () => {
  it("both senders branch on the personal flag rather than always attaching", () => {
    const src = messaging();
    const branches = src.match(/headers: opts\.personal \? personalHeaders\(\) : unsubHeaders\(opts\.to\)/g);
    expect(branches, "sendRawEmail and sendBrandedEmail must both branch").toHaveLength(2);
  });

  it("no send path attaches the list headers unconditionally", () => {
    // The exact shape of the original bug.
    expect(messaging()).not.toMatch(/headers: unsubHeaders\(opts\.to\)/);
  });

  it("personal mail carries no List-Unsubscribe at all", () => {
    // Not a different URL, not a weaker variant — absent. A present
    // List-Unsubscribe is the signal regardless of what it points at.
    // Up to the closing brace in COLUMN ZERO — `[^}]*}` stops at the `{}` that
    // is the body, which matched a truncated string and proved nothing.
    const fn = messaging().match(/function personalHeaders\(\)[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn).toMatch(/return \{\};/);
    expect(fn).not.toMatch(/List-Unsubscribe/);
  });

  it("automated mail still gets one-click unsubscribe (RFC 8058)", () => {
    const src = messaging();
    expect(src).toMatch(/"List-Unsubscribe": `<\$\{contactUnsubUrl\(to\)\}>`/);
    expect(src).toMatch(/"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  });

  it("deliverToLead forwards the flag instead of deciding for itself", () => {
    // It serves BOTH one-off sends and the sequence runner, so the caller is
    // the only thing that knows which one this send is.
    const src = messaging();
    expect(src).toMatch(/personal: opts\.personal \}\)/);
    expect(src).toMatch(/senderPaid: opts\.senderPaid, personal: opts\.personal \}\)/);
  });
});

describe("every hand-sent message is marked personal", () => {
  const humanSends: [string, string][] = [
    ["sharing your card from a contact", "src/app/api/leads/share-card/route.ts"],
    ["sending a card from the scanner", "src/app/api/scanner/send/route.ts"],
  ];

  for (const [what, path] of humanSends) {
    it(what, () => {
      expect(read(path)).toMatch(/personal: true/);
    });
  }
});

describe("transactional mail the recipient must be able to act on", () => {
  // These are not marketing and not a list. They also must not offer a
  // one-click opt-out: doing so writes the address into message_opt_outs and
  // suppresses the very follow-up the recipient would ask for.
  it("a workspace invite reaches the inbox", () => {
    expect(read("src/app/api/office/invite/route.ts")).toMatch(/personal: true/);
  });

  it("account-setup mail reaches the inbox", () => {
    expect(read("src/app/api/admin/create-card/route.ts")).toMatch(/personal: true/);
  });
});

describe("scheduled mail is untouched", () => {
  it("the sequence runner never marks its sends personal", () => {
    // A cron-driven follow-up IS bulk mail. Legally and semantically the
    // header belongs, and removing it would be the actual violation.
    expect(read("src/app/api/reminders/route.ts")).not.toMatch(/personal: true/);
  });
});

describe("the opt-out path survives the change", () => {
  it("the shared card still shows an unsubscribe link in the body", () => {
    // The header is gone; the recipient's way out is not. This link writes to
    // the same message_opt_outs table and still suppresses every future send.
    expect(read("src/app/api/leads/share-card/route.ts")).toMatch(/contactUnsubUrl\(lead\.email as string\)/);
  });

  it("every send is still gated on that suppression list", () => {
    expect(read("src/app/api/leads/share-card/route.ts")).toMatch(/isOptedOut\("email", lead\.email as string\)/);
    expect(messaging()).toMatch(/if \(await isOptedOut\("email", lead\.email\)\) return \{ channel: "email", status: "opted_out" \}/);
  });
});

describe("the subject reads like a person, not a campaign", () => {
  it("does not open with an imperative call to action", () => {
    const src = read("src/app/api/leads/share-card/route.ts");
    expect(src).not.toMatch(/subject: `Save \$\{ownerName\}/);
    expect(src).toMatch(/subject: `Contact information from \$\{ownerName\}`/);
  });
});
