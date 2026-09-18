import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeFreeDesignChanges, convertCustomizationToFreeClosest } from "@/lib/plan";
import { META } from "@/lib/template-style-presets";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("describeFreeDesignChanges names what actually changes", () => {
  it("says nothing at all when nothing changes", () => {
    // The whole moment is built on this: a Free Look, a font, a preset swatch
    // must never raise a panel telling someone their design is about to be
    // replaced. Checked across every curated Look on every template.
    for (const [id, meta] of Object.entries(META)) {
      for (const look of meta.looks) {
        if (look.finish && look.finish !== "sheen" && look.finish !== "halo") continue;
        const cust: Record<string, unknown> = { bgColor: look.bg, textColor: look.text };
        if (look.font) cust.fontFamily = look.font;
        if (look.finish) cust.finish = look.finish;
        if (meta.surface && look.surface) cust.surfaceColor = look.surface;
        expect(describeFreeDesignChanges(cust, id), `${id} / ${look.name}`).toEqual([]);
      }
    }
  });

  it("names the finish by the name shown on the picker", () => {
    const lines = describeFreeDesignChanges({ finish: "brushed" }, "classic-pro");
    expect(lines).toContain("Your Brushed finish becomes Flat");
  });

  it("tells a photo from a video", () => {
    expect(describeFreeDesignChanges({ panelMedia: "https://x/y.jpg", panelMediaType: "image" }, "classic-pro"))
      .toContain("Your background photo is removed");
    expect(describeFreeDesignChanges({ panelMedia: "https://x/y.mp4", panelMediaType: "video" }, "classic-pro"))
      .toContain("Your background video is removed");
  });

  it("collapses several colour swaps into one line", () => {
    const lines = describeFreeDesignChanges(
      { bgColor: "#123456", textColor: "#654321", accentColor: "#abcdef" },
      "classic-pro",
    );
    expect(lines.filter((l) => l.toLowerCase().includes("color"))).toHaveLength(1);
    expect(lines).toContain("Your colors move to the closest free ones");
  });

  it("uses the singular when exactly one colour moves", () => {
    const meta = META["classic-pro"];
    // Every colour but one already free-safe, so only bgColor can move.
    const lines = describeFreeDesignChanges({ bgColor: "#123456", textColor: meta.text.presets[0] }, "classic-pro");
    expect(lines).toContain("One of your colors moves to the closest free one");
  });

  it("calls out the custom designer", () => {
    expect(describeFreeDesignChanges({ customLayout: { blocks: [] } }, "custom"))
      .toContain("Your custom design becomes the Classic Pro template");
  });

  it("never returns an empty list while the converter says something changed", () => {
    // A design key added later with no line of its own would otherwise raise a
    // panel headed "Your card uses Pro design" above nothing at all.
    const cases: Record<string, unknown>[] = [
      { finish: "gilt" },
      { panelDim: 0.5 },
      { font: "legacy-font" },
      { panelMedia: "https://x/y.jpg" },
      { bgColor: "#010203" },
    ];
    for (const c of cases) {
      const { changed } = convertCustomizationToFreeClosest(c, "classic-pro");
      const lines = describeFreeDesignChanges(c, "classic-pro");
      expect(lines.length > 0, `${JSON.stringify(c)} changed=${changed} but produced no lines`).toBe(changed);
    }
  });

  it("does not describe changes to the card's CONTENT", () => {
    const lines = describeFreeDesignChanges(
      { about: "hi", address: "1 Main St", links: [{ label: "a" }], finish: "carbon" },
      "classic-pro",
    );
    expect(lines).toEqual(["Your Carbon finish becomes Flat"]);
  });
});

