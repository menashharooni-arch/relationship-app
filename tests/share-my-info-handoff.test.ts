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

  // 2026-09-09: "Share by both" is the ONE option that sends server-side —
  // one tap cannot open two apps, and the old two-tap version meant the email
  // half usually never went. Text and email are unchanged and must stay that
  // way: they still go from the owner's own number and mailbox.
  it("the single-channel options still hand off and never send", () => {
    for (const name of ["openText", "openEmail", "shareText", "shareEmailNow"]) {
      const at = code.indexOf(`function ${name}(`);
      expect(at, name).toBeGreaterThan(-1);
      const body = code.slice(at, code.indexOf("\n  }", at));
      expect(body, `${name} must not send server-side`).not.toContain("fetch(");
      expect(body, `${name} must not post to share-card`).not.toContain("share-card");
    }
    expect(code).not.toContain("logMessage");
  });

  it("'Share by both' sends both channels through the existing share-card route", () => {
    const at = code.indexOf("async function shareBoth(");
    expect(at).toBeGreaterThan(-1);
    const body = code.slice(at, code.indexOf("\n  }", at));
    // The existing endpoint, not a new one, and both channels in ONE request:
    // two requests could not report a half-delivered share honestly.
    expect(body).toMatch(/fetch\("\/api\/leads\/share-card"/);
    expect(body).toMatch(/channel: "both"/);
    // No app is opened — that was the iOS bug.
    expect(body).not.toContain("window.location.assign");
    expect(body).not.toContain("openText()");
    // Partial delivery is reported as partial, never as success.
    expect(body).toMatch(/setState\("partial"\)/);
    expect(body).toMatch(/setState\("sent"\)/);
  });

  it("a double tap cannot send twice", () => {
    // A ref, not state: two taps in one React batch both read stale state, so
    // only a synchronously-written guard actually blocks the second send.
    expect(code).toMatch(/const sending = useRef\(false\)/);
    const at = code.indexOf("async function shareBoth(");
    const body = code.slice(at, code.indexOf("\n  }", at));
    expect(body).toMatch(/if \([^)]*sending\.current\)\s*return/);
    expect(body).toMatch(/sending\.current = true/);
    expect(body).toMatch(/sending\.current = false/);
    // And the server enforces it independently — a client guard is a courtesy.
    const route = readFileSync(join(root, "src/app/api/leads/share-card/route.ts"), "utf8");
    expect(route).toMatch(/SHARE_REPEAT_WINDOW_MS/);
  });

  it("the contacts page signs with the card the contact belongs to", () => {
    const ui = readFileSync(join(root, "src/components/ContactsClient.tsx"), "utf8");
    expect(ui).toMatch(/signer=\{selected\.card_owner \? cardSigners\[selected\.card_owner\]/);
    const page = readFileSync(join(root, "src/app/contacts/page.tsx"), "utf8");
    // Every field the signature is built from must still be read. is_offline
    // joined the list on 2026-09-08 so the Share menu can refuse a card that
    // has been switched off (see share-never-sends-a-dark-card.test.ts) —
    // asserted field by field rather than as one frozen string, so adding a
    // column is not a test failure but DROPPING one still is.
    const select = page.match(/\.select\("([^"]*)"\)/)?.[1] ?? "";
    for (const field of ["id", "username", "name", "label", "title", "company", "email", "phone", "is_offline"]) {
      expect(select.split(/,\s*/), `contacts page must read ${field}`).toContain(field);
    }
  });
});
