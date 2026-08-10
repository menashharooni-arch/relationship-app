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

  // EVERY assertion here runs against comment-stripped source, and that is
  // load-bearing rather than tidiness. The component's header NAMES the CTIA
  // elements it must carry ("...STOP to opt out, HELP for help...") while
  // explaining them, so matching raw source let those assertions pass on the
  // PROSE. Proved by mutation: deleting "Reply STOP to opt out, " from the
  // rendered copy left this suite fully green. The guard was documenting the
  // requirement instead of enforcing it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const flat = code.replace(/\s+/g, " ");

  it("renders a real checkbox input", () => {
    expect(code).toMatch(/type="checkbox"/);
  });

  it("is driven by the caller and defaults to UNCHECKED, never pre-selected", () => {
    expect(code).toMatch(/checked=\{checked\}/);
    expect(code).toMatch(/checked\s*=\s*false/); // the default in the destructure
    expect(code).not.toMatch(/defaultChecked/);
    expect(code).not.toMatch(/checked\s*=\s*true/);
  });

  it("states the TYPES of messages, not just the channel", () => {
    // "texts & emails via SwiftCard" names a channel — that phrasing is what
    // error 30924 rejected. The copy must describe what the messages ARE.
    expect(flat).toMatch(/follow-up text messages/i);
    expect(flat).toMatch(/contact details, replies/i);
    expect(flat).not.toMatch(/you agree to texts &amp; emails via SwiftCard/);
  });

  it("carries every other CTIA-required element", () => {
    expect(flat).toMatch(/Msg frequency varies/);
    expect(flat).toMatch(/Msg &amp; data rates may apply/);
    expect(flat).toMatch(/STOP to opt out/);
    expect(flat).toMatch(/HELP for help/);
    expect(code).toMatch(/href="\/sms-terms"/);
    expect(code).toMatch(/href="\/privacy"/);
  });

  it("tells the visitor the box is optional", () => {
    expect(flat).toMatch(/\(optional\)/i);
    expect(flat).toMatch(/without this/i);
  });

  // These floors are pinned so the next move down is deliberate. They use the
  // same comment-stripped source as everything above: the header discusses
  // 11px and slate-500 in prose, and matching THAT rather than the className
  // passes against a file that has already drifted — which is exactly how the
  // first version of the contrast check broke.
  it("keeps the 11px floor — 8px is not clear and conspicuous", () => {
    // Set 2026-07-28 for A2P review, up from 8px. No statutory minimum exists;
    // the standard is "clear and conspicuous". 10px/slate-400 (1728fe8) was a
    // step back toward the size that drew error 30924 on campaign
    // CM1319bbf18064a7f2100b8b47716fef0b, and is not coming back.
    const sizes = [...code.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
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

// ── A2P 10DLC / TCR campaign vetting ────────────────────────────────────────
// The first campaign submission was REJECTED with 30882 (Terms and Conditions
// issues) and 30908 (privacy policy could not be verified). Every required
// disclosure existed — but on /sms-terms, reachable from /terms only by a
// link. TCR opens the Terms & Conditions URL and looks for the elements ON
// that page; a link is not a disclosure. These assertions exist so a tidy-up
// that moves this copy back behind a link fails here instead of costing
// another multi-week carrier review cycle.
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("A2P 10DLC: /terms carries the SMS program disclosures itself", () => {
  const terms = readFileSync("src/app/terms/page.tsx", "utf8");

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
  it("describes the program and how opt-in happens", () => {
    expect(terms).toMatch(/Program description/i);
    expect(terms).toMatch(/consent box/i);
  });
  it("carries the exact no-sharing sentence TCR looks for", () => {
    // JSX wraps prose across lines; compare on collapsed whitespace so the
    // assertion tracks the sentence, not the formatting.
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
    const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
    expect(flat(privacy)).toMatch(
      /do not share, sell, or otherwise provide your mobile phone number or messaging consent information to any third parties or affiliates for marketing or promotional purposes/i
    );
  });
});
