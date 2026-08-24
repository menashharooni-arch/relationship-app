import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { KNOWLEDGE, UNDOCUMENTED_ROUTES } from "@/lib/knowledge";
import { buildPrompt, instantAnswer, normalize, visibleDocs } from "@/lib/knowledge/retrieval";
import {
  derivedFacts,
  placeholdersIn,
  CRM_PROVIDER_NAMES,
  PLACEHOLDER_KEYS,
} from "@/lib/knowledge/derived";
import { APP_PERSONA, SALES_PERSONA } from "@/lib/knowledge/personas";
import { PLAN_LIMITS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plan";

// ── The guard that keeps the support assistants honest ──────────────────────
//
// The chatbots used to carry their own hand-written description of the product
// inside two API routes. Shipping a feature never included "and edit both
// prompts", so the bots drifted: they described a Free day-1 follow-up email
// that nothing sends, quoted limits from memory, and named menus that had
// moved. This file makes that drift a build failure instead of a support
// ticket. If you are here because a test went red, the fix is to update
// src/lib/knowledge — not to loosen the assertion.

const root = process.cwd();

/**
 * Comments are not user-facing, and one of them legitimately describes a menu
 * inside STRIPE's dashboard that really is called "Settings → Billing". Same
 * approach as tests/copy-truth.test.ts.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every page route in the App Router, as a URL path. */
function pageRoutes(dir = join(root, "src/app"), base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Route groups "(marketing)" and private "_folders" add no URL segment.
      const segment = entry.startsWith("(") || entry.startsWith("_") ? "" : `/${entry}`;
      out.push(...pageRoutes(full, base + segment));
    } else if (entry === "page.tsx") {
      out.push(base || "/");
    }
  }
  return out;
}

/** All prose the assistants can emit or be grounded in. */
const corpusText = KNOWLEDGE.map((d) =>
  [d.title, d.answer, d.nativeAnswer ?? "", d.detail ?? "", d.triggers.join(" ")].join("\n"),
).join("\n");

describe("knowledge base structure", () => {
  it("has no duplicate doc ids", () => {
    const ids = KNOWLEDGE.map((d) => d.id);
    expect(ids.length, `duplicates: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`).toBe(
      new Set(ids).size,
    );
  });

  it.each(KNOWLEDGE)("$id is well formed", (doc) => {
    expect(doc.title.trim()).not.toBe("");
    expect(doc.answer.trim()).not.toBe("");
    expect(doc.audience.length).toBeGreaterThan(0);
    expect(doc.triggers.length).toBeGreaterThan(0);
    // Triggers are normalized before matching, so apostrophes and hyphens are
    // fine — but a trigger that normalizes to nothing (or that carries capitals
    // the lowercased question can never contain) would silently never match.
    for (const t of doc.triggers) {
      expect(t, `trigger "${t}" in ${doc.id} must be lowercase`).toBe(t.toLowerCase());
      expect(normalize(t).trim(), `trigger "${t}" in ${doc.id} normalizes to nothing`).not.toBe("");
    }
  });

  it("every surface has knowledge to answer from", () => {
    for (const audience of ["visitor", "user", "office-admin"] as const) {
      expect(visibleDocs(KNOWLEDGE, { audience }).length, `${audience} has no docs`).toBeGreaterThan(5);
    }
  });
});

