import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// resetGuestFlow() is what every "leave for Home" exit calls — the wizard's Home
// link, the marketing nav's Home links, and closing any of the three homepage
// mini builders (card / SwiftLink / signature). It must wipe EVERY localStorage
// key an unfinished guest flow writes, so reopening any of those flows starts
// genuinely blank rather than resurrecting a half-built card.

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    size: () => store.size,
    keys: () => [...store.keys()],
  };
}

// Fresh module instances (the draft store keeps a module-level in-memory cache)
// sharing one localStorage — simulates a page load.
async function freshModules(ls: ReturnType<typeof makeLocalStorage>) {
  vi.resetModules();
  (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
  return {
    reset: await import("@/lib/guest-reset"),
    draft: await import("@/lib/guest-draft"),
    prefill: await import("@/lib/prefill"),
    planIntent: await import("@/lib/plan-intent"),
  };
}

describe("resetGuestFlow — abandoning a guest flow for Home", () => {
  let ls: ReturnType<typeof makeLocalStorage>;
  beforeEach(() => {
    ls = makeLocalStorage();
    (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
  });

  it("clears a fully-populated card draft — text, links, colors AND the image data URLs", async () => {
    const m = await freshModules(ls);
    m.draft.saveDraft({
      payload: {
        username: "acme",
        name: "Ada Lovelace",
        customization: {
          bio: "my bio",
          links: [{ label: "Site", url: "https://example.com" }],
          bgColor: "#101010",
          accentColor: "#ff0000",
          fontFamily: "Georgia, serif",
        },
      },
      images: { logo: "data:image/png;base64,AAA", photo: "data:image/jpeg;base64,BBB" },
      step: 3,
    });
    m.draft.flushDraft();
    expect(m.draft.hasPendingDraft()).toBe(true);

    m.reset.resetGuestFlow();

    expect(m.draft.hasPendingDraft()).toBe(false);
    expect(ls.getItem("swiftcard_guest_draft")).toBeNull();
    // Reopening the wizard (a fresh module instance reading storage) is blank.
    const after = await freshModules(ls);
    expect(after.draft.loadDraft()).toBeNull();
  });

  it("clears the mini-builder sketch, so the preview builders reopen blank", async () => {
    const m = await freshModules(ls);
    m.prefill.writePrefill({ name: "Ada", company: "Acme", headshotUrl: "data:image/jpeg;base64,BBB" });
    expect(m.prefill.consumePrefill()).not.toBeNull();

    m.prefill.writePrefill({ name: "Ada", company: "Acme" });
    m.reset.resetGuestFlow();

    expect(ls.getItem("swiftcard_prefill")).toBeNull();
    expect(m.prefill.consumePrefill()).toBeNull();
  });

  it("clears a stashed plan choice", async () => {
    const m = await freshModules(ls);
    m.planIntent.writePlanIntent({ plan: "pro", annual: true });
    expect(m.planIntent.peekPlanIntent()?.plan).toBe("pro");

    m.reset.resetGuestFlow();

    expect(ls.getItem("swiftcard_plan_intent")).toBeNull();
    expect(m.planIntent.peekPlanIntent()).toBeNull();
  });

  it("leaves NOTHING behind across all three keys at once", async () => {
    const m = await freshModules(ls);
    m.draft.saveDraft({ payload: { username: "acme", name: "Ada" }, step: 2 });
    m.draft.flushDraft();
    m.prefill.writePrefill({ name: "Ada" });
    m.planIntent.writePlanIntent({ plan: "free" });
    expect(ls.size()).toBe(3);

    m.reset.resetGuestFlow();

    expect(ls.size()).toBe(0);
  });

  it("cancels a pending debounced draft write, so nothing re-appears after the reset", async () => {
    vi.useFakeTimers();
    try {
      const m = await freshModules(ls);
      // saveDraft debounces its localStorage write (~400ms). Reset immediately,
      // WITHOUT flushing — the queued write must not resurrect the draft.
      m.draft.saveDraft({ payload: { username: "acme", name: "Ada" }, step: 1 });
      m.reset.resetGuestFlow();
      vi.advanceTimersByTime(2000);

      expect(ls.getItem("swiftcard_guest_draft")).toBeNull();
      expect(m.draft.hasPendingDraft()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("only touches these three keys — unrelated app storage survives", async () => {
    const m = await freshModules(ls);
    // e.g. the auth session / analytics ids that live alongside in localStorage.
    ls.setItem("sb-project-auth-token", "session");
    ls.setItem("swiftcard_some_other_pref", "keep me");
    m.draft.saveDraft({ payload: { username: "acme" }, step: 1 });
    m.draft.flushDraft();

    m.reset.resetGuestFlow();

    expect(ls.getItem("sb-project-auth-token")).toBe("session");
    expect(ls.getItem("swiftcard_some_other_pref")).toBe("keep me");
    expect(ls.getItem("swiftcard_guest_draft")).toBeNull();
  });

  it("is safe to call when nothing was ever stored", async () => {
    const m = await freshModules(ls);
    expect(() => m.reset.resetGuestFlow()).not.toThrow();
    expect(ls.size()).toBe(0);
  });
});

// ── Wiring: every "left the flow" exit must actually call the reset ──────────
// resetGuestFlow() only helps if it's hooked up. These assert against the real
// source so a refactor can't silently drop an exit and let a stale draft come
// back as "We kept your work from last time".
describe("resetGuestFlow wiring", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the homepage mounts GuestFlowReset — covers leaving by ANY means (tab close, Back, direct URL)", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("GuestFlowReset");
    const cmp = read("src/components/GuestFlowReset.tsx");
    expect(cmp).toContain("resetGuestFlow()");
    // Must bail out for signed-in users so a pending claim is never destroyed.
    expect(cmp).toContain("isAuthenticated()");
  });

  it("the card wizard's guest Home link resets", () => {
    const src = read("src/app/cards/new/NewCardWizard.tsx");
    expect(src).toContain("resetGuestFlow()");
  });

  it("the marketing nav's Home links reset", () => {
    const src = read("src/components/site/SiteNav.tsx");
    // Desktop + mobile Home links.
    expect(src.match(/resetGuestFlow\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("all three mini builders reset on close", () => {
    for (const f of [
      "src/components/site/CardMiniBuilder.tsx",
      "src/components/site/SwiftLinkMiniBuilder.tsx",
      "src/components/site/SignatureMiniBuilder.tsx",
    ]) {
      const src = read(f);
      expect(src, f).toContain("resetGuestFlow()");
      // Closing must go through the reset, not a bare setOpen(false).
      expect(src, f).toContain("onClose={closeAndReset}");
    }
  });
});
