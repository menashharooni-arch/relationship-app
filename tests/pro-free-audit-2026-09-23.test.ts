import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLockedLead } from "@/lib/lead-access";
import { LOCKED_LEAD_TAG } from "@/lib/plan";

// Pro/Free audit, 2026-09-23 — the fixes the owner asked for, pinned.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a lead locked behind the Free cap cannot be reached by id", () => {
  it("isLockedLead reads the sc-locked tag", () => {
    expect(isLockedLead({ tags: [LOCKED_LEAD_TAG] })).toBe(true);
    expect(isLockedLead({ tags: ["demo"] })).toBe(false);
    expect(isLockedLead({ tags: null })).toBe(false);
    expect(isLockedLead(null)).toBe(false);
  });

  // EVERY route that reads, edits or contacts a lead by id — owner rule: a
  // change lands everywhere it applies, not in the three routes found first.
  it.each([
    "src/app/api/card-events/route.ts",
    "src/app/api/leads/[id]/message/route.ts",
    "src/app/api/leads/share-card/route.ts",
    "src/app/api/sms/send/route.ts",
    "src/app/api/leads/[id]/link/route.ts",
  ])("%s refuses a locked lead to a Free account", (f) => {
    expect(read(f)).toMatch(/isLockedLead\(lead\) && !\(await isPaidUser\(user\.id\)\)/);
  });

  it("the lead editor refuses a locked lead to a Free account", () => {
    expect(read("src/app/api/leads/[id]/route.ts")).toMatch(/isLockedLead\(target\) && !\(await isPaidUser\(user\.id\)\)/);
  });

  it("the follow-up drafter refuses a locked lead to a Free account", () => {
    expect(read("src/app/api/leads/[id]/generate-sequence/route.ts")).toMatch(/isLockedLead\(lead\) && !isPaidPlan\(profile\?\.plan\)/);
  });

  it("the message route guards BOTH the thread read and the send", () => {
    const src = read("src/app/api/leads/[id]/message/route.ts");
    expect(src.match(/isLockedLead\(lead\)/g)?.length).toBe(2);
  });
});

describe("AI follow-ups are Pro-only", () => {
  it("the suggest endpoint has no Free allowance", () => {
    const src = read("src/app/api/ai/suggest-messages/route.ts");
    expect(src).toMatch(/if \(!paid\) \{/);
    expect(src).not.toMatch(/bumpUsage|FREE_AI_DRAFTS/);
  });

  it("the 'AI writes each message' note is shown to Pro only", () => {
    expect(read("src/components/ContactsClient.tsx")).toMatch(/\{isPro && <div[^>]*>\s*<svg[\s\S]{0,1200}The AI writes each message/);
  });
});

describe("an App Store subscriber's referral claim never burns their months", () => {
  const src = read("src/lib/referral-server.ts");

  it("the claim refuses BEFORE consuming any signups", () => {
    const refuse = src.indexOf("billed through the App Store");
    const consume = src.indexOf("Consume the OLDEST unclaimed valid signups");
    expect(refuse).toBeGreaterThan(0);
    expect(refuse).toBeLessThan(consume);
  });

  it("the grant throws (so the claim is released) instead of returning silently", () => {
    expect(src).toMatch(/isApplePaid\(p\.customization\)\) throw new Error/);
  });
});

describe("the dashboard's Add card trial offer asks the same question checkout does", () => {
  it("uses trialHistoryFor, which includes a friend's free month on offer", () => {
    expect(read("src/app/dashboard/page.tsx")).toMatch(/isProTrialEligible\([^;]*trialHistoryFor\(user\.id, user\.email\)/);
  });
});
