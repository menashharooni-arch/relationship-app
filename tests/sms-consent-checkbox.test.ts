import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// CONSENT-BY-SUBMISSION (owner decision, Aug 2026). The share forms carry a
// disclosure line, not a checkbox: submitting IS the consent for text and email.
//
// ⚠️ This deliberately reverses the 2026-07-31 A2P change. Twilio Onboarding &
// Compliance (ticket #28654422) rejected campaign
// CM1319bbf18064a7f2100b8b47716fef0b with error 30924 against a
// disclosure-only form, and asked for message TYPES plus a real unticked
// checkbox. The owner was shown that history and chose this design anyway, so
// what is pinned below is the DISCLOSURE contract — every CTIA element it still
// has to carry, and the fact that all four forms post sms_consent:true.
//
// If Twilio rejects the campaign again, this file is where the trade-off is
// recorded; restoring the checkbox means reverting commit 31c53af.
//
// STRUCTURAL by necessity: these are about rendered markup across four sibling
// forms, and asserting them properly would need a DOM renderer this repo does
// not have. Labelled so it is not mistaken for a behavior test.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const FORMS = [
  "src/components/LeadCaptureForm.tsx",
  "src/components/SocialLinkIntercept.tsx",
  "src/components/SaveContactButton.tsx",
  "src/components/ConnectButton.tsx",
];

describe("SMS consent disclosure (consent by submission)", () => {
  const src = read("src/components/SmsConsentCheckbox.tsx");

  it("is a disclosure line, not a checkbox", () => {
    expect(src).not.toMatch(/type="checkbox"/);
    expect(src).not.toMatch(/defaultChecked/);
  });

  it("names BOTH channels, since submitting consents to both", () => {
    const flat = src.replace(/\s+/g, " ");
    expect(flat).toMatch(/you agree to texts &amp; emails/i);
  });

  it("carries every CTIA-required element", () => {
    // With no checkbox this line is the ONLY thing standing between the product
    // and an unconsented text, so it has to carry all of them. Dropping "data"
    // from "Msg & data rates may apply" breaks the recognized CTIA phrasing.
    const flat = src.replace(/\s+/g, " ");
    expect(flat).toMatch(/Msg frequency varies/);
    expect(flat).toMatch(/Msg &amp; data rates may apply/);
    expect(flat).toMatch(/STOP to opt out/);
    expect(flat).toMatch(/HELP for help/);
    expect(src).toMatch(/href="\/sms-terms"/);
    expect(src).toMatch(/href="\/privacy"/);
  });

  it("keeps the 11px floor — 8px is not clear and conspicuous", () => {
    const sizes = [...src.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });

  it("keeps the contrast floor — lighter than slate-500 fails WCAG AA here", () => {
    // The other half of "clear and conspicuous": a disclosure can be buried by
    // washing it out just as surely as by shrinking it. Measured on the live
    // white share form — slate-500 is 4.76:1 against the 4.5:1 AA floor for
    // text this size, so it is already AT the floor; slate-400 is 2.56:1 and
    // fails outright. Asked for "as light as legally possible" (Aug 2026):
    // this is it, and the answer to "can it go lighter" is no.
    // Comments must be stripped first: the component's own header explains WHY
    // slate-400 is disallowed, and matching that prose instead of the className
    // fails the test against a file that is actually correct.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const shades = [...code.matchAll(/text-slate-(\d+)/g)].map((m) => Number(m[1]));
    expect(shades.length).toBeGreaterThan(0);
    expect(Math.min(...shades)).toBeGreaterThanOrEqual(500);
  });

  it.each(FORMS)("%s posts consent-by-submission and holds no checkbox state", (form) => {
    const f = read(form);
    expect(f).toMatch(/sms_consent:\s*true/);
    // The checkbox wiring must be fully gone, not left dangling.
    expect(f).not.toMatch(/sms_consent:\s*smsConsent/);
    expect(f).not.toMatch(/setSmsConsent/);
  });

  it.each(FORMS)("%s never gates submission on consent", (form) => {
    const f = read(form);
    expect(f).not.toMatch(/if\s*\(\s*!\s*smsConsent\s*\)/);
    expect(f).not.toMatch(/disabled=\{[^}]*!smsConsent/);
  });
});

// An unticked box records sms-paused. That must block EVERY outbound SMS path,
// not just the automated cron — otherwise the opt-in tells the visitor one
// thing and the product does another, which is a TCPA problem independent of
// A2P review. Found while verifying claims before writing to Twilio.
describe("an explicit SMS decline blocks every send path", () => {
  const MANUAL_SMS_ROUTES = [
    "src/app/api/sms/send/route.ts",
    "src/app/api/leads/[id]/message/route.ts",
  ];

  it.each(MANUAL_SMS_ROUTES)("%s refuses to text an sms-paused contact", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/sms-paused/);
    expect(src).toMatch(/sms_declined/);
    // It must actually read the tags to be able to check them.
    expect(src).toMatch(/select\("[^"]*tags/);
  });

  it("the automated path still requires affirmative sms-ok", () => {
    const cron = read("src/app/api/reminders/route.ts");
    expect(cron).toMatch(/sms-ok/);
    expect(cron).toMatch(/sms-paused/);
  });
});
