import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aiConsentAskAllowedOn } from "@/lib/ai-consent";

// ── In the app: land on the dashboard → AI permission → Allow → the tour ─────
//
// Owner, 2026-09-18: "For every single account with any type of plan that's
// created, the AI consent form should pop up only once they land in their
// dashboard. They press Allow and then after that the tour comes up."
// iPhone app only (owner, same day).
//
// Before this the two raced: TourAutoStart started the tour 0.5s after the
// dashboard mounted while GlobalAiConsent was still fetching whether to ask,
// so the sheet and the tour's first step opened on top of each other.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Seq = typeof import("@/lib/ai-consent-sequence");
async function freshSequence(native: boolean): Promise<Seq> {
  vi.resetModules();
  // detectNativeApp reads the WKWebView bridge the shell installs.
  (globalThis as unknown as { window: unknown }).window = native
    ? { webkit: { messageHandlers: { bridge: {} } } }
    : {};
  return import("@/lib/ai-consent-sequence");
}

describe("afterAiConsent — the order, as behaviour", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("on the website nothing waits: the question is never asked there", async () => {
    const seq = await freshSequence(false);
    const start = vi.fn();
    seq.afterAiConsent(start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("in the app the tour waits while the sheet is open, and starts a beat after Allow", async () => {
    const seq = await freshSequence(true);
    const start = vi.fn();
    seq.reportAiAsk("pending");
    seq.afterAiConsent(start);
    seq.reportAiAsk("asking");
    vi.advanceTimersByTime(60_000); // however long they take to read it
    expect(start).not.toHaveBeenCalled();
    seq.reportAiAsk("settled"); // Allow
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(seq.AFTER_ANSWER_DELAY_MS);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("Don't allow releases the tour too — it is never lost on a no", async () => {
    const seq = await freshSequence(true);
    const start = vi.fn();
    seq.afterAiConsent(start); // a fresh launch starts at "pending"
    seq.reportAiAsk("asking");
    seq.reportAiAsk("settled");
    vi.advanceTimersByTime(seq.AFTER_ANSWER_DELAY_MS);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("an account that already answered (or has nothing to ask) gets the tour straight away", async () => {
    const seq = await freshSequence(true);
    seq.reportAiAsk("settled");
    const start = vi.fn();
    seq.afterAiConsent(start);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("a read that never answers does not hold the tour forever", async () => {
    const seq = await freshSequence(true);
    const start = vi.fn();
    seq.afterAiConsent(start);
    vi.advanceTimersByTime(seq.AI_ASK_FALLBACK_MS);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("starts once, and a cancelled wait never starts", async () => {
    const seq = await freshSequence(true);
    const once = vi.fn();
    seq.afterAiConsent(once);
    seq.reportAiAsk("settled");
    seq.reportAiAsk("pending");
    seq.reportAiAsk("settled");
    vi.advanceTimersByTime(seq.AI_ASK_FALLBACK_MS * 2);
    expect(once).toHaveBeenCalledTimes(1);

    const seq2 = await freshSequence(true);
    const never = vi.fn();
    const cancel = seq2.afterAiConsent(never);
    cancel();
    seq2.reportAiAsk("settled");
    vi.advanceTimersByTime(seq2.AI_ASK_FALLBACK_MS * 2);
    expect(never).not.toHaveBeenCalled();
  });
});

describe("the wiring", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("the sheet reports whether it is open, after every render, only once native is known", () => {
    const gate = strip(read("src/components/AiConsentGate.tsx"));
    expect(gate).toMatch(/useEffect\(\(\) => \{\s*if \(native\) reportAiAsk\(open \? "asking" : "settled"\);\s*\}\);/);
  });

  it("the consent read marks the question pending before it fetches, and settles on a failed read", () => {
    const g = strip(read("src/components/GlobalAiConsent.tsx"));
    expect(g.indexOf('reportAiAsk("pending")')).toBeGreaterThan(-1);
    expect(g.indexOf('reportAiAsk("pending")')).toBeLessThan(g.indexOf('fetch("/api/account/ai-consent")'));
    expect((g.match(/reportAiAsk\("settled"\)/g) ?? []).length).toBeGreaterThanOrEqual(3); // 401, !ok, network error
  });

  it.each([
    ["src/components/TourAutoStart.tsx", /afterAiConsent\(\(\) => startTour\(\)\)/],
    ["src/components/office/AdminTourAutoStart.tsx", /afterAiConsent\(\(\) => startAdminTour\(\)\)/],
    // The banner re-checks that the tour isn't already running before it shows.
    ["src/components/TourBanner.tsx", /afterAiConsent\(\(\) => \{ pending = setTimeout\(\(\) => \{ if \(!tourRunning\(\)\) setShow\(true\); \}, 1500\)/],
  ])("%s waits for the AI question", (file, pattern) => {
    expect(strip(read(file))).toMatch(pattern);
  });

  it("the dashboard tour no longer starts on a bare timer", () => {
    expect(strip(read("src/components/TourAutoStart.tsx"))).not.toMatch(/setTimeout\(\(\) => startTour\(\), 500\)/);
  });
});

describe("an invited Office member who already had a card is asked on the dashboard too", () => {
  // They finish on /cards/[id]/edit?joined=1, whose only way on is "Go to my
  // dashboard →" (/dashboard?tour=1). That editor is a setup step.
  it("the joined=1 editor is not a place to ask", () => {
    expect(aiConsentAskAllowedOn("/cards/abc/edit", "?joined=1")).toBe(false);
  });
  it("an ordinary editor and the dashboard still are", () => {
    expect(aiConsentAskAllowedOn("/cards/abc/edit", "")).toBe(true);
    expect(aiConsentAskAllowedOn("/dashboard", "?welcome=1&tour=1")).toBe(true);
    expect(aiConsentAskAllowedOn("/dashboard", "?tour=1")).toBe(true);
  });
});
