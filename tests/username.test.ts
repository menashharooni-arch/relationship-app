import { describe, it, expect } from "vitest";
import { normalizeSlug, ensureUniqueUsername } from "@/lib/username";

describe("normalizeSlug — safe [a-z0-9-] URL slug", () => {
  it("lowercases, hyphenates spaces/punctuation, collapses + trims hyphens", () => {
    expect(normalizeSlug("Aaron Lavi")).toBe("aaron-lavi");
    expect(normalizeSlug("Malve Capital, LLC.")).toBe("malve-capital-llc");
    expect(normalizeSlug("  --Weird__Name!!  ")).toBe("weird-name");
  });

  it("strips characters that would break Supabase .or() filters", () => {
    expect(normalizeSlug("a,b.c(d)e")).toBe("a-b-c-d-e");
    expect(/^[a-z0-9-]*$/.test(normalizeSlug("Ünïcödé & symbols #1"))).toBe(true);
  });

  it("caps at 60 chars with no trailing hyphen", () => {
    const s = normalizeSlug("x".repeat(80));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("empty / junk input yields empty (caller supplies a fallback)", () => {
    expect(normalizeSlug("")).toBe("");
    expect(normalizeSlug("   ")).toBe("");
    expect(normalizeSlug("!!!")).toBe("");
  });
});

// A tiny fake admin client that reports a fixed set of taken slugs. Mirrors the
// chain ensureUniqueUsername uses: from(table).select().eq("username",v).limit().maybeSingle().
function fakeAdmin(taken: Set<string>) {
  return {
    from() {
      let wanted = "";
      const chain: Record<string, unknown> = {
        select() { return chain; },
        eq(_col: string, val: string) { wanted = val; return chain; },
        limit() { return chain; },
        async maybeSingle() { return { data: taken.has(wanted) ? { id: "x" } : null }; },
      };
      return chain;
    },
  } as unknown as Parameters<typeof ensureUniqueUsername>[1];
}

describe("ensureUniqueUsername — never blocks, always returns a free slug", () => {
  it("returns the base when it's free", async () => {
    const out = await ensureUniqueUsername("aaron-lavi", fakeAdmin(new Set()));
    expect(out).toBe("aaron-lavi");
  });

  it("appends -2, -3… when the base (and variants) are taken", async () => {
    const out = await ensureUniqueUsername("aaron-lavi", fakeAdmin(new Set(["aaron-lavi", "aaron-lavi-2"])));
    expect(out).toBe("aaron-lavi-3");
  });

  it("falls back to 'card' for empty/junk bases", async () => {
    const out = await ensureUniqueUsername("!!!", fakeAdmin(new Set()));
    expect(out).toBe("card");
  });

  it("treats a profile-handle collision as taken too", async () => {
    // Same slug used by a profiles.username → must skip it. fakeAdmin doesn't
    // distinguish tables, so a taken slug models either source.
    const out = await ensureUniqueUsername("john", fakeAdmin(new Set(["john"])));
    expect(out).toBe("john-2");
  });
});