// ── Numbers live in code, never in prose ────────────────────────────────────
// plan.ts is the single source of truth and derived.ts reads it live. A number
// typed into a doc is a number that will be wrong after the next pricing change
// — which is exactly how the old prompts ended up quoting a 25-lead cap.
describe("no plan facts are hardcoded in doc prose", () => {
  const BANNED: [RegExp, string][] = [
    [/\$\s?\d/, "a price — prices come from PLAN_PRICES via derivedFacts()"],
    [/\b\d+\s+(new\s+)?leads?\s+(a|per)\s+month/i, "the lead cap — comes from PLAN_LIMITS"],
    [/\b\d+\s+(ai\s+)?(follow-up\s+)?drafts?\s+(a|per)\s+month/i, "the draft cap — comes from PLAN_LIMITS"],
    [/\b\d+[- ]day\s+(free\s+)?trial/i, "the trial length — comes from TRIAL_DAYS"],
    [/\bminimum\s+\d+\s+seats?/i, "the seat minimum — comes from PLAN_LIMITS"],
    [/\b\d+\s+additional\s+(swift\s+)?links?/i, "the link cap — comes from PLAN_LIMITS"],
  ];

  it.each(KNOWLEDGE)("$id quotes no plan numbers", (doc) => {
    const text = [doc.answer, doc.nativeAnswer ?? "", doc.detail ?? ""].join("\n");
    for (const [pattern, why] of BANNED) {
      expect(text.match(pattern)?.[0] ?? "", `${doc.id} hardcodes ${why}`).toBe("");
    }
  });

  it("the derived block carries those numbers instead", () => {
    const facts = derivedFacts({ commerce: true });
    expect(facts).toContain(`$${(PLAN_PRICES.PRO_MONTHLY_CENTS / 100).toFixed(2)}`);
    expect(facts).toContain(`${PLAN_LIMITS.FREE_LEADS_PER_MONTH} new leads per month`);
    expect(facts).toContain(`${PLAN_LIMITS.FREE_AI_DRAFTS_PER_MONTH} AI follow-up drafts`);
    expect(facts).toContain(`${TRIAL_DAYS}-day free trial`);
    expect(facts).toContain(`at least ${PLAN_LIMITS.OFFICE_MIN_SEATS} seats`);
  });

  it("every placeholder a doc uses actually resolves", () => {
    // A typo'd token is not a silent no-op — fillPlaceholders leaves unknown
    // tokens in place deliberately, so "{limit.leadz}" would ship to a user.
    for (const doc of KNOWLEDGE) {
      const text = [doc.answer, doc.nativeAnswer ?? "", doc.detail ?? ""].join("\n");
      for (const key of placeholdersIn(text)) {
        expect(PLACEHOLDER_KEYS, `${doc.id} uses unknown placeholder {${key}}`).toContain(key);
      }
    }
  });

  it("only commerce docs quote a price placeholder", () => {
    // Native sessions never resolve a price token. A non-commerce doc has no
    // nativeAnswer to fall back on, so it would render "{price.proMonthly}"
    // literally to an app user.
    for (const doc of KNOWLEDGE.filter((d) => !d.commerce)) {
      const text = [doc.answer, doc.nativeAnswer ?? "", doc.detail ?? ""].join("\n");
      expect(
        placeholdersIn(text).filter((k) => k.startsWith("price.")),
        `${doc.id} quotes a price but is not marked commerce: true`,
      ).toEqual([]);
    }
  });

  it("no native answer quotes a price placeholder", () => {
    for (const doc of KNOWLEDGE.filter((d) => d.nativeAnswer)) {
      expect(
        placeholdersIn(doc.nativeAnswer as string).filter((k) => k.startsWith("price.")),
        `${doc.id}'s nativeAnswer would render a raw {price.…} token`,
      ).toEqual([]);
    }
  });

  it("every CRM provider that exists is named to users", () => {
    const facts = derivedFacts({ commerce: true });
    for (const name of Object.values(CRM_PROVIDER_NAMES)) expect(facts).toContain(name);
  });
});

