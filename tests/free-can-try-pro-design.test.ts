import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import TemplateStyleControls from "@/components/card-templates/TemplateStyleControls";
import { proFeaturesInUse } from "@/lib/plan";

// ── A Free account can try every Pro design control, and is stopped at Save ───
//
// Owner, 2026-09-11: "in the Add a Card button, I want users to be able to use
// custom colors and custom materials for all the pro features, just to see how
// it would look on their card. When they go to press Save Changes, it will say,
// 'You cannot use these features. These are pro features.'"
//
// Every Pro finish, every Look and the photo/video picker already worked that
// way. The one exception was the free-hand colour input — `disabled` on a Free
// account — so the single feature they were being asked to pay for was the
// single one they could not look at. These pin the whole contract, both halves:
// nothing in the panel is dead, and nothing gets past the save.

const markup = (locked: boolean) =>
  renderToStaticMarkup(createElement(TemplateStyleControls, {
    value: {},
    onChange: () => {},
    template: "classic-pro",
    locked,
  }));

describe("the design panel on a Free account", () => {
  const free = markup(true);
  const pro = markup(false);

  it("lets them pick any colour, exactly as a Pro account can", () => {
    const inputs = free.match(/<input[^>]*type="color"[^>]*>/g) ?? [];
    // Name colour, details colour, accent/icons and at least one surface.
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    for (const input of inputs) expect(input).not.toContain("disabled");
    expect(inputs.length).toBe((pro.match(/<input[^>]*type="color"[^>]*>/g) ?? []).length);
  });

  it("does not grey out or swallow taps on the colour row", () => {
    expect(free).not.toContain("pointer-events-none");
    expect(free).not.toContain('aria-disabled="true"');
  });

  it("still says PRO, so nobody gets attached to a colour without being told", () => {
    // The tag is the disclosure that replaces the disabled state. A Pro account
    // has nothing to disclose.
    expect(free).toContain(">PRO<");
    expect(pro).not.toContain(">PRO<");
  });

  it("keeps every finish and Look tappable — the preview IS the demo", () => {
    // A disabled ATTRIBUTE, not the Tailwind `disabled:` class the media
    // button legitimately carries for its own uploading state.
    expect(free.match(/<button[^>]*\sdisabled(=|\s|>)/g)).toBeNull();
  });
});

describe("the wall is at Save Changes, and it holds", () => {
  it("names the custom colour a Free account just tried", () => {
    const features = proFeaturesInUse({ textColor: "#ff3366" }, "classic-pro");
    expect(features).toContain("Your own colors");
  });

  it("names a Pro finish and a background photo too", () => {
    expect(proFeaturesInUse({ finish: "brushed" }, "classic-pro").join(" ")).toMatch(/finish/i);
    expect(proFeaturesInUse({ panelMedia: "https://x/y.jpg" }, "classic-pro")).toContain("Background photo");
  });

  it("stays out of the way when they only used Free things", () => {
    // A preset colour is every plan's to keep — no dialog, no interruption.
    expect(proFeaturesInUse({}, "classic-pro")).toEqual([]);
  });
});
