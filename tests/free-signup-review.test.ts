import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Free signup, reviewed live on swiftcard.me (2026-09-22) ─────────────────
//
// Owner: "review everything from when a user … creates their first card …
// choose the free plan … all the way through … the Take a Tour." Each pin is a
// defect seen in a real browser on production, at 390px.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("step 1: the one required field", () => {
  const w = code("src/app/cards/new/NewCardWizard.tsx");

  it("Next with no name takes you TO the field — it sat a phone-screen above the message", () => {
    const fn = w.slice(w.indexOf("function goNextFrom1"), w.indexOf("function goNextFrom1") + 700);
    expect(fn).toMatch(/setNameMissing\(true\)/);
    expect(fn).toMatch(/nameInputRef\.current\?\.scrollIntoView/);
    expect(fn).toMatch(/nameInputRef\.current\?\.focus/);
    expect(w).toMatch(/ref=\{nameInputRef\}/);
    expect(w).toMatch(/aria-invalid=\{nameMissing \|\| undefined\}/);
  });

  it("the error clears as soon as a name is typed — it stayed up after", () => {
    expect(w).toMatch(/if \(nameMissing && e\.target\.value\.trim\(\)\) \{ setNameMissing\(false\); setError\(""\); \}/);
  });

  it("the Socials bio is named like everywhere else", () => {
    expect(w).toContain(">Swift Links bio<");
    expect(w).not.toContain(">Swiftlinks bio<");
  });
});

describe("the logo / headshot cropper", () => {
  it("Cancel and the title are white on its black screen in the light theme", () => {
    // .text-white is remapped near-black under [data-sc-theme=light] with
    // !important, so it cannot be used on this always-black surface.
    const c = code("src/components/CropperLazy.tsx");
    const header = c.slice(c.indexOf("onClick={onCancel}") - 80, c.indexOf("{title}") + 20);
    expect(header).not.toMatch(/text-white/);
    expect(header.match(/color: "#fff"/g)?.length).toBe(2);
  });
});

describe("Social design → Social icons", () => {
  it("the sample chips are LinkedIn, Instagram and YouTube — not \"in\" three times", () => {
    const c = code("src/components/SwiftLinkDesign.tsx");
    const block = c.slice(c.indexOf("Live chips on the Look's own sheet") > -1 ? c.indexOf("Live chips") : c.indexOf('["LinkedIn", "#0A66C2"]'), c.indexOf("ICON_SHAPES.map"));
    expect(block).toMatch(/\["LinkedIn", "#0A66C2"\], \["Instagram", "#E4405F"\], \["YouTube", "#FF0000"\]/);
    expect(block).toMatch(/<PlatformIcon label=\{platform\}/);
    expect(block).not.toMatch(/>\s*in\s*</);
  });
});

describe("/welcome after the plan is chosen", () => {
  const p = code("src/app/welcome/page.tsx");

  it("a Free account that already chose goes to its dashboard — Back offered the chooser again", () => {
    expect(p).toMatch(/\.select\("plan, customization"\)/);
    expect(p).toMatch(/if \(!isPaidPlan\(profile\?\.plan\) && planChosen && !officeTier && sp\.canceled !== "1" && !sp\.plan\) redirect\("\/dashboard"\)/);
  });

  it("the choice itself never reloads the page, so \"Your card is live!\" still shows", () => {
    const w = code("src/components/WelcomePlan.tsx");
    const confirm = w.slice(w.indexOf("async function confirmFree"), w.indexOf("async function startGiftMonth"));
    expect(confirm).toMatch(/setSetupNext\(LANDING\)/);
    expect(confirm).not.toMatch(/router\.refresh|location\.reload/);
  });
});
