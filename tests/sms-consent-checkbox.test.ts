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

  // EVERY assertion here runs against comment-stripped source, and that is
  // load-bearing rather than tidiness. The component's header NAMES the CTIA
  // elements it must carry ("...STOP to opt out, HELP for help...") while
  // explaining them, so matching raw source let those assertions pass on the
  // PROSE. Proved by mutation: deleting "Reply STOP to opt out, " from the
  // rendered copy left this suite fully green. The guard was documenting the
  // requirement instead of enforcing it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const flat = code.replace(/\s+/g, " ");

  it("is a disclosure line, not a checkbox", () => {
    expect(code).not.toMatch(/type="checkbox"/);
    expect(code).not.toMatch(/defaultChecked/);
  });

  it("names BOTH channels, since submitting consents to both", () => {
    expect(flat).toMatch(/you agree to texts &amp; emails/i);
  });

  it("carries every CTIA-required element", () => {
    // With no checkbox this line is the ONLY thing standing between the product
    // and an unconsented text, so it has to carry all of them. Dropping "data"
    // from "Msg & data rates may apply" breaks the recognized CTIA phrasing.
    expect(flat).toMatch(/Msg frequency varies/);
    expect(flat).toMatch(/Msg &amp; data rates may apply/);
    expect(flat).toMatch(/STOP to opt out/);
    expect(flat).toMatch(/HELP for help/);
    expect(code).toMatch(/href="\/sms-terms"/);
    expect(code).toMatch(/href="\/privacy"/);
  });

  // Both floors sit below the previously-advised ones, by explicit owner
  // decision (Aug 2026, asked twice — the second time after being shown the A2P
  // history and the contrast numbers). These pin the values so the next move is
  // deliberate too, and so the trade-off stays visible instead of becoming
  // folklore. They use the same comment-stripped source as everything above:
  // the header discusses 11px and slate-500 in prose, and matching THAT rather
  // than the className fails the test against a correct file — which is exactly
  // how the first version of the contrast check broke.

  it("stays at 10px — smaller returns to the 8px already judged too small", () => {
    // Was 11px (set 2026-07-28 for A2P review, itself up from 8px). No
    // statutory minimum exists; the standard is "clear and conspicuous". 10px
    // is one step back toward the size that drew Twilio error 30924 on campaign
    // CM1319bbf18064a7f2100b8b47716fef0b — 9px or below invites that again.
    const sizes = [...code.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
  });

  it("stays at slate-400 — already below WCAG AA, so nothing lighter", () => {
    // slate-500 was 4.76:1 on the white share form, just above the 4.5:1 AA
    // floor for text this size. slate-400 is 2.56:1 — BELOW AA, accepted by the
    // owner. slate-300 (1.7:1) is where it stops being readable at all, so this
    // guard is what keeps a "just a bit lighter" from going there.
    const shades = [...code.matchAll(/text-slate-(\d+)/g)].map((m) => Number(m[1]));
    expect(shades.length).toBeGreaterThan(0);
    expect(Math.min(...shades)).toBeGreaterThanOrEqual(400);
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
