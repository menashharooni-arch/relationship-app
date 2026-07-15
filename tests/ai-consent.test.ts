import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AiConsentGate, { AiDraftTag, AI_CONSENT_COPY } from "@/components/AiConsentGate";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Item 11 — AI consent notice + "AI draft" tag. Native-only; invisible on web.

describe("(a) consent modal never renders on web", () => {
  it("renders nothing on web when not accepted", () => {
    expect(renderToStaticMarkup(h(AiConsentGate, { accepted: false }))).toBe("");
  });
  it("renders nothing on web when already accepted", () => {
    expect(renderToStaticMarkup(h(AiConsentGate, { accepted: true }))).toBe("");
  });
});

describe("(b) AI draft tag never renders on web", () => {
  it("renders nothing on web", () => {
    expect(renderToStaticMarkup(h(AiDraftTag))).toBe("");
  });
});

describe("(c) consent notice uses the exact mandated copy and shows once", () => {
  it("AI_CONSENT_COPY is the exact required string, character-for-character", () => {
    expect(AI_CONSENT_COPY).toBe(
      "SwiftCard uses AI to draft your follow-up messages. Contact details you provide are processed by our AI provider to generate drafts."
    );
  });

  const src = read("src/components/AiConsentGate.tsx");

  it("opens only on native for an account that hasn't accepted (shown once)", () => {
    // open = native && !done; done seeds from `accepted`, so an accepted account
    // never opens it again.
    expect(src).toMatch(/const open = native && !done/);
    expect(src).toMatch(/useState\(accepted\)/);
  });

  it("acknowledgment is a single 'Got it' that persists acceptance", () => {
    expect(src).toContain("Got it");
    expect(src).toContain("/api/account/ai-consent");
  });

  it("carries no upsell/pricing (compliance notice, not a selling surface)", () => {
    // Only the mandated copy + Got it — no price/upgrade/pricing language.
    expect(AI_CONSENT_COPY).not.toMatch(/upgrade|pricing|\$\d|Pro plan/i);
    expect(src).not.toMatch(/\$\d|Upgrade to Pro/);
  });
});

describe("persistence uses the _-prefixed customization flag convention", () => {
  const route = read("src/app/api/account/ai-consent/route.ts");
  it("sets customization._aiConsentAccepted = true (merged, additive)", () => {
    expect(route).toMatch(/_aiConsentAccepted: true/);
    expect(route).toMatch(/\.\.\.customization/);
  });
});

describe("the AI draft tag is wired at the AI-generated message render sites", () => {
  it("LeadCard shows <AiDraftTag/> beside each AI-drafted message", () => {
    expect(read("src/components/LeadCard.tsx")).toContain("<AiDraftTag />");
  });
  it("ContactsClient shows <AiDraftTag/> in the generated sequence preview", () => {
    expect(read("src/components/ContactsClient.tsx")).toContain("<AiDraftTag />");
  });
});
