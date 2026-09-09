import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// "Share by both" sends the card by text AND email through our own senders
// (owner order 2026-09-09). One tap cannot open two apps, so the previous
// version opened Messages and then waited for the owner to come back and tap
// "Now email →" — on iOS the second half was usually never sent, and the owner
// believed he had shared by both.
//
// The rules that make the replacement safe, pinned here because each one is a
// way the feature could quietly go wrong again:
//   • it reuses the existing route and senders — no second SMS/email system;
//   • a half-delivered share is reported as half-delivered, never as success;
//   • "stop texting me" still vetoes the text;
//   • one contact cannot be sent to twice by one thumb.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const route = stripComments(read("src/app/api/leads/share-card/route.ts"));
const btn = stripComments(read("src/components/ShareMyInfoButton.tsx"));

describe("Share by both reuses the existing infrastructure", () => {
  it("sends through the one messaging lib, not a second one", () => {
    // Every sender comes from lib/messaging — the same Twilio number and Resend
    // sender the automations use. A local fetch to Twilio/Resend here would be
    // a duplicate system with its own opt-out and branding bugs.
    expect(route).toMatch(/from "@\/lib\/messaging"/);
    expect(route).toMatch(/\bsendSms\b/);
    expect(route).toMatch(/\bsendRawEmail\b/);
    expect(route).not.toMatch(/api\.twilio\.com/);
    expect(route).not.toMatch(/api\.resend\.com/);
  });

  it("the client posts to that route and opens no app", () => {
    expect(btn).toMatch(/fetch\("\/api\/leads\/share-card"/);
    expect(btn).toMatch(/channel: "both"/);
    const at = btn.indexOf("async function shareBoth(");
    const body = btn.slice(at, btn.indexOf("\n  }", at));
    for (const forbidden of ["sms:", "mailto:", "window.location.assign"]) {
      expect(body, `shareBoth must not use ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("logs each channel to the contact's thread so the send is visible", () => {
    expect(route.match(/logMessage\(/g) ?? []).toHaveLength(2);
    expect(btn).toMatch(/onSent\?\.\(\)/);
  });
});

describe("a partial send is reported as partial", () => {
  it("the response separates what was asked for from what went", () => {
    // `partial` is computed against what the CALLER asked for. Comparing
    // against what we attempted would call a share complete whenever we
    // silently skipped a channel — the exact lie this feature must not tell.
    expect(route).toMatch(/const askedChannelCount = \(askedSms \? 1 : 0\) \+ \(askedEmail \? 1 : 0\)/);
    expect(route).toMatch(/partial: sent\.length < askedChannelCount/);
    expect(route).toMatch(/skipped/);
  });

  it("only reports ok when at least one channel actually sent", () => {
    expect(route).toMatch(/const sent = attempted\.filter\(\(\[, s\]\) => s === "sent"\)/);
    expect(route).toMatch(/if \(sent\.length === 0\)/);
  });

  it("the button shows a distinct partial state, not a success", () => {
    expect(btn).toMatch(/setState\("partial"\)/);
    // The success badge is reserved for BOTH channels landing.
    const at = btn.indexOf("const both = sent.includes(\"sms\") && sent.includes(\"email\")");
    expect(at).toBeGreaterThan(-1);
    expect(btn).toMatch(/Partly sent/);
  });

  it("names the reason the other channel did not go", () => {
    for (const reason of ["opted out of", "isn't switched on", "on file", "opted in to texts"]) {
      expect(btn, `partial message must be able to say "${reason}"`).toContain(reason);
    }
  });
});

describe("consent and duplicate protection", () => {
  it("an sms-paused contact is never texted, and still gets the email", () => {
    expect(route).toMatch(/includes\("sms-paused"\)/);
    // The veto is part of whether we text at all, not a post-hoc check.
    expect(route).toMatch(/const wantsSms = askedSms && !!lead\.phone && !declinedSms/);
    // ...but it does not cancel the email half.
    expect(route).toMatch(/const wantsEmail = askedEmail && !!lead\.email/);
  });

  it("both is best-effort; a single-channel share stays strict", () => {
    // Asking for "sms" on a contact with no phone is a mistake worth reporting;
    // asking for "both" on one is not a reason to send nothing.
    expect(route).toMatch(/if \(channel === "sms" && !lead\.phone\)/);
    expect(route).toMatch(/if \(channel === "email" && !lead\.email\)/);
    expect(route).toMatch(/if \(!wantsSms && !wantsEmail\)/);
  });

  it("a double tap is blocked in the client and again on the server", () => {
    expect(btn).toMatch(/const sending = useRef\(false\)/);
    expect(route).toMatch(/isRateLimited\(`share-card:\$\{user\.id\}:\$\{leadId\}`/);
  });
});

describe("the other three options are untouched", () => {
  it("text, email and the share sheet still hand off to the owner's phone", () => {
    for (const name of ["openText", "openEmail", "shareText", "shareEmailNow", "sharePhone"]) {
      const at = btn.indexOf(`function ${name}(`);
      expect(at, name).toBeGreaterThan(-1);
      const body = btn.slice(at, btn.indexOf("\n  }", at));
      expect(body, `${name} must not send server-side`).not.toContain("share-card");
    }
    expect(btn).toMatch(/window\.location\.assign\(smsHref\(/);
    expect(btn).toMatch(/window\.location\.assign\(mailtoHref\(/);
  });
});
