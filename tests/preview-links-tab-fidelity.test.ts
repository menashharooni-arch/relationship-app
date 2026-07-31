import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// STRUCTURAL GUARD.
//
// /preview sells itself as "this is your dashboard — try it out", so its Links
// tab has to be the Links page people actually get. It wasn't: the Swift
// Signature section showed an inline card preview and a "See it in an email" /
// "Copy signature" button pair, none of which exist in the real portal, where
// that section is EmailSignatureBox's collapsed state — a title, one line of
// copy, and a single "Preview & copy" button.
//
// The mock is a hand-built replica (it has no logged-in account to render from),
// so nothing but a test keeps it honest when the real page changes.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Prose ABOUT the replica is not the replica. The preview file carries a comment
// explaining this very bug that names the old buttons and the real component, so
// without stripping it the "no longer present" assertions would fail on the
// comment and the "still present" ones could pass on it.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const preview = stripComments(read("src/app/preview/PreviewClient.tsx"));
const share = read("src/app/share/page.tsx");             // the real Links page
const sigBox = read("src/components/EmailSignatureBox.tsx"); // its Swift Signature section

// The copy the real page shows, taken FROM the real page — so if the product
// changes the wording, this test starts failing until the mock is updated too.
const SWIFT_LINKS_BLURB =
  "A separate link from your card — your bio, socials, and links in one place. Drop it in your Instagram, TikTok, or any social bio.";
const SIGNATURE_BLURB =
  "Copy your Swift Signature and paste it into your email — a clickable link to your card at the bottom of every message you send.";

describe("the /preview Links tab matches the real Links page", () => {
  it("the strings under test really are the real page's strings", () => {
    // Without this, a product copy change would silently make every assertion
    // below test the mock against a constant that no longer matches anything.
    expect(share, "the real Links page no longer carries this Swift Links copy").toContain(SWIFT_LINKS_BLURB);
    expect(sigBox, "EmailSignatureBox no longer carries this description").toContain(SIGNATURE_BLURB);
    expect(sigBox, "EmailSignatureBox's collapsed button is no longer 'Preview & copy'").toMatch(
      /"Update my signature" : "Preview & copy"/,
    );
  });

  it("the Swift Links section reads the same as the real one", () => {
    expect(preview).toContain(SWIFT_LINKS_BLURB);
    expect(preview).toContain("Open Swift Links →");
  });

  it("the Swift Signature section is EmailSignatureBox's collapsed state", () => {
    expect(preview, "the mock lost the real signature description").toContain(SIGNATURE_BLURB);
    expect(preview, "the mock's signature button no longer says Preview & copy").toMatch(/Preview &amp; copy/);
    // The real collapsed box is p-4 while every other card on the page is p-5.
    expect(preview).toMatch(/bg-gray-900 border border-gray-800\/80 rounded-2xl p-4/);
    expect(sigBox, "EmailSignatureBox is no longer p-4 — the mock now over-pads")
      .toContain("bg-gray-900 border border-gray-800/80 rounded-2xl p-4");
  });

  it("the invented controls are gone", () => {
    // These three existed only in the mock. Any of them coming back means the
    // demo is showing a portal the customer will never see.
    expect(preview, "'See it in an email' is back — no such control in the portal").not.toContain("See it in an email");
    expect(share, "the real page grew a 'See it in an email' button").not.toContain("See it in an email");
    expect(preview, "the fake signature URL line is back").not.toMatch(/text-blue-600 text-\[11px\] mt-1\.5 underline/);
  });
});
