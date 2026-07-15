import { describe, it, expect } from "vitest";
import { localAnswer, buildHelpPrompt, NATIVE_RULES, NATIVE_FALLBACK } from "@/app/api/ai/help/route";

// Area 5 — native AI-help guardrail. A native session must never leak
// upgrade/pricing/purchase/website language through EITHER the KB fast-path or
// the LLM-prompt-construction path. A web (flag-absent) session must be
// completely unchanged from today.

const LEAK = /\bupgrade\b|\bpricing\b|\bprice\b|\bbilling\b|\bsubscription\b|\$\d|swiftcard\.me|\bwebsite\b|Pricing page|Settings → Billing/i;

describe("KB fast-path — native answers never leak selling language", () => {
  const nativeLeakyQuestions = [
    "How do I upgrade to Pro?",
    "What's the pricing?",
    "How much does Pro cost?",
    "How do I cancel my subscription?",
    "billing",
    "hi", // greeting mentions "upgrade to Pro" on web
  ];

  for (const q of nativeLeakyQuestions) {
    it(`native KB answer for "${q}" contains no selling language`, () => {
      const ans = localAnswer(q, true);
      expect(ans).not.toBeNull();
      expect(ans as string).not.toMatch(LEAK);
    });
  }

  it("native 'How do I upgrade to Pro?' states which plan includes the features (Pro), nothing about buying", () => {
    const ans = localAnswer("How do I upgrade to Pro?", true) as string;
    expect(ans).toMatch(/Pro plan/);
    expect(ans).not.toMatch(LEAK);
  });
});

describe("KB fast-path — web (flag-absent) answers are unchanged from today", () => {
  it("web 'How do I upgrade to Pro?' still returns the original upgrade/billing/pricing copy", () => {
    const web = localAnswer("How do I upgrade to Pro?"); // no native flag
    expect(web).not.toBeNull();
    // Today's web behavior deliberately routes users to Billing / Pricing.
    expect(web as string).toMatch(/Pro plan|Pricing page|Settings → Billing|Upgrade/i);
  });

  it("web billing answer still points to Settings → Billing (unchanged)", () => {
    const web = localAnswer("cancel subscription") as string;
    expect(web).toContain("Settings → Billing");
  });

  it("native and web answers differ for a leaky entry (proves the swap happens)", () => {
    expect(localAnswer("How do I upgrade to Pro?", true)).not.toBe(
      localAnswer("How do I upgrade to Pro?", false)
    );
  });

  it("a non-leaky entry is identical on web and native (no needless divergence)", () => {
    const q = "How do I create a card?";
    expect(localAnswer(q, true)).toBe(localAnswer(q, false));
  });
});

describe("LLM prompt construction — native guardrail injected, web unchanged", () => {
  const convo = "User: How do I upgrade to Pro?";

  it("native prompt appends the hard no-selling guardrail", () => {
    const p = buildHelpPrompt(convo, true);
    expect(p).toContain(NATIVE_RULES);
    expect(p).toMatch(/NEVER discuss upgrading, pricing/i);
    expect(p).toMatch(/which plan includes it/i);
  });

  it("web prompt does NOT contain the native guardrail (byte-for-byte as today)", () => {
    const web = buildHelpPrompt(convo, false);
    expect(web).not.toContain(NATIVE_RULES);
    // The web prompt is exactly SYSTEM_PROMPT + convo scaffolding, no native rule.
    expect(web).not.toMatch(/NATIVE APP SESSION/);
  });
});

describe("Native fallback contains no selling language", () => {
  it("NATIVE_FALLBACK is clean", () => {
    expect(NATIVE_FALLBACK).not.toMatch(LEAK);
  });
});
