import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WarmVisitor } from "@/lib/visitor-intel";

// ── The rollup that makes an anonymous repeat viewer visible ─────────────────
//
// What these pin, in order of how expensive the mistake would be:
//
//   1. A VISIT IS THE SAME WIDTH EVERYWHERE. card_views already refuses a
//      second row inside VIEW_VISIT_WINDOW_MS, but rows written before that
//      backstop existed (and rows from two different device keys) can still sit
//      minutes apart. If this file counted rows instead of 30-minute buckets,
//      the dashboard would say "came back 4 times" about one person reloading,
//      and the owner would chase a ghost. Bucketing here matches the DB's
//      card_view_bucket() exactly.
//   2. A FREE ACCOUNT NEVER RECEIVES A PLACE NAME — in the payload, not just on
//      the screen. [[free-plan-location-privacy]]
//   3. THE LINKS SURFACE IS THE SAME PERSON. card_views stores Swift Links
//      views as "<slug>__links"; reading only the base slug would drop them.
//   4. THE LIST IS NOT EVERYONE. One drive-by view is traffic, not a lead.

type Row = Record<string, unknown>;

let viewRows: Row[] = [];
let eventRows: Row[] = [];
let leadRows: Row[] = [];

// Shaped like the PostgREST builder the real code awaits: every filter returns
// `this`, and the terminal await resolves to { data, error }.
function table(rows: () => Row[]) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const k of ["select", "in", "gte", "order", "limit", "eq"]) builder[k] = self;
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows(), error: null });
  return builder;
}

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabase: () => ({
    from: (name: string) =>
      table(() => (name === "card_views" ? viewRows : name === "card_events" ? eventRows : leadRows)),
  }),
}));

// Static import: vi.mock is hoisted above it, so the mocked admin client is
// already in place when the module under test is evaluated.
import { warmVisitors, warmOnly } from "@/lib/visitor-intel";

const T0 = Date.parse("2026-09-15T12:00:00.000Z");
const at = (msFromT0: number) => new Date(T0 + msFromT0).toISOString();
const MIN = 60_000;

function view(over: Row = {}): Row {
  return {
    username: "acme",
    visitor_id: "v1",
    viewed_at: at(0),
    source: "qr_code",
    location: "Ithaca, NY",
    geo_accuracy: "city",
    ...over,
  };
}

beforeEach(() => {
  viewRows = [];
  eventRows = [];
  leadRows = [];
});

describe("warmVisitors", () => {
  it("counts one visit for reloads inside the 30-minute window", async () => {
    // Three rows, all within half an hour: one person, one visit.
    viewRows = [view({ viewed_at: at(20 * MIN) }), view({ viewed_at: at(10 * MIN) }), view()];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.views).toBe(3);
    expect(v.visits).toBe(1);
  });

  it("counts a genuine return as its own visit", async () => {
    viewRows = [view({ viewed_at: at(90 * MIN) }), view()];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.visits).toBe(2);
    expect(v.firstSeen).toBe(at(0));
    expect(v.lastSeen).toBe(at(90 * MIN));
  });

  it("treats a Swift Links view as the same visitor, and records the surface", async () => {
    viewRows = [view({ username: "acme__links", viewed_at: at(90 * MIN) }), view()];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.visits).toBe(2);
    expect(v.sawLinks).toBe(true);
    // The suffix is storage, not a card name — it must never reach the UI.
    expect(v.cards).toEqual(["acme"]);
  });

  it("gives a paid account the place, and a Free account none of it", async () => {
    viewRows = [view()];
    const [paid] = await warmVisitors(["acme"], { paid: true });
    expect(paid.location).toBe("Ithaca, NY");

    const [free] = await warmVisitors(["acme"], { paid: false });
    expect(free.location).not.toBeNull();
    expect(free.location).not.toContain("Ithaca");
    expect(free.location).not.toContain("NY");
  });

  it("never invents precision: a one-source guess reads as 'near'", async () => {
    viewRows = [view({ geo_accuracy: "city_approx" })];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.location).toBe("Near Ithaca, NY");
  });

  it("attaches the lead when the visitor later shared their details", async () => {
    viewRows = [view()];
    leadRows = [{ id: "lead-1", name: "Dana", visitor_id: "v1" }];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.leadId).toBe("lead-1");
    expect(v.leadName).toBe("Dana");
  });

  it("counts link taps and contact saves, ignoring plain views", async () => {
    viewRows = [view()];
    eventRows = [
      { visitor_id: "v1", event_type: "clicked_link" },
      { visitor_id: "v1", event_type: "clicked_link" },
      { visitor_id: "v1", event_type: "viewed_card" },
      { visitor_id: "v1", event_type: "downloaded_vcard" },
    ];
    const [v] = await warmVisitors(["acme"], { paid: true });
    expect(v.linkTaps).toBe(2);
    expect(v.savedContact).toBe(true);
  });

  it("orders by recency, and drops rows with no visitor id", async () => {
    viewRows = [
      view({ visitor_id: "old", viewed_at: at(-5 * 24 * 60 * MIN) }),
      view({ visitor_id: "new", viewed_at: at(0) }),
      view({ visitor_id: null }),
    ];
    const out = await warmVisitors(["acme"], { paid: true });
    expect(out.map((v: WarmVisitor) => v.visitorId)).toEqual(["new", "old"]);
  });
});

describe("warmOnly", () => {
  it("keeps the returner and the tapper, drops the drive-by and the known contact", async () => {
    viewRows = [
      // came back → keep
      view({ visitor_id: "returner", viewed_at: at(90 * MIN) }),
      view({ visitor_id: "returner" }),
      // one view, nothing tapped → traffic, not a lead
      view({ visitor_id: "driveby" }),
      // one view but tapped a link → keep
      view({ visitor_id: "tapper" }),
      // came back, but we already know who they are → belongs in Contacts
      view({ visitor_id: "known", viewed_at: at(90 * MIN) }),
      view({ visitor_id: "known" }),
    ];
    eventRows = [{ visitor_id: "tapper", event_type: "clicked_link" }];
    leadRows = [{ id: "lead-9", name: "Sam", visitor_id: "known" }];

    const warm = warmOnly(await warmVisitors(["acme"], { paid: true }));
    expect(warm.map((v: WarmVisitor) => v.visitorId).sort()).toEqual(["returner", "tapper"]);
  });
});
