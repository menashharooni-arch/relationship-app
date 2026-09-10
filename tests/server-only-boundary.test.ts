import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// ── The service-role key must never be on a path the browser can follow ─────
//
// `import "server-only"` is the React-official marker for this. It was tried
// here and REMOVED, because measured rather than assumed it does nothing: with
// Turbopack (Next 16) a client component that imports and CALLS
// getAdminSupabase builds with exit code 0, ships, and loads in a real browser
// with no build error and no console error. It also broke vitest, which
// resolves the package to its throwing path and took every suite that touches
// a server module down with it.
//
// This test is the enforcement. It walks the import graph out of every
// "use client" entry point and fails if any of them can reach a server-only
// module. It runs in CI on every push, it names the offending chain, and it
// does not depend on bundler behaviour.
//
// Two real violations existed when this was written — office-leads and
// office-team, each reached by a client component pulling out a display
// constant. Nothing had leaked (Next never inlines a non-NEXT_PUBLIC_ env var
// into client code, so the key itself could not travel, and the build
// tree-shook the rest) but the boundary was held by an optimisation. The
// constants now live in lib/lead-status and lib/member-status.

const SRC = resolve(process.cwd(), "src");

/** Modules that must never be reachable from a client bundle. */
const SERVER_ONLY = ["src/lib/supabase-admin.ts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

const ALL = walk(SRC);
const rel = (p: string) => p.replace(process.cwd() + "/", "");

/**
 * The modules this file imports FOR THEIR VALUES.
 *
 * `import type { X } from "y"` is erased by the compiler and cannot pull
 * anything into a bundle, so it is skipped. A statement with inline `type`
 * specifiers (`import { a, type B } from "y"`) still imports the module for
 * real and is counted.
 */
function valueImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs: string[] = [];
  const re = /^\s*import\s+(type\s+)?([\s\S]*?)from\s+["']([^"']+)["']/gm;
  for (const m of src.matchAll(re)) {
    if (m[1]) continue; // `import type … from` — erased
    specs.push(m[3]);
  }
  // Bare side-effect imports: `import "./x"`.
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]);
  return specs;
}

/** Resolve an import specifier to a file in src, or null if it leaves src. */
function resolveSpec(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules — not ours
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

const CLIENT_ENTRIES = ALL.filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));

describe("nothing the browser loads can reach the service-role database client", () => {
  it("finds the client components to check", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(CLIENT_ENTRIES.length, "no \"use client\" files found — did the scan break?").toBeGreaterThan(50);
  });

  it("has the server-only modules it is protecting", () => {
    for (const f of SERVER_ONLY) {
      expect(existsSync(resolve(process.cwd(), f)), `${f} moved — update SERVER_ONLY`).toBe(true);
    }
  });

  it("no client component can reach one, however many hops away", () => {
    const forbidden = new Set(SERVER_ONLY.map((f) => resolve(process.cwd(), f)));
    const violations: string[] = [];

    for (const entry of CLIENT_ENTRIES) {
      // Breadth-first so the chain reported is the shortest one.
      const seen = new Set<string>([entry]);
      const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [rel(entry)] }];
      while (queue.length) {
        const { file, chain } = queue.shift()!;
        for (const spec of valueImports(file)) {
          const target = resolveSpec(spec, file);
          if (!target || seen.has(target)) continue;
          seen.add(target);
          const nextChain = [...chain, rel(target)];
          if (forbidden.has(target)) { violations.push(nextChain.join("\n     → ")); break; }
          queue.push({ file: target, chain: nextChain });
        }
      }
    }

    expect(
      violations,
      `A client bundle can reach the service-role database client.\n\n` +
        violations.map((v) => `  ${v}`).join("\n\n") +
        `\n\nMove the value the client needs into a module with no server imports ` +
        `(see lib/lead-status.ts and lib/member-status.ts), or make it a \`import type\` if it is only a type.`,
    ).toEqual([]);
  });

  it("nobody re-adds the marker that does not work here", () => {
    // `import "server-only"` was tried and removed: under Turbopack it fails
    // to stop anything (a client component that imports AND CALLS
    // getAdminSupabase builds and runs clean), and it breaks vitest, which
    // resolves the package to its throwing path. Re-adding it would take the
    // whole suite down while adding no protection.
    const src = readFileSync(resolve(process.cwd(), "src/lib/supabase-admin.ts"), "utf8");
    expect(/^\s*import "server-only";/m.test(src), "server-only is back — it breaks the test runner and guards nothing").toBe(false);
  });
});
