import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOCIAL_INPUTS, socialHint, socialInput } from "@/lib/social-input";
import { socialUrl } from "@/lib/social-url";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const DESIGN = "src/components/SwiftLinkDesign.tsx";
const WIZARD = "src/app/cards/new/NewCardWizard.tsx";
const EDITOR = "src/app/cards/[id]/edit/CardEditForm.tsx";

// ── The Social design panel is a ROUTE, top to bottom ────────────────────────
//
// Owner order 2026-09-15: "the page header should be first because that will
// set how they design their whole page based off of what they choose… make sure
// the order is very linear and in order of what makes sense."
//
// The header is the one structural choice on the panel (cover / short banner /
// compact circle / none) and it gates the background's photo-video upload, so
// it has to come before the things that depend on it. The rest of the order was
// already settled and is kept: Look, Page background and Text color stay
// adjacent (owner, 2026-09-10), and the accent still lands between the social
// icons and the link buttons.
describe("Social design reads top to bottom", () => {
  const raw = read(DESIGN);
  // Numbered steps name themselves as `label: "…"`; the two colours inside
  // step 3 are still rendered labels (`}>Page background`). Either form
  // marks where a section sits in the source.
  const at = (label: string) => Math.max(raw.indexOf("}>" + label), raw.indexOf(`label: "${label}"`));
  const src = { indexOf: (needle: string) => at(needle.replace(/^}>/, "")) };

  // The rendered section labels, in source order.
  const ORDER = [
    "Page header",
    "Look",
    "Page background",
    "Text color",
    "Font",
    "Social icons",
    "Connect button",
    "Link buttons",
  ];

  it("puts every section in the agreed order", () => {
    const positions = ORDER.map((label) => ({
      label,
      at: at(label),
    }));
    for (const p of positions) {
      expect(p.at, `section "${p.label}" is missing from the panel`).toBeGreaterThan(-1);
    }
    const sorted = [...positions].sort((a, b) => a.at - b.at).map((p) => p.label);
    expect(sorted).toEqual(ORDER);
  });

  it("leads with the structural choice, not a colour", () => {
    // The specific regression: Page header sank below the background, so the
    // upload it gates appeared before the control that unlocks it.
    expect(src.indexOf("}>Page header")).toBeLessThan(src.indexOf("}>Page background"));
    expect(src.indexOf("}>Page header")).toBeLessThan(src.indexOf("}>Look"));
  });

  it("keeps the Look, background and text together", () => {
    // Owner, 2026-09-10 — moving the header must not have split these up.
    const look = src.indexOf("}>Look");
    const bg = src.indexOf("}>Page background");
    const text = src.indexOf("}>Text color");
    const icons = src.indexOf("}>Social icons");
    expect(look).toBeLessThan(bg);
    expect(bg).toBeLessThan(text);
    expect(text).toBeLessThan(icons);
  });

  it("keeps the accent between the social icons and the link buttons", () => {
    const icons = src.indexOf("}>Social icons");
    const connect = src.indexOf("}>Connect button");
    const links = src.indexOf("}>Link buttons");
    expect(icons).toBeLessThan(connect);
    expect(connect).toBeLessThan(links);
  });
});

// ── One answer to "what do I type here?" ────────────────────────────────────
//
// Owner report 2026-09-15: "LinkedIn: do they just type their name in, or do
// they have to type out linkedin.com/in/their name?" The placeholders used to
// disagree — a URL on LinkedIn/Facebook/YouTube, an @handle on the rest.
describe("every social box asks for the same thing", () => {
  it("covers exactly the platforms a card can carry", () => {
    expect(SOCIAL_INPUTS.map((s) => s.key)).toEqual([
      "linkedin", "instagram", "tiktok", "facebook", "twitter", "snapchat", "youtube",
    ]);
  });

  it("never asks for a URL in the box", () => {
    for (const s of SOCIAL_INPUTS) {
      expect(s.placeholder, `${s.key} placeholder still asks for a URL`).not.toMatch(/\.com|https?:|\//);
      expect(s.placeholder, `${s.key} placeholder still shows an @`).not.toMatch(/@/);
    }
  });

  it("shows what the username becomes, per platform", () => {
    for (const s of SOCIAL_INPUTS) {
      const hint = socialHint(s);
      expect(hint).toContain("Just your username");
      expect(hint).toContain(s.stem);
      // …and the stem has to be the address we ACTUALLY build, or the hint lies.
      const built = socialUrl(s.key, s.example);
      expect(built, `${s.key} builds no URL from a plain username`).toBeTruthy();
      expect(built!.replace(/^https?:\/\//, "")).toBe(`${s.stem}${s.example}`);
    }
  });

  it("is the single source both editors read", () => {
    for (const [name, src] of [["wizard", read(WIZARD)], ["editor", read(EDITOR)]] as const) {
      expect(src, `${name} does not use the shared spec`).toMatch(/SOCIAL_INPUTS/);
      expect(src, `${name} still hardcodes its own placeholder list`).not.toMatch(/placeholder: "@username"/);
      expect(src, `${name} still tells people to paste a URL`).not.toMatch(/Paste a profile URL or type an @handle/);
    }
  });

  it("has a spec for every key it claims", () => {
    expect(socialInput("snapchat")?.stem).toBe("snapchat.com/add/");
    expect(socialInput("twitter")?.stem).toBe("x.com/");
    expect(socialInput("nope")).toBeUndefined();
  });
});

// ── The website's card builder is not where you meet the freeform canvas ────
//
// Owner order 2026-09-15: "Through the website, when someone is creating their
// card they shouldn't have access to open custom design." A guest has no
// account, and the designer's own scan/upload paths need a session.
describe("a guest never reaches the custom designer", () => {
  const src = read(WIZARD);

  it("gates the tile on a separate flag, not on designUnlocked", () => {
    expect(src).toMatch(/const customDesignAvailable = designUnlocked && !guest;/);
    // The picker leaves the row out for a guest (shared TemplatePicker since
    // the Card design tab rebuild), and the canvas, docked preview and step-2
    // canvas mode all read the new flag.
    expect(src).toMatch(/hideCustom=\{guest\}/);
    expect(src).toMatch(/customUnlocked=\{customDesignAvailable\}/);
    expect(src).toMatch(/customSelected && customDesignAvailable \?/);
    expect(src).toMatch(/designerIsCanvas = step === 2 && customSelected && customDesignAvailable/);
  });

  it("the picker hides the row only when asked, so the card editor keeps it", () => {
    const picker = read("src/components/card-templates/TemplatePicker.tsx");
    expect(picker).toMatch(/hideCustom = false/);
    expect(picker).toMatch(/\{!hideCustom && \(/);
    expect(read(EDITOR)).not.toMatch(/hideCustom/);
  });

  it("never restores a guest onto the custom template", () => {
    // A resumed draft or a prefill could otherwise strand them on a design
    // they can no longer open or change.
    const guards = src.match(/guest && p\.template === "custom"/g) ?? [];
    expect(guards.length, "both restore paths must be guarded").toBe(2);
  });

  it("still lets a guest try colours and fonts", () => {
    // The plan preview is the point of the guest flow; only the canvas is held
    // back, so designUnlocked must survive.
    expect(src).toMatch(/const designUnlocked = isPro \|\| guest \|\| isFirstCard;/);
  });
});
