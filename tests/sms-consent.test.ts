import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Where SMS consent comes from ────────────────────────────────────────────
//
// Owner, 2026-09-20: "All you're asking the person to do is share their
// information back with the user, rather than the user just typing it in
// themselves… It has nothing to do with our automation system so it doesn't
// need to be there." The consent checkbox came off every share form.
//
// That removes a promise, so it must also remove the power: a share can no
// longer grant permission to text anybody, and the public endpoint that
// receives shares cannot grant it either — which also closes the hole where an
// unauthenticated request could have posted sms_consent:true and minted the one
// tag the follow-up cron requires.
//
// Consent now comes from the person who actually has it: the SwiftCard user
// confirms, in their own account, that this contact agreed to be texted. That
// is the only thing that sets sms-ok, and sms-ok is still the gate on every
// automated send. STOP and HELP are untouched.
//
// STRUCTURAL by necessity: these are claims about rendered markup, the wording
// on public legal pages, and which route can write a tag — asserted against
// source because there is no DOM renderer here.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const flat = (s: string) => s.replace(/\s+/g, " ");

/** Every form a visitor can hand their details to. */
const FORMS = [
  "src/components/LeadCaptureForm.tsx",
  "src/components/SaveContactButton.tsx",
  "src/components/ConnectButton.tsx",
];
/** Every mock of those forms shown on the marketing site. */
const MOCKS = [
  "src/components/site/SignatureDemo.tsx",
  "src/components/site/LeadCapturePhone.tsx",
  "src/components/site/TemplateGallery.tsx",
  "src/components/site/CardMiniBuilder.tsx",
  "src/app/preview/PreviewClient.tsx",
];

describe("sharing your details is not subscribing to texts", () => {
  it("the checkbox component is gone, not merely unused", () => {
    expect(existsSync(join(root, "src/components/SmsConsentCheckbox.tsx"))).toBe(false);
  });

  it.each(FORMS)("%s asks for no consent and sends none", (form) => {
    const f = stripComments(read(form));
    expect(f).not.toMatch(/SmsConsentCheckbox/);
    expect(f).not.toMatch(/smsConsent/);
    expect(f).not.toMatch(/sms_consent/);
    // And nothing may quietly assert it on the visitor's behalf.
    expect(f).not.toMatch(/sms_consent:\s*true/);
  });

  it.each(MOCKS)("%s shows no consent line the real form doesn't have", (file) => {
    if (!existsSync(join(root, file))) return; // surface removed — nothing to police
    const src = stripComments(read(file));
    expect(src, `${file} re-types a retired consent line`).not.toMatch(/Msg frequency varies/);
    expect(src).not.toMatch(/Text me follow-ups/);
    expect(src).not.toMatch(/agree to receive follow-up messages by email or text/i);
  });
});

describe("a share can never grant permission to text", () => {
  const route = read("src/app/api/leads/route.ts");

  it("the public capture route ignores any consent flag it is sent", () => {
    const code = stripComments(route);
    // Not destructured, not read, not written — the field cannot reach a tag.
    expect(code).not.toMatch(/sms_consent/);
    expect(code).not.toMatch(/smsConsented|smsDeclined/);
    expect(code).not.toMatch(/"sms-ok"/);
  });

  it("a shared contact is created with neither consent tag", () => {
    const code = stripComments(route);
    const insert = code.slice(code.indexOf("tags: ["), code.indexOf("tags: [") + 400);
    expect(insert).toMatch(/\.\.\.safeTags/);
    expect(insert).toMatch(/"unread"/);
    expect(insert).not.toMatch(/sms-ok|sms-paused/);
  });

  it("only the owner's own signed-in request can set sms-ok", () => {
    const patch = read("src/app/api/leads/[id]/route.ts");
    expect(patch).toMatch(/sms_consent/);
    expect(patch).toMatch(/"sms-ok"/);
    // It is an authenticated route: the tag is server-owned, not client-set.
    expect(patch).toMatch(/auth\.getUser\(\)/);
  });
});

describe("the app says what switching texts on means", () => {
  it("the contact's text automation states the permission it asserts", () => {
    const contacts = flat(stripComments(read("src/components/ContactsClient.tsx")));
    expect(contacts).toMatch(/Only switch this on if .* agreed you could text them/);
    expect(contacts).toMatch(/reply STOP at any time/);
  });
});

describe("every send path still refuses a contact without consent", () => {
  const MANUAL_SMS_ROUTES = [
    "src/app/api/sms/send/route.ts",
    "src/app/api/leads/[id]/message/route.ts",
  ];

  it.each(MANUAL_SMS_ROUTES)("%s refuses to text an sms-paused contact", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/sms-paused/);
    expect(src).toMatch(/sms_declined/);
    expect(src).toMatch(/select\("[^"]*tags/);
  });

  it("the automated path still requires affirmative sms-ok", () => {
    const cron = read("src/app/api/reminders/route.ts");
    expect(cron).toMatch(/sms-ok/);
    expect(cron).toMatch(/sms-paused/);
  });
});

