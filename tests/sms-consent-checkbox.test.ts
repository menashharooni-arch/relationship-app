import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Twilio Onboarding & Compliance (ticket #28654422, 2026-07-30) named the exact
// requirements that campaign CM1319bbf18064a7f2100b8b47716fef0b failed on with
// error 30924. All three below are approval-blocking, and all three are easy to
// undo by accident, so they are pinned here.
//
// STRUCTURAL by necessity: the requirements are about rendered markup and
// default state across four sibling forms; asserting them properly would need a
// DOM renderer this repo does not have. Labelled so it is not mistaken for a
// behavior test.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const FORMS = [
  "src/components/LeadCaptureForm.tsx",
  "src/components/SocialLinkIntercept.tsx",
  "src/components/SaveContactButton.tsx",
  "src/components/ConnectButton.tsx",
];

describe("SMS consent checkbox (A2P 10DLC approval requirements)", () => {
  const src = read("src/components/SmsConsentCheckbox.tsx");

  it("renders a real checkbox input", () => {
    expect(src).toMatch(/type="checkbox"/);
  });

  it("is driven by the caller and defaults to UNCHECKED, never pre-selected", () => {
    expect(src).toMatch(/checked=\{checked\}/);
    expect(src).toMatch(/checked\s*=\s*false/); // the default in the destructure
    expect(src).not.toMatch(/defaultChecked/);
    expect(src).not.toMatch(/checked\s*=\s*true/);
  });

  it("states the TYPES of messages, not just the channel", () => {
    // "texts & emails via SwiftCard" names a channel — that phrasing is what
    // error 30924 rejected. The copy must describe what the messages ARE.
    // Whitespace-tolerant: the copy is JSX and wraps across lines.
    const flat = src.replace(/\s+/g, " ");
    expect(flat).toMatch(/follow-up text messages/i);
    expect(flat).toMatch(/contact details, replies/i);
    expect(src).not.toMatch(/you agree to texts & emails via SwiftCard/);
  });

  it("carries every other CTIA-required element", () => {
    const flat = src.replace(/\s+/g, " ");
    expect(flat).toMatch(/Msg frequency varies/);
    expect(flat).toMatch(/Msg &amp; data rates may apply/);
    expect(flat).toMatch(/STOP to opt out/);
    expect(flat).toMatch(/HELP for help/);
    expect(src).toMatch(/href="\/sms-terms"/);
    expect(src).toMatch(/href="\/privacy"/);
  });

  it("tells the visitor the box is optional", () => {
    expect(src).toMatch(/\(optional\)/i);
    expect(src).toMatch(/without this/i);
  });

  it("keeps the 11px floor — 8px is not clear and conspicuous", () => {
    const sizes = [...src.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });

  it.each(FORMS)("%s defaults consent to false and posts the real value", (form) => {
    const f = read(form);
    expect(f).toMatch(/useState\(false\)/);
    expect(f).toMatch(/sms_consent:\s*smsConsent/);
    // The old consent-by-submission hardcode must not come back.
    expect(f).not.toMatch(/sms_consent:\s*true/);
    expect(f).toMatch(/<SmsConsentCheckbox checked=\{smsConsent\} onChange=\{setSmsConsent\} \/>/);
  });

  it.each(FORMS)("%s does not block submission on SMS consent", (form) => {
    const f = read(form);
    // Any guard that returns early or disables submit based on smsConsent would
    // make the box mandatory, which fails review and is a TCPA problem.
    expect(f).not.toMatch(/if\s*\(\s*!\s*smsConsent\s*\)/);
    expect(f).not.toMatch(/disabled=\{[^}]*!smsConsent/);
    expect(f).not.toMatch(/required[^)]*smsConsent/);
  });

  it("the public consent docs describe the checkbox, not consent-by-submission", () => {
    const page = read("src/app/sms-consent/page.tsx");
    expect(page).toMatch(/never pre-selected/i);
    expect(page).toMatch(/optional/i);
    expect(page).not.toMatch(/Submitting the form is the affirmative opt-in/);
  });
});
