import { describe, it, expect, vi, beforeEach } from "vitest";

// The auto-rename contract (owner order 2026-08-26): a name/company change
// moves an AUTO-MANAGED slug to the new canonical — and never touches a slug
// the owner hand-picked. Failure of any dependency leaves the slug alone.

const rpcCalls: Array<Record<string, unknown>> = [];
let rpcResult: { data?: unknown; error?: unknown } = { data: { ok: true } };

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    rpc: async (_fn: string, args: Record<string, unknown>) => { rpcCalls.push(args); return rpcResult; },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { customization: {} } }) }) }),
      update: () => ({ eq: async () => ({}) }),
    }),
    storage: { from: () => ({ download: async () => ({ error: true, data: null }), upload: async () => ({}) }) },
  }),
}));

import { autoRenameCardSlug } from "@/lib/auto-rename-slug";

beforeEach(() => { rpcCalls.length = 0; rpcResult = { data: { ok: true } }; });

describe("the card URL follows the card", () => {
  it("renames an auto-managed slug when the company changes", async () => {
    const out = await autoRenameCardSlug({
      cardId: "c1", userId: "u1",
      before: { username: "aaronlavi-malvecapital", name: "Aaron Lavi", company: "Malve Capital" },
      afterName: "Aaron Lavi", afterCompany: "Nadlan Homes",
    });
    expect(out).toBe("aaronlavi-nadlanhomes");
    expect(rpcCalls[0]).toMatchObject({ p_card_id: "c1", p_user_id: "u1", p_new_slug: "aaronlavi-nadlanhomes" });
  });

  it("NEVER touches a hand-picked slug", async () => {
    const out = await autoRenameCardSlug({
      cardId: "c1", userId: "u1",
      before: { username: "cotton", name: "Aaron Lavi", company: "Malve Capital" },
      afterName: "Aaron Levi", afterCompany: "Malve Capital",
    });
    expect(out).toBeNull();
    expect(rpcCalls.length).toBe(0);
  });

  it("does nothing when the canonical is unchanged", async () => {
    const out = await autoRenameCardSlug({
      cardId: "c1", userId: "u1",
      before: { username: "aaronlavi-malvecapital", name: "Aaron Lavi", company: "Malve Capital" },
      afterName: "AARON LAVI", afterCompany: "Malve  Capital",
    });
    expect(out).toBeNull();
    expect(rpcCalls.length).toBe(0);
  });

  it("falls to a numbered variant when the canonical is taken", async () => {
    let call = 0;
    rpcResult = { get data() { return call++ === 0 ? { ok: false, error: "taken" } : { ok: true }; } } as never;
    const out = await autoRenameCardSlug({
      cardId: "c1", userId: "u1",
      before: { username: "aaronlavi-malvecapital", name: "Aaron Lavi", company: "Malve Capital" },
      afterName: "Aaron Lavi", afterCompany: "Summit",
    });
    expect(out).toBe("aaronlavi-summit-2");
  });

  it("a failed RPC leaves the slug alone (save never breaks over the URL)", async () => {
    rpcResult = { error: { message: "boom" } };
    const out = await autoRenameCardSlug({
      cardId: "c1", userId: "u1",
      before: { username: "aaronlavi-malvecapital", name: "Aaron Lavi", company: "Malve Capital" },
      afterName: "Aaron Lavi", afterCompany: "Summit",
    });
    expect(out).toBeNull();
  });
});
