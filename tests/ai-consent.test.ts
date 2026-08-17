import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AiConsentGate, { AiDraftTag } from "@/components/AiConsentGate";
import { aiConsentCopy, aiConsentAllows, readAiConsent } from "@/lib/ai-consent";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Item 11 — AI consent notice + "AI draft" tag. Native-only; invisible on web.

describe("(a) consent modal never renders on web", () => {
  const copy = aiConsentCopy("Google");
  it.each(["unset", "accepted", "declined"] as const)(
    "renders nothing on web (%s)",
    (consent) => {
      expect(
        renderToStaticMarkup(h(AiConsentGate, { consent, provider: "Google", copy })),
      ).toBe("");
    },
  );
  it("renders nothing when no AI provider is configured", () => {
    expect(
      renderToStaticMarkup(h(AiConsentGate, { consent: "unset" as const, provider: null, copy })),
    ).toBe("");
  });
});

describe("(b) AI draft tag never renders on web", () => {
  it("renders nothing on web", () => {
    expect(renderToStaticMarkup(h(AiDraftTag))).toBe("");
  });
});

// App Review REJECTED the copy this block used to pin, under Guidelines
// 5.1.1(i) and 5.1.2(i): it never named the recipient, never itemised what is
// sent, and its only button was "Got it" — an acknowledgement, not permission.
// What gets pinned now is the three things Apple actually asked for.
describe("(c) the AI notice discloses, names, and asks", () => {
  const src = read("src/components/AiConsentGate.tsx");
  const lib = read("src/lib/ai-consent.ts");
  const copy = aiConsentCopy("Google");

  it("names the recipient, and takes the name from the live provider", () => {
    expect(copy.who).toContain("Google");
    // Hardcoding a name would be the same bug one release later — swap a key
    // and the disclosure silently becomes false.
    expect(lib).toMatch(/\$\{provider\}/);
    expect(read("src/lib/ai.ts")).toMatch(/export function aiProviderName/);
  });

  it("itemises what is sent, including the third party's card photo", () => {
    const what = copy.what.join(" | ").toLowerCase();
    expect(what).toMatch(/business card/);
    expect(what).toMatch(/notes/);
    expect(what).toMatch(/assistant/);
  });

  it("offers a real choice, not just an acknowledgement", () => {
    expect(src).toContain("Allow");
    expect(src).toMatch(/Don&apos;t allow|Don't allow/);
    expect(src, "the rejected version's single-button pattern").not.toMatch(/>\s*Got it\s*</);
    expect(src).toMatch(/choose\("declined"\)/);
  });

  it("promises nothing about model training that we cannot verify", () => {
    expect(copy.who).not.toMatch(/train/i);
  });

  it("carries no upsell/pricing (compliance notice, not a selling surface)", () => {
    expect(copy.who + copy.control + copy.what.join(" ")).not.toMatch(/upgrade|pricing|\$\d|Pro plan/i);
    expect(src).not.toMatch(/\$\d|Upgrade to Pro/);
  });
});

describe("declining actually stops the data leaving", () => {
  it("a declined account is refused, an unset one is not", () => {
    expect(aiConsentAllows({ _aiConsent: "declined" })).toBe(false);
    expect(aiConsentAllows({ _aiConsent: "accepted" })).toBe(true);
    expect(aiConsentAllows({})).toBe(true);
    // Pre-rejection accounts already agreed; re-asking them would be noise.
    expect(readAiConsent({ _aiConsentAccepted: true })).toBe("accepted");
  });

  it.each([
    "src/app/api/scanner/route.ts",
    "src/app/api/ai/suggest-messages/route.ts",
    "src/app/api/leads/[id]/generate-sequence/route.ts",
    "src/app/api/scan-design/route.ts",
    "src/app/api/design-transfer/route.ts",
  ])("%s refuses a declined account before sending anything", (route) => {
    expect(read(route)).toMatch(/aiConsentBlock\(user\.id\)/);
  });

  it("the in-app assistant degrades instead of erroring", () => {
    // It answers from the local corpus with no AI call, so 403-ing there would
    // break a help widget over a preference.
    expect(read("src/app/api/ai/help/route.ts")).toMatch(/aiConsentAllowsFor\(user\.id\)/);
  });
});

describe("persistence uses the _-prefixed customization flag convention", () => {
  const route = read("src/app/api/account/ai-consent/route.ts");
  it("stores the decision, merged and additive, keeping the legacy flag in sync", () => {
    expect(route).toMatch(/_aiConsent: decision/);
    expect(route).toMatch(/_aiConsentAccepted: decision === "accepted"/);
    expect(route).toMatch(/\.\.\.customization/);
  });
});

describe("the AI draft tag is wired at the AI-generated message render sites", () => {
  // The LeadCard assertion that used to sit here was removed with the component
  // itself: LeadCard had no importers left (ContactsClient replaced it), so it
  // was asserting about markup nobody could render. ContactsClient below is the
  // live render site and carries the same tag.
  it("ContactsClient shows <AiDraftTag/> in the generated sequence preview", () => {
    expect(read("src/components/ContactsClient.tsx")).toContain("<AiDraftTag />");
  });
});
