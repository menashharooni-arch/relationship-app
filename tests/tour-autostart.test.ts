import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// A new account must be shown the tour on its first dashboard load, on every
// plan. That broke because the trigger was split across TWO flags: a redirect
// had to set welcome=1 AND remember tour=1, and two of them didn't.
//
//   onboarding      → /dashboard?welcome=1                  (free signup)
//   checkout/success→ /dashboard?upgraded=true&welcome=1    (paid signup)
//
// Both marked the account as new; neither started the tour. Only the guest-card
// path worked, because it routes through /welcome which appends tour=1.
//
// The fix makes welcome=1 sufficient. These tests hold that, and hold that every
// new-account exit still carries a marker the component acts on — so a future
// signup path gets the tour by default instead of silently missing it.

const AUTOSTART = "src/components/TourAutoStart.tsx";

describe("the tour starts for a brand-new account", () => {
  it("welcome=1 alone is enough to trigger it", () => {
    // If this reverts to requiring tour=1, free and paid signups silently stop
    // getting the tour again — with nothing visibly broken.
    const src = read(AUTOSTART);
    expect(src).toMatch(/params\.get\("welcome"\) === "1"/);
    expect(src).toMatch(/params\.get\("tour"\) === "1"\s*\|\|\s*params\.get\("welcome"\) === "1"/);
  });

  it("tour=1 still works on its own, for deliberate replays", () => {
    // "Take a tour" in Settings and the office-creation redirect use tour=1 for
    // an EXISTING user, who has no welcome=1.
    expect(read(AUTOSTART)).toContain('params.get("tour") === "1"');
  });

  it("it still refuses to replay for someone who already toured", () => {
    expect(read(AUTOSTART)).toMatch(/if \(tourCompleted\(\)\) return;/);
  });

  it("it still waits for the app-store popup instead of opening underneath it", () => {
    // Ordering matters: the popup shows on a fresh welcome load, and the tour
    // must start after it's dismissed, not behind it.
    const src = read(AUTOSTART);
    expect(src).toContain("sc:appstore-done");
    expect(src).toMatch(/popupPending/);
  });
});

describe("every new-account redirect carries a marker the tour acts on", () => {
  // The real regression was a redirect that marked a new account without a
  // trigger. Each entry is a path a brand-new account can land on.
  for (const [label, file] of [
    ["free signup (onboarding)", "src/app/onboarding/page.tsx"],
    ["paid signup (checkout success)", "src/app/checkout/success/page.tsx"],
    ["guest-card claim (welcome)", "src/app/welcome/page.tsx"],
  ] as const) {
    it(`${label} sends the dashboard a welcome=1 or tour=1`, () => {
      const src = read(file);
      const dashboardRedirects = [...src.matchAll(/["'`]\/dashboard\?([^"'`]*)["'`]/g)].map((m) => m[1]);
      expect(dashboardRedirects.length, `${file} should redirect to /dashboard with params`).toBeGreaterThan(0);
      for (const q of dashboardRedirects) {
        expect(q, `${file} → /dashboard?${q} would skip the tour`).toMatch(/welcome=1|tour=1/);
      }
    });
  }
});