// ── The native guardrail, enforced on the corpus rather than per-answer ─────
// Loosened for the IAP era (3.1.1 remedy, 2026-08): the app now sells Pro via
// In-App Purchase, so subscribe/plan/billing language is legitimate on native.
// What stays banned in a nativeAnswer is (a) steering to web checkout — the
// website, swiftcard.me, the Stripe portal — and (b) hardcoded dollar amounts,
// which must only ever come from StoreKit so the shown price cannot drift from
// the App Store price.
describe("native sessions never receive web-checkout steering", () => {
  const LEAK =
    /\$\d|swiftcard\.me|\bwebsite\b|Pricing page|Settings → Billing|\bStripe\b/i;

  it("every commerce doc carries a clean native answer", () => {
    for (const doc of KNOWLEDGE.filter((d) => d.commerce)) {
      expect(doc.nativeAnswer, `${doc.id} is commerce but has no nativeAnswer`).toBeTruthy();
      expect(doc.nativeAnswer as string, `${doc.id}'s nativeAnswer leaks selling language`).not.toMatch(LEAK);
    }
  });

  it("no commerce doc reaches native context", () => {
    for (const audience of ["user", "office-admin"] as const) {
      const docs = visibleDocs(KNOWLEDGE, { audience, native: true });
      expect(docs.filter((d) => d.commerce)).toEqual([]);
    }
  });

  it("a native prompt contains no prices at all", () => {
    const prompt = buildPrompt({
      corpus: KNOWLEDGE,
      persona: APP_PERSONA,
      convo: "User: how do I get unlimited leads?",
      question: "how do I get unlimited leads?",
      scope: { audience: "user", native: true },
    });
    expect(prompt).not.toMatch(/\$\d/);
    expect(prompt).not.toMatch(/PRICING \(USD/);
  });

  it("a web prompt still contains the pricing block", () => {
    const prompt = buildPrompt({
      corpus: KNOWLEDGE,
      persona: SALES_PERSONA,
      convo: "Visitor: how much is it?",
      question: "how much is it?",
      scope: { audience: "visitor" },
    });
    expect(prompt).toMatch(/PRICING \(USD/);
    expect(prompt).toContain(`$${(PLAN_PRICES.PRO_MONTHLY_CENTS / 100).toFixed(2)}`);
  });

  it("native instant answers for money questions stay clean", () => {
    for (const q of ["how much does pro cost", "upgrade", "billing", "cancel subscription", "pricing"]) {
      const ans = instantAnswer(KNOWLEDGE, q, { audience: "user", native: true });
      if (ans) expect(ans, `native answer to "${q}" leaks`).not.toMatch(LEAK);
    }
  });
});

// ── Coverage: a page that ships without knowledge fails the build ───────────
//
// This is the mechanism that keeps the assistants current. Add a page and this
// test goes red until either a doc mentions its route or the route is listed in
// UNDOCUMENTED_ROUTES with a reason. Deciding is the point; forgetting is not
// an option the build allows.
describe("every user-facing route is either documented or deliberately not", () => {
  const routes = pageRoutes();

  it("finds the app's routes at all (guards the walker itself)", () => {
    expect(routes).toContain("/pricing");
    expect(routes).toContain("/dashboard");
    expect(routes.length).toBeGreaterThan(40);
  });

  it.each(routes)("%s", (route) => {
    if (route in UNDOCUMENTED_ROUTES) {
      expect(UNDOCUMENTED_ROUTES[route].length, `give a reason for ${route}`).toBeGreaterThan(10);
      return;
    }
    // A dynamic route is documented by its static prefix ("/card/" covers
    // "/card/[username]") since the assistant describes the shape, not an id.
    const needle = route.includes("[") ? `${route.slice(0, route.indexOf("["))}` : route;
    expect(
      corpusText.includes(needle),
      `Route ${route} is not mentioned anywhere in src/lib/knowledge.\n` +
        `Either add it to a doc so the assistants can answer questions about it, ` +
        `or add "${route}" to UNDOCUMENTED_ROUTES with a reason.`,
    ).toBe(true);
  });
});

// ── Routes named in docs must exist ─────────────────────────────────────────
describe("no doc sends a user to a page that does not exist", () => {
  const routes = new Set(pageRoutes());
  const prefixes = [...routes].map((r) => (r.includes("[") ? r.slice(0, r.indexOf("[")) : r));

  const referenced = [...corpusText.matchAll(/(?:^|[\s("'])(\/[a-z0-9][a-z0-9/-]*)/g)]
    .map((m) => m[1].replace(/[).,]$/, ""))
    .filter((p) => !p.startsWith("/api/"));

  it("references at least a few routes (guards the matcher)", () => {
    expect(new Set(referenced).size).toBeGreaterThan(5);
  });

  it.each([...new Set(referenced)])("%s exists", (path) => {
    const exists =
      routes.has(path) ||
      prefixes.some((p) => p.length > 1 && path.startsWith(p)) ||
      // Trailing-slash and sub-path forms of a real page.
      routes.has(path.replace(/\/$/, ""));
    expect(exists, `${path} is referenced in the knowledge base but is not a page in src/app`).toBe(true);
  });
});

describe("relative paths stay off the marketing surface's user-facing text", () => {
  it("visitor docs address the site by name, not by bare path", () => {
    // A visitor may be reading the chat on any page; "/pricing" alone is
    // ambiguous in an answer that might get copied elsewhere.
    for (const doc of visibleDocs(KNOWLEDGE, { audience: "visitor" })) {
      const bare = doc.answer.match(/(?:^|\s)\/[a-z-]+/g) ?? [];
      for (const b of bare) {
        expect(
          doc.answer.includes(`swiftcard.me${b.trim()}`),
          `${doc.id} says "${b.trim()}" — write it as swiftcard.me${b.trim()}`,
        ).toBe(true);
      }
    }
  });
});

// ── The labels the assistant quotes must be the labels on screen ───────────
//
// This is the exact failure that prompted the rewrite. The old in-app bot told
// people the card editor had two tabs, "Card info" and "Design". It has four,
// and the second one is called "Card design" — so the one instruction it gave
// most often sent users looking for a tab that isn't there. Reading the labels
// out of the component means a rename breaks the build, not the answer.
describe("card editor tabs are described by their real labels", () => {
  const source = readFileSync(join(root, "src/app/cards/[id]/edit/CardEditForm.tsx"), "utf8");
  const labels = [...source.matchAll(/\{ id: "[a-z]+", label: "([^"]+)"/g)].map((m) => m[1]);

  it("finds the tab list (guards the matcher)", () => {
    expect(labels.length).toBeGreaterThanOrEqual(4);
  });

  it.each(labels)('the corpus mentions the "%s" tab', (label) => {
    expect(
      corpusText.includes(label),
      `The card editor has a tab labelled "${label}" that no doc mentions.`,
    ).toBe(true);
  });

  it("no doc invents a bare 'Design' tab", () => {
    // "Design" alone was the old wrong answer; the real label is "Card design".
    for (const doc of KNOWLEDGE) {
      const text = [doc.answer, doc.nativeAnswer ?? "", doc.detail ?? ""].join("\n");
      expect(text, `${doc.id} says the "Design" tab — it is "Card design"`).not.toMatch(
        /["“]Design["”] tab|the Design tab/,
      );
    }
  });
});

// ── Settings sections, same treatment ──────────────────────────────────────
//
// Settings was regrouped into seven named sections. The old bot still recited
// the six names from before the regroup — "Your cards", "General", "Account",
// "Need help", "Integrations" — none of which are on the screen any more.
describe("settings sections are described by their real labels", () => {
  const source = readFileSync(join(root, "src/app/settings/flows/page.tsx"), "utf8");
  const labels = [...source.matchAll(/^\s{6}label: "([^"]+)",$/gm)].map((m) => m[1]);

  it("finds the section list (guards the matcher)", () => {
    expect(labels).toContain("Cards and sharing");
    expect(labels.length).toBeGreaterThanOrEqual(6);
  });

  it.each(labels)('the corpus mentions the "%s" section', (label) => {
    expect(
      corpusText.includes(label),
      `Settings has a section labelled "${label}" that no doc mentions.`,
    ).toBe(true);
  });

  it("no user-facing string anywhere sends people to 'Settings → Billing'", () => {
    // Not just the assistants: six other places (a checkout error, the office
    // invite seat modal, the join notification) still named the pre-regroup
    // section, so the product disagreed with its own menu. The assistants can
    // only be as right as the app they describe.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry) && stripComments(readFileSync(full, "utf8")).includes("Settings → Billing")) {
          offenders.push(relative(root, full));
        }
      }
    };
    walk(join(root, "src"));
    expect(offenders, `these still say "Settings → Billing"; the section is "Plan and billing"`).toEqual([]);
  });

  it("no answer recites the pre-regroup section names", () => {
    // `answer` only: a doc's `detail` is allowed to say "there is no Danger
    // Zone", which is precisely the correction the assistant needs to hear.
    // What must never happen is an answer DIRECTING someone to one.
    const answers = KNOWLEDGE.map((d) => `${d.answer}\n${d.nativeAnswer ?? ""}`).join("\n");
    for (const gone of ["Your cards", "Need help", "Danger Zone"]) {
      expect(
        answers.includes(gone),
        `An answer sends users to "${gone}", which is not a Settings section any more — see src/app/settings/flows/page.tsx`,
      ).toBe(false);
    }
  });
});

// ── The assistants must stay thin adapters over this corpus ────────────────
//
// The failure mode this whole module exists to prevent is a SECOND description
// of the product living somewhere else. If a route starts carrying its own
// feature prose again, it will drift again.
describe("no assistant route carries its own product description", () => {
  const ROUTES = ["src/app/api/ai/help/route.ts", "src/app/api/ai/sales/route.ts"];

  it.each(ROUTES)("%s defers to src/lib/knowledge", (path) => {
    const src = readFileSync(join(root, path), "utf8");
    expect(src, `${path} should import the shared corpus`).toMatch(/@\/lib\/knowledge/);
  });

  it.each(ROUTES)("%s holds no inline knowledge base", (path) => {
    const src = readFileSync(join(root, path), "utf8");
    expect(src, `${path} has grown its own KB array again`).not.toMatch(/^const KB\b/m);
    expect(src, `${path} has grown its own product prose again`).not.toMatch(/WHAT SWIFTCARD IS/);
  });
});
