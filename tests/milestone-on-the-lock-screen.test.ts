import { describe, it, expect, vi, beforeEach } from "vitest";

// The one link between "a view crossed a milestone" and "the phone says so".
//
// Everything either side of it is pinned by source scans (the caller passes
// pushTitle; milestones.ts still writes and pushes nothing). This runs the
// middle: notifyVisit deciding what title to hand the push, and what title to
// leave on the bell row — which must NOT be the same, because the bell row is
// upgraded to the milestone a moment later by its own call and the view row has
// to stay a view row until then.

type Row = Record<string, unknown>;

let openRows: Row[] = [];
const inserted: Row[] = [];
const pushed: Row[] = [];

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => {
      if (table !== "notifications") throw new Error("unexpected table " + table);
      const q = {
        select: () => q,
        in: () => q,
        eq: () => q,
        gte: () => q,
        order: () => q,
        limit: async () => ({ data: openRows }),
        insert: async (row: Row) => { inserted.push(row); return { error: null }; },
        update: async () => ({ error: null }),
      };
      return q;
    },
  }),
}));

vi.mock("@/lib/push", () => ({
  sendPushToUser: async (userId: string, payload: Row) => { pushed.push({ userId, ...payload }); },
}));

import { notifyVisit } from "@/lib/visit-notify";

beforeEach(() => {
  openRows = [];
  inserted.length = 0;
  pushed.length = 0;
});

const view = (extra: Row = {}) => notifyVisit({
  userId: "u1",
  cardOwner: "dana-card",
  visitorId: "v1",
  ip: "1.2.3.4",
  notice: {
    type: "card_viewed",
    pushCategory: "card_view",
    title: "Card viewed",
    body: "Someone viewed your card near Austin.",
    url: "https://swiftcard.me/dashboard?card=dana-card",
    ...extra,
  },
});

describe("a view that crossed a milestone", () => {
  it("puts the celebration on the lock screen and the view sentence under it", async () => {
    const result = await view({ pushTitle: "50 views — on fire!" });
    expect(result).toBe("created");
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({
      category: "card_view",
      title: "50 views — on fire!",
      body: "Someone viewed your card near Austin.",
    });
  });

  it("leaves the bell row saying what it always said", async () => {
    // The milestone's own notifyVisit call upgrades this row a moment later,
    // and that call is what writes the once-ever ledger. Writing the milestone
    // title here as well would make the upgrade a no-op by rank.
    await view({ pushTitle: "50 views — on fire!" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ type: "card_viewed", title: "Card viewed" });
  });

  it("changes nothing at all for an ordinary view", async () => {
    await view();
    expect(pushed[0]).toMatchObject({ title: "Card viewed" });
  });

  it("still cannot push when the notice carries no category — bell-only stays bell-only", async () => {
    await notifyVisit({
      userId: "u1",
      cardOwner: "dana-card",
      visitorId: "v1",
      notice: {
        type: "milestone_50",
        milestone: "milestone_50",
        title: "50 views — on fire!",
        body: "Check Locations on your dashboard.",
        url: "https://swiftcard.me/dashboard",
        // A pushTitle without a pushCategory is nothing to title.
        pushTitle: "50 views — on fire!",
      },
    });
    expect(pushed).toHaveLength(0);
  });
});
