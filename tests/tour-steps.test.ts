import { describe, it, expect } from "vitest";
import { TOUR_STEPS, resolveTourPath, type TourStep } from "@/lib/tour-steps";

describe("resolveTourPath", () => {
  const dash = TOUR_STEPS.find((s) => s.path === "/dashboard")!;
  // The last settings step ("finish") has no section — a plain settings path.
  const settingsFinish = TOUR_STEPS.find((s) => s.id === "finish")!;
  const settingsCards = TOUR_STEPS.find((s) => s.id === "settings-cards")!;

  it("pins dashboard/contacts steps to the active card", () => {
    expect(resolveTourPath(dash, "work")).toBe("/dashboard?card=work");
    const contacts: TourStep = { id: "x", path: "/contacts", title: "t", body: "b" };
    expect(resolveTourPath(contacts, "alex morgan")).toBe("/contacts?card=alex%20morgan");
  });

  it("settings steps carry their section as a #hash (never a ?card param)", () => {
    // A step with a section opens that SettingsShell panel on arrival.
    expect(resolveTourPath(settingsCards, "work")).toBe("/settings/flows#cards");
    // A section-less settings step (and any card-less call) stays bare.
    expect(resolveTourPath(settingsFinish, "work")).toBe("/settings/flows");
    expect(resolveTourPath(dash, null)).toBe("/dashboard");
  });
});

describe("TOUR_STEPS integrity", () => {
  it("has unique step ids", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every anchored step targets a real data-tour value (non-empty)", () => {
    for (const s of TOUR_STEPS) {
      if (s.anchor !== undefined) expect(s.anchor.length).toBeGreaterThan(0);
    }
  });

  it("the your-card step is genuinely interactive, not a click-to-advance no-op", () => {
    const yourCard = TOUR_STEPS.find((s) => s.id === "your-card");
    expect(yourCard).toBeDefined();
    expect(yourCard!.interactive).toBe(true);
    // Regression guard: the old behaviour just advanced on click without showing
    // anything. It must not come back on this step.
    expect(yourCard!.clickToAdvance).toBeFalsy();
    expect(yourCard!.anchor).toBe("your-card");
  });

  it("a step is never both interactive and click-to-advance", () => {
    for (const s of TOUR_STEPS) {
      expect(s.interactive && s.clickToAdvance).toBeFalsy();
    }
  });
});