// ── The public pages a carrier reviewer reads ───────────────────────────────
// A2P 10DLC review opens these URLs and checks the page against what the
// campaign submission claims. They described a checkbox that no longer exists,
// and a live page that contradicts the submission is exactly what got campaign
// CMc75ca0d204260393fa9c05e1b8f2e8c0 rejected (error 30896) in August.
describe("the public consent pages describe the flow that actually exists", () => {
  const consent = read("src/app/sms-consent/page.tsx");
  const smsTerms = read("src/app/sms-terms/page.tsx");

  it("/sms-consent no longer claims a checkbox on the share form", () => {
    expect(consent).not.toMatch(/checkbox/i);
    expect(consent).not.toMatch(/Text me follow-ups/);
    expect(consent).not.toMatch(/sms-optin-screenshot/);
  });

  it("/sms-consent says who gives permission, and that sharing alone never does", () => {
    const f = flat(consent);
    expect(f).toMatch(/Sharing contact\s*details is not a subscription to text messages/i);
    expect(f).toMatch(/agreed you could text them/);
    expect(f).toMatch(/never<\/strong>\{" "\}sent an automated text|never<\/strong> sent an automated text/);
    expect(f).toMatch(/sms-ok/);
  });

  it("/sms-consent keeps the CTIA elements and the opt-out", () => {
    const f = flat(consent);
    expect(f).toMatch(/Message frequency varies/i);
    expect(f).toMatch(/Msg &amp; data rates may apply/);
    expect(f).toMatch(/STOP/);
    expect(f).toMatch(/HELP/);
    expect(f).toMatch(/hello@swiftcard\.me/);
  });

  it("/sms-terms describes the same flow, not a box to tick", () => {
    expect(smsTerms).not.toMatch(/Ticking that box/);
    expect(smsTerms).not.toMatch(/consent checkbox/i);
    expect(flat(smsTerms)).toMatch(/is <strong>not<\/strong> a subscription to text messages/);
    expect(smsTerms).toMatch(/STOP/);
  });

  it("the stale opt-in screenshot is gone from the site", () => {
    expect(existsSync(join(root, "public/sms-optin-screenshot.png"))).toBe(false);
  });
});

// ── A2P 10DLC / TCR campaign vetting ────────────────────────────────────────
// The first campaign submission was REJECTED with 30882 (Terms and Conditions
// issues) and 30908 (privacy policy could not be verified). Every required
// disclosure existed — but on /sms-terms, reachable from /terms only by a
// link. TCR opens the Terms & Conditions URL and looks for the elements ON
// that page; a link is not a disclosure.
describe("A2P 10DLC: /terms carries the SMS program disclosures itself", () => {
  const terms = read("src/app/terms/page.tsx");

  it("states message frequency", () => {
    expect(terms).toMatch(/[Mm]essage frequency varies/);
  });
  it("states that message and data rates may apply", () => {
    expect(terms).toMatch(/Message and data rates may apply/i);
  });
  it("gives STOP and HELP keywords", () => {
    expect(terms).toMatch(/\bSTOP\b/);
    expect(terms).toMatch(/\bHELP\b/);
  });
  it("names customer-care contact", () => {
    expect(terms).toMatch(/hello@swiftcard\.me/);
  });
  it("describes the program and how permission is given", () => {
    expect(terms).toMatch(/Program description/i);
    expect(flat(terms)).toMatch(/giving the SwiftCard user you met permission to text you/i);
    // The retired claim must not come back on the page a reviewer reads.
    expect(terms).not.toMatch(/ticking the unchecked SMS consent box/i);
  });
  it("carries the exact no-sharing sentence TCR looks for", () => {
    expect(flat(terms)).toMatch(
      /do not share, sell, or otherwise provide your mobile phone number or messaging consent information to any third parties or affiliates for marketing or promotional purposes/i
    );
  });
  it("still links out to the full SMS terms", () => {
    expect(terms).toMatch(/\/sms-terms/);
  });
});

describe("A2P 10DLC: /privacy carries the mobile-data sentence", () => {
  it("has the no-share/sell language on the privacy page too", () => {
    const privacy = read("src/app/privacy/page.tsx");
    expect(flat(privacy)).toMatch(
      /do not share, sell, or otherwise provide your mobile phone number or messaging consent information to any third parties or affiliates for marketing or promotional purposes/i
    );
  });
});