describe("the wizard decides before it converts", () => {
  const src = read("src/app/cards/new/NewCardWizard.tsx");

  it("asks without touching the card", () => {
    // The bug this replaces: applyFreeDesignConversion() ran the moment Free
    // was clicked, so the card was already rewritten behind a panel that was
    // still asking. "Keep it exactly like this" is only a real offer if
    // nothing has been changed yet.
    const fn = src.slice(src.indexOf("function handleAuthedFirstCardFree"), src.indexOf("function confirmFreeDesignAndCreate"));
    expect(fn).toContain("freeDesignChanges()");
    expect(fn, "the conversion still runs before the question is answered").not.toContain("applyFreeDesignConversion");
  });

  it("converts only once Free is confirmed", () => {
    const fn = src.slice(src.indexOf("function confirmFreeDesignAndCreate"), src.indexOf("function keepDesignWithTrial"));
    expect(fn).toContain("applyFreeDesignConversion()");
  });

  it("asks a GUEST too — on /welcome now, not in the wizard", () => {
    // A guest used to see nothing here and meet the news on /welcome, after the
    // account existed and the card had already been flattened. The wizard grew
    // handleGuestFree/confirmGuestFree to fix that, and they were deleted on
    // 2026-09-15 for a better reason: a guest's answer had nowhere to live but
    // localStorage, and a one-shot read of it is what lost somebody's "Free"
    // and put them on a trial they had declined.
    //
    // So the question moved to where the account exists. The GUARANTEE has not
    // moved and is pinned here either way: a guest is never silently flattened.
    // Follow the asking, not the file.
    expect(src, "the wizard is offering a guest a plan gate again").toContain("!guest && isFirstCard");
    // Called or defined, not merely named: the wizard keeps a comment saying
    // these helpers "lived here and are gone", which is the note that stops
    // someone reinventing them. Matching the bare name would fail on the
    // gravestone and push the next person into deleting the explanation.
    expect(src, "the deleted localStorage plan-intent helpers are back").not.toMatch(/pickPlanThenSignUp\s*\(/);
    expect(src, "the guest plan branch is back in the wizard").not.toMatch(/function (handleGuestFree|confirmGuestFree)\b/);

    const welcome = read("src/components/WelcomePlan.tsx");
    const gate = welcome.slice(welcome.indexOf("function chooseFree"), welcome.indexOf("async function confirmFree"));
    expect(gate, "/welcome settles Free without asking about a Pro design").toContain("proDesignChanges.length");
    expect(gate).toContain("setPendingFreeConfirm(true)");
    expect(welcome, "the panel that names what Free changes is gone").toContain("<FreeDesignChoice");
    // And the answer must actually settle the plan server-side — navigating
    // alone would leave an account whose plan was never decided, which is the
    // state the welcome email refuses to greet.
    expect(welcome).toContain('fetch("/api/account/choose-plan"');
  });

  it("saves the CONVERTED design, not the one React still has in state", () => {
    // THE BUG: confirmFreeDesignAndCreate() called applyFreeDesignConversion()
    // — which is setState — and then handleCreate() in the same tick. Nothing
    // had re-rendered, so the POST carried the untouched Pro design. Every
    // single "lose the designs and continue with Free" sent Pro to the server.
    // It was invisible only because the server re-sanitizes on write; add a
    // chosenPlan alongside it, or relax the sanitizer, and it persists.
    //
    // The fix is structural: the converter hands its result back and the save
    // takes it as an argument, so there is no window in which the two can
    // disagree.
    const fn = src.slice(src.indexOf("function confirmFreeDesignAndCreate"), src.indexOf("function keepDesignWithTrial"));
    expect(fn).toMatch(/const converted = applyFreeDesignConversion\(\)/);
    expect(fn, "the converted design must be handed to the save, not re-read from state")
      .toMatch(/handleCreate\(\s*undefined,\s*\{/);
    expect(fn).toContain("templateStyleState: converted.templateStyleState");
    expect(fn).toContain("linkStyleState: converted.linkStyleState");

    // And the save must actually USE the override rather than the closure.
    expect(src).toMatch(/template: saveTemplate,/);
    expect(src).toMatch(/\.\.\.saveTemplateStyle,/);
    expect(src).toMatch(/\.\.\.saveLinkStyle,/);
  });

  it("converts the Swift Links half too, not just the card", () => {
    // freeDesignChanges() lists the Swift Links Pro features in the dialog
    // (proLinkFeaturesInUse), so the visitor is told a Glass look and photo
    // link buttons will go. The conversion never touched linkStyleState, so
    // the client agreed and then kept them; only the server stripped them.
    const fn = src.slice(src.indexOf("function applyFreeDesignConversion"), src.indexOf("function freeDesignChanges"));
    expect(fn, "LINK_STYLE_KEYS must be stripped client-side as well")
      .toMatch(/for \(const k of LINK_STYLE_KEYS\) delete/);
    expect(fn).toContain("setLinkStyleState(freeLinkStyle)");
  });

  it("reads the card with the ADMIN client, or the question is never asked", () => {
    // Found end to end on 2026-09-16, and invisible to every other check here.
    //
    // /welcome computed proDesignChanges through the SESSION client. `cards` has
    // no owner-read policy, so selecting your own card that way returns an empty
    // list — not an error. So the list was always [], `chooseFree` always took
    // its fast path, and a card built with Pro design was flattened in silence:
    // exactly the outcome this whole step exists to prevent. The code read
    // correctly, the types were fine, and the suite was green.
    //
    // dashboard/page.tsx already had the right shape (getAdminSupabase, scoped
    // by the authenticated id). This pins /welcome to it.
    const page = read("src/app/welcome/page.tsx");
    const cardRead = page.slice(page.indexOf('.from("cards")') - 300, page.indexOf('.from("cards")') + 200);
    expect(cardRead, "/welcome is reading cards through the session client again — RLS returns [] and the panel dies")
      .toMatch(/getAdminSupabase\(\)\s*\n?\s*\.from\("cards"\)/);
    // Still scoped to the caller — the admin client bypasses RLS, so the
    // ownership filter is the only thing keeping this to their own card.
    expect(cardRead).toContain('.eq("user_id", user.id)');
  });

  it("keeps the design by taking the SAME route a Pro pick takes", () => {
    // A guest's Pro intent is what makes the draft claim treat them as paid
    // and keep the design. A bespoke path here would silently stop matching
    // however Pro is sold next.
    const fn = src.slice(src.indexOf("function keepDesignWithTrial"), src.indexOf("function handleAuthedFirstCardPaid"));
    expect(fn).toContain('handleAuthedFirstCardPaid("pro"');

    // Same rule on /welcome, which is where a guest now answers: "keep my card
    // exactly like this" goes through the ordinary checkout call, not a path of
    // its own that could quietly stop matching however Pro is sold next.
    const welcome = read("src/components/WelcomePlan.tsx");
    expect(welcome).toContain('onKeepWithTrial={() => checkout("pro"');
  });
});

describe("no plan chooser offers two different things under one label", () => {
  // ── THE BUG THIS EXISTS FOR, AND WHY IT SHIPPED ANYWAY ────────────────────
  //
  // The Pro button used to read "Start free →" — it starts the free TRIAL,
  // which takes a card and renews. The Free plan's button read "Get started
  // free →". Side by side, nothing told them apart.
  //
  // This describe block already existed and already caught that. It only ever
  // read NewCardWizard.tsx. So the wizard was fixed, the guard passed, and the
  // SAME collision sat untouched on /welcome and /pricing — and /welcome is
  // where a guest who had chosen Free is dropped, and where the stored choice
  // has usually already been consumed, so they are asked again. One tap on the
  // wrong "free" button and they are on a 14-day trial they declined (owner
  // report, 2026-09-15).
  //
  // The lesson is in the scope, not the assertion: a guard aimed at one file
  // protects one file. Every surface that renders a paid CTA beside a free one
  // is checked here now.

  /** A button label, whether written as a plain string or a template literal. */
  const labelAfter = (src: string, prefix: RegExp): string | null => {
    const m = new RegExp(prefix.source + String.raw`\s*[`+ "`" + String.raw`"]([^`+ "`" + String.raw`"]+)`).exec(src);
    return m?.[1] ?? null;
  };

  /** Would a person scanning this button think it is the free plan? */
  const readsAsFreePlan = (label: string) => {
    const l = label.toLowerCase();
    // "free" bound to Pro or to a time limit is fine — "Try Pro free for 14
    // days". A bare "start free" / "get started free" is not.
    if (/\bpro\b/.test(l)) return false;
    if (/\d+\s*days?/.test(l)) return false;
    return /\bfree\b/.test(l);
  };

  it("PlanCards' Pro button never reads as the free plan", () => {
    const label = labelAfter(read("src/components/PlanCards.tsx"), /busy === "pro" \? "Loading…" : trialEligible \?/);
    // The no-trial label names Pro too.
    expect(read("src/components/PlanCards.tsx")).toContain(': "Get Pro →"');
    expect(label, "PlanCards' Pro button label moved — re-point this test").toBeTruthy();
    expect(readsAsFreePlan(label!), `Pro button reads as free: "${label}"`).toBe(false);
  });

  it("the /pricing Pro button never reads as the free plan", () => {
    const label = labelAfter(read("src/app/pricing/page.tsx"), /promoOnPro \? `[^`]+` : trialOk \?/);
    expect(label, "the /pricing Pro button moved — re-point this test").toBeTruthy();
    expect(readsAsFreePlan(label!), `Pro button reads as free: "${label}"`).toBe(false);
    // The no-trial label (an account that already had its free Pro period).
    const noTrial = labelAfter(read("src/app/pricing/page.tsx"), /: trialOk \? `[^`]+` :/);
    expect(noTrial).toBe("Get Pro →");
  });

  it("the Free label differs from the Pro label wherever both are shown", () => {
    const proLabel = labelAfter(read("src/components/PlanCards.tsx"), /busy === "pro" \? "Loading…" :/)!;
    // The DEFAULT is what protects a caller who forgets the prop — which is
    // precisely how /welcome ended up with the collision.
    const defaultFree = /freeLabel = "([^"]+)"/.exec(read("src/components/PlanCards.tsx"))?.[1];
    expect(defaultFree, "PlanCards lost its default free label").toBeTruthy();
    expect(defaultFree).not.toBe(proLabel);

    // …and every caller that does pass one must also differ.
    for (const f of ["src/app/cards/new/NewCardWizard.tsx", "src/components/WelcomePlan.tsx"]) {
      const label = /freeLabel="([^"]+)"/.exec(read(f))?.[1];
      expect(label, `${f} stopped setting a free label`).toBeTruthy();
      expect(label, `${f} reuses the Pro label`).not.toBe(proLabel);
    }
  });

  it("every surface that renders PlanCards is covered by this test", () => {
    // A new caller must not be able to inherit the bug silently. If this fails,
    // add the file to the loop above rather than deleting the assertion.
    const callers = ["src/app/cards/new/NewCardWizard.tsx", "src/components/WelcomePlan.tsx"];
    const found = ["src/app/cards/new/NewCardWizard.tsx", "src/components/WelcomePlan.tsx",
      "src/app/upgrade/UpgradeClient.tsx", "src/app/checkout/CheckoutClient.tsx"]
      .filter((f) => /<PlanCards\b/.test(read(f)));
    expect(found.sort(), "a new <PlanCards> caller appeared — cover it above").toEqual(callers.sort());
  });
});

