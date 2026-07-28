import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

// "Is this account paid?" must be asked in exactly ONE place: isPaidPlan() in
// src/lib/plan.ts. It was previously spelled out by hand at twelve call sites —
// gates on checkout, card editing, the dashboard, and the Swift Signature among
// them. Every copy was correct at the time, which is precisely the danger: the
// day a tier is added or trial handling changes, isPaidPlan() gets updated and
// the hand-written copies silently don't, so Office users start being treated
// as unpaid on whichever surfaces were missed.
//
// This is the same failure mode as the signature template argument, which was
// reintroduced three separate times before it was pinned by a test.

const PATTERN = /===\s*"pro"\s*\|\|[^\n]*===\s*"enterprise"|===\s*"enterprise"\s*\|\|[^\n]*===\s*"pro"/;

// plan.ts is where the real definition lives — it is the one legitimate site.
const ALLOWED = new Set(["src/lib/plan.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// Comments are stripped first: a file may legitimately DESCRIBE the pattern in
// prose while warning against it, and scanning raw text would flag that comment.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("paid-plan checks have a single source of truth", () => {
  it("no file outside plan.ts hand-rolls the pro/enterprise comparison", () => {
    const offenders = walk(join(root, "src"))
      .filter((f) => !ALLOWED.has(relative(root, f).replace(/\\/g, "/")))
      .filter((f) => PATTERN.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => relative(root, f).replace(/\\/g, "/"));

    expect(
      offenders,
      `Use isPaidPlan() from @/lib/plan instead of comparing plan strings by hand:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("isPaidPlan still covers both paid tiers", () => {
    // Guards the other direction: the helper is only a safe single source of
    // truth while it actually recognises Office (enterprise) as paid. An Office
    // sub-user inherits plan="enterprise", so a regression here would downgrade
    // every sub-user's card, signature and gating at once.
    const plan = readFileSync(join(root, "src/lib/plan.ts"), "utf8");
    const body = plan.slice(plan.indexOf("export function isPaidPlan"));
    expect(body.slice(0, body.indexOf("}"))).toMatch(PATTERN);
  });
});
