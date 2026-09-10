import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { overlaps, shouldYield, CHAT_AVOID_ATTR } from "@/lib/chat-avoid";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// The floating sales-chat launcher sat on the homepage's primary CTA. Measured
// on the real build at four phone widths: 36.7% of "Start for free" was covered
// on an iPhone 13 Mini, 9.1% on an iPhone 13, and nothing at 360, 393 or 430 —
// the collision follows viewport HEIGHT, which is why it was never reproducible
// by picking a width.

const box = (top: number, left: number, w: number, h: number) => ({
  top,
  left,
  right: left + w,
  bottom: top + h,
});

describe("overlaps", () => {
  it("sees a real overlap", () => {
    expect(overlaps(box(0, 0, 10, 10), box(5, 5, 10, 10))).toBe(true);
  });

  it("does not count touching edges", () => {
    expect(overlaps(box(0, 0, 10, 10), box(0, 10, 10, 10))).toBe(false);
    expect(overlaps(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false);
  });

  it("is symmetric", () => {
    const a = box(100, 100, 40, 40);
    const b = box(120, 90, 30, 30);
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });

  it("separates on either axis alone", () => {
    expect(overlaps(box(0, 0, 10, 10), box(0, 50, 10, 10))).toBe(false);
    expect(overlaps(box(0, 0, 10, 10), box(50, 0, 10, 10))).toBe(false);
  });
});

describe("shouldYield", () => {
  // The real geometry from the iPhone 13 Mini measurement: the launcher is 52px
  // at bottom-5/right-4 and the submit button ran 563→598 down, ending at x=351.
  const launcher = box(557, 307, 52, 52);
  const coveredButton = box(563, 235, 116, 35);

  it("yields when it covers the button", () => {
    expect(shouldYield(launcher, [coveredButton])).toBe(true);
  });

  it("does not yield with nothing to avoid", () => {
    expect(shouldYield(launcher, [])).toBe(false);
  });

  it("does not yield once the page has scrolled the button away", () => {
    const scrolledAway = box(63, 235, 116, 35);
    expect(shouldYield(launcher, [scrolledAway])).toBe(false);
  });

  // A launcher a couple of pixels clear still eats the edge of a finger-sized
  // tap target, and still reads as sitting on the button.
  it("yields when merely crowding, not only when covering", () => {
    // Right edge 4px clear of the launcher: no overlap, well inside the margin.
    const justClear = box(557, 303 - 116, 116, 52);
    expect(overlaps(launcher, justClear)).toBe(false);
    expect(shouldYield(launcher, [justClear])).toBe(true);
  });

  it("respects a zero margin when asked", () => {
    const justClear = box(557, 303 - 116, 116, 52);
    expect(shouldYield(launcher, [justClear], 0)).toBe(false);
  });

  // display:none reports 0x0 at the origin. A launcher near the top-left corner
  // would otherwise "cover" every hidden element on the page and never appear.
  it("ignores elements that are not rendered", () => {
    expect(shouldYield(box(0, 0, 52, 52), [box(0, 0, 0, 0)])).toBe(false);
  });

  it("yields if any one of several zones is hit", () => {
    expect(shouldYield(launcher, [box(0, 0, 10, 10), coveredButton])).toBe(true);
  });
});

describe("the launcher and the pill are actually wired to it", () => {
  const CHAT = read("src/components/site/SalesChat.tsx");
  const CLAIM = read("src/components/site/HeroClaim.tsx");

  it("the hero claim pill opts in", () => {
    expect(CLAIM).toContain(`${CHAT_AVOID_ATTR}=""`);
  });

  it("the launcher measures instead of guessing an offset", () => {
    expect(CHAT).toContain("shouldYield");
    expect(CHAT).toContain(`querySelectorAll(\`[\${CHAT_AVOID_ATTR}]\`)`);
  });

  it("yielding removes the tap target, not just the pixels", () => {
    expect(CHAT).toMatch(/yielding \? "opacity-0 pointer-events-none" : ""/);
    expect(CHAT).toMatch(/aria-hidden=\{yielding \|\| undefined\}/);
    expect(CHAT).toMatch(/tabIndex=\{yielding \? -1 : undefined\}/);
  });

  it("it re-checks on the two things that move a fixed element", () => {
    expect(CHAT).toMatch(/addEventListener\("scroll", schedule, \{ passive: true \}\)/);
    expect(CHAT).toMatch(/addEventListener\("resize", schedule, \{ passive: true \}\)/);
    expect(CHAT).toMatch(/removeEventListener\("scroll", schedule\)/);
    expect(CHAT).toMatch(/removeEventListener\("resize", schedule\)/);
  });

  it("a scroll costs at most one measurement per frame", () => {
    expect(CHAT).toContain("requestAnimationFrame(check)");
    expect(CHAT).toContain("cancelAnimationFrame(frame)");
  });
});
