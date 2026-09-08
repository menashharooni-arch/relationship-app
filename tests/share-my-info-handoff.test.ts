import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shareTextBody, shareEmail, smsHref, mailtoHref } from "../src/components/ShareMyInfoButton";

// ── Share by text / email opens the CONTACT'S thread on the owner's phone ────
//
// The owner's rule (2026-09-08): pressing "Share by text" on a contact opens
// that contact's conversation in Messages with the message already written, so
// he only presses send; "Share by email" does the same in Mail, with his
// signature in it. The message goes from HIS number and HIS mailbox — never
// from SwiftCard's Twilio number or the "via SwiftCard" sender.

const root = process.cwd();
const src = readFileSync(join(root, "src/components/ShareMyInfoButton.tsx"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const signer = { name: "Menash Harooni", title: "Founder", company: "SwiftCard", phone: "+1 917 905 7335", email: "hello@swiftcard.me" };
const cardUrl = "https://swiftcard.me/menashharooni-swiftcard?shared=1";

describe("share by text", () => {
  it("is an sms: deep link addressed to the contact's number with the body pre-filled", () => {
    const href = smsHref("(917) 555-0100", "hello");
    expect(href).toMatch(/^sms:9175550100\?&body=hello$/);
    // `?&body=` is the one form iOS and Android both accept.
    expect(smsHref("+1 917 555 0100", "x")).toBe("sms:+19175550100?&body=x");
  });

  it("ends with the card link on its own line, so iMessage shows the card preview", () => {
    const body = shareTextBody({ firstName: "Aaron", ownerName: "Menash Harooni", cardUrl });
    expect(body.split("\n").at(-1)).toBe(cardUrl);
    expect(body).toMatch(/^Hi Aaron! Menash Harooni here - save my contact information in the link below\.\n/);
  });

  it("does not greet by an email address or a company name", () => {
    expect(shareTextBody({ firstName: "john@acme.com", ownerName: "M", cardUrl })).toMatch(/^M here/);
  });

  it("carries none of the Twilio-sender boilerplate", () => {
    const body = shareTextBody({ firstName: "Aaron", ownerName: "M", cardUrl });
    expect(body).not.toMatch(/STOP|via SwiftCard/);
  });
});

describe("share by email", () => {
  it("is a mailto: to the contact with subject and body pre-filled", () => {
    const href = mailtoHref("aaron@example.com", "S", "line1\r\nline2");
    expect(href).toBe("mailto:aaron%40example.com?subject=S&body=line1%0D%0Aline2");
  });

  it("signs off with the owner's signature: name, title · company, phone, email", () => {
    const { subject, body } = shareEmail({ firstName: "Aaron", signer, ownerName: signer.name, cardUrl });
    expect(subject).toBe("Contact information from Menash Harooni");
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("Hi Aaron,");
    expect(body).toContain(cardUrl);
    expect(lines.slice(-4)).toEqual(["Menash Harooni", "Founder · SwiftCard", "+1 917 905 7335", "hello@swiftcard.me"]);
  });

  it("skips signature lines the card does not have, rather than printing blanks", () => {
    const { body } = shareEmail({ firstName: "", signer: { ...signer, title: null, company: null, phone: null }, ownerName: signer.name, cardUrl });
    expect(body.split("\r\n").slice(-2)).toEqual(["Menash Harooni", "hello@swiftcard.me"]);
    expect(body).not.toMatch(/\r\n\r\n\r\n/);
  });
});

describe("the component hands off and sends nothing itself", () => {
  it("navigates to the sms:/mailto: link from the tap, with no await ahead of it", () => {
    const fn = (name: string) => {
      const at = code.indexOf(`function ${name}(`);
      expect(at, name).toBeGreaterThan(-1);
      return code.slice(at, code.indexOf("\n  }", at));
    };
    expect(fn("openText")).toMatch(/window\.location\.assign\(smsHref\(/);
    expect(fn("openText")).not.toMatch(/await/);
    expect(fn("openEmail")).toMatch(/window\.location\.assign\(mailtoHref\(/);
    expect(fn("openEmail")).not.toMatch(/await/);
  });

  it("never posts to the server or logs a message", () => {
    expect(code).not.toContain("fetch(");
    expect(code).not.toContain("share-card");
    expect(code).not.toContain("logMessage");
  });

  it("'Share by both' opens the text first and then offers the email", () => {
    const at = code.indexOf("function shareBoth(");
    const body = code.slice(at, code.indexOf("\n  }", at));
    expect(body.indexOf("openText()")).toBeGreaterThan(-1);
    expect(body).toMatch(/setState\("emailNext"\)/);
    expect(code).toMatch(/state === "emailNext" \? shareEmailNow\(\)/);
  });

  it("the contacts page signs with the card the contact belongs to", () => {
    const ui = readFileSync(join(root, "src/components/ContactsClient.tsx"), "utf8");
    expect(ui).toMatch(/signer=\{selected\.card_owner \? cardSigners\[selected\.card_owner\]/);
    const page = readFileSync(join(root, "src/app/contacts/page.tsx"), "utf8");
    expect(page).toMatch(/select\("id, username, name, label, title, company, email, phone"\)/);
  });
});