describe("the panel itself", () => {
  const src = read("src/components/FreeDesignChoice.tsx");

  it("offers a real way out, not just a way forward", () => {
    expect(src).toContain("onContinueFree");
  });

  it("names what Free means for this card (owner, 2026-09-18)", () => {
    expect(src).toContain('"Continue with Free and redesign using free features only"');
  });
});

describe("no way back once Free is picked on a Pro-design card (owner, 2026-09-18)", () => {
  // Two ways on and only two: keep the card exactly as built (the trial), or
  // continue with Free and redesign with free features.
  it("/welcome renders no Back under the panel", () => {
    const welcome = read("src/components/WelcomePlan.tsx");
    const panel = welcome.slice(welcome.indexOf(") : pendingFreeConfirm ? ("), welcome.indexOf("THE plan step"));
    expect(panel).toContain("<FreeDesignChoice");
    expect(panel).not.toMatch(/Back</);
    expect(panel).not.toContain("setPendingFreeConfirm(false)");
  });

  it("/welcome draws the panel even for someone who picked Pro before signing up", () => {
    // "Actually, start on the free plan instead" runs chooseFree, which sets
    // pendingFreeConfirm. The paid-intent screen used to be checked first, so
    // on a Pro-design card the panel was set but never drawn — a dead link.
    const welcome = read("src/components/WelcomePlan.tsx");
    expect(welcome).toContain(") : paidIntent && !pendingFreeConfirm ? (");
    expect(welcome.indexOf("Actually, start on the free plan instead")).toBeGreaterThan(-1);
    expect(welcome).toMatch(/<button onClick=\{chooseFree\}[^>]*>\s*Actually, start on the free plan instead/);
  });

  it("the builder's plan gate hides its Back button while the panel is up", () => {
    const wizard = read("src/app/cards/new/NewCardWizard.tsx");
    expect(wizard).not.toContain("Back to plans");
    expect(wizard).toMatch(/\{!pendingFreeConfirm && \(\s*<button\s+onClick=\{\(\) => setShowPlan\(false\)\}/);
  });
});

describe("the panel itself, continued", () => {
  const src = read("src/components/FreeDesignChoice.tsx");
  it("keeps its reassurance line under the Free button", () => {
    expect(src).toContain("You keep your card, your link, your QR code and everything you typed.");
  });

  it("discloses the trial's billing terms wherever it offers the trial", () => {
    expect(src).toMatch(/card required/);
    expect(src).toMatch(/renews automatically/);
    expect(src).toMatch(/cancel anytime/);
  });

  it("reads the trial length from PLAN config, never typed in", () => {
    expect(src).toContain("TRIAL_DAYS");
    expect(src, "a hardcoded day count will drift from plan.ts").not.toMatch(/\b14[- ]day/i);
  });

  it("says the content is safe on both paths", () => {
    expect(src).toMatch(/Everything you typed is saved/);
    expect(src).toMatch(/You keep your card, your link, your QR code/);
  });
});
