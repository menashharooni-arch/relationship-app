import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VIEW_VISIT_WINDOW_MS } from "@/lib/view-window";

// ─────────────────────────────────────────────────────────────────────────────
// ONE VISIT = ONE VIEW = ONE NOTIFICATION; A GENUINE RETURN COUNTS AGAIN.
//
// The audit scenario list this pins: (1) Mina views once → one view; (2) Mina
// returns later → a SECOND view (the old 24h dedup silently erased same-day
// returns); (10)-(12) reload / duplicate tracker / browser retry inside the
// window → still one view; (13) bots and link previews → no view. Every layer
// dedupes on the SAME shared constant so the dashboard, the contact timeline,
// and the push can never disagree about whether a view happened.
// ─────────────────────────────────────────────────────────────────────────────

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const viewsRoute = read("src/app/api/views/[username]/route.ts");
const eventsRoute = read("src/app/api/card-events/route.ts");
const tracker = read("src/components/CardEventTracker.tsx");
const migration = read("supabase/view-visit-window.sql");

describe("one shared visit window", () => {
  it("is 30 minutes", () => {
    expect(VIEW_VISIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it("every dedup layer uses the shared constant — tracker, views, card-events", () => {
    for (const src of [viewsRoute, eventsRoute, tracker]) {
      expect(src).toMatch(/VIEW_VISIT_WINDOW_MS/);
    }
    // No layer keeps a private 24h window anymore.
    expect(viewsRoute).not.toMatch(/24 \* 60 \* 60 \* 1000/);
    expect(eventsRoute).not.toMatch(/6 \* 60 \* 60 \* 1000/);
  });

  it("the database race backstop buckets on the same width (1800s)", () => {
    expect(migration).toMatch(/floor\(extract\(epoch FROM ts\) \/ 1800\)/);
    expect(migration).toMatch(/uq_card_views_visitor_bucket/);
    // The old calendar-day index — the thing that suppressed same-day repeat
    // views at the database even if the app allowed them — must be dropped.
    expect(migration).toMatch(/DROP INDEX IF EXISTS uq_card_views_username_visitor_day/);
  });

  it("card_events gets the same backstop for its two visit-shaped events", () => {
    expect(migration).toMatch(/uq_card_events_visitor_bucket/);
    expect(migration).toMatch(/event_type IN \('viewed_card', 'downloaded_vcard'\)/);
  });
});

describe("the views route validates what it stores", () => {
  it("visitorId and source must be strings, and are length-capped", () => {
    expect(viewsRoute).toMatch(/typeof body\?\.visitorId === "string"[\s\S]{0,120}slice\(0, 64\)/);
    expect(viewsRoute).toMatch(/typeof body\?\.source === "string"[\s\S]{0,120}slice\(0, 48\)/);
  });

  it("a visitor with no id still can't loop the endpoint — one counted view per IP per window", () => {
    expect(viewsRoute).toMatch(/views-anon:\$\{ip\}:\$\{username\}`, 1, VIEW_VISIT_WINDOW_MS/);
  });

  it("the dedup select is ordered so the source upgrade touches THIS visit's row", () => {
    const dedup = viewsRoute.slice(viewsRoute.indexOf("if (visitorId) {"), viewsRoute.indexOf("} else {"));
    expect(dedup).toMatch(/order\("viewed_at", \{ ascending: false \}\)/);
  });

  it("announced prefetch/prerender/preview loads are not people", () => {
    expect(viewsRoute).toMatch(/sec-purpose/);
    expect(viewsRoute).toMatch(/\/prefetch\|prerender\|preview\//);
    // Same guard on the sibling ingest route, so the two tables agree.
    expect(eventsRoute).toMatch(/sec-purpose/);
  });
});

describe("the client tracker fires once per visit, not once per JS context", () => {
  it("keeps last-fire TIMES (a Map), so a later genuine visit in a long-lived tab fires again", () => {
    expect(tracker).toMatch(/lastFired = new Map<string, number>\(\)/);
    expect(tracker).toMatch(/Date\.now\(\) - last < VIEW_VISIT_WINDOW_MS/);
  });

  it("claims its fire-slot only AFTER the awaits — strict-mode's cancelled first mount must not spend it", () => {
    const claim = tracker.indexOf("lastFired.set(");
    const identityAwait = tracker.indexOf("await whenIdentityReconciled()");
    expect(identityAwait).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(identityAwait);
  });

  it("waits out a speculation-rules prerender instead of counting it", () => {
    expect(tracker).toMatch(/doc\.prerendering/);
    expect(tracker).toMatch(/prerenderingchange/);
  });

  it("waits for the account-isolation reconcile before reading visitor identity", () => {
    // The first tracked view after an account switch used to ship the
    // PREVIOUS person's visitor id/identity blob because the guard's wipe ran
    // in a later microtask than the tracker's effect.
    const barrier = tracker.indexOf("whenIdentityReconciled");
    const readsId = tracker.indexOf("getVisitorId()");
    expect(barrier).toBeGreaterThan(-1);
    expect(readsId).toBeGreaterThan(barrier);
  });

  it("declares the surface explicitly so the links page can carry real ?source= attribution", () => {
    expect(tracker).toMatch(/surface: viewSurface/);
    const links = read("src/app/links/[username]/page.tsx");
    expect(links).toMatch(/sourceParam \?\? "swift_links"/);
    // Resolved slug, not the raw route param — a case/alias divergence would
    // record rows under a key the dashboard never reads.
    expect(links).toMatch(/\(cardOrLegacy\.username as string\) \|\| username/);
  });

  it("a repeated ?source= query param can no longer fail the insert", () => {
    const card = read("src/app/card/[username]/page.tsx");
    expect(card).toMatch(/Array\.isArray\(rawSource\) \? rawSource\[0\] : rawSource/);
  });
});

describe("card_views stays service-role only", () => {
  it("the migration enables RLS with no policies", () => {
    expect(migration).toMatch(/ALTER TABLE public\.card_views ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*card_views/);
  });

  it("the office analytics RPCs are revoked from anon/authenticated", () => {
    // SECURITY INVOKER + default EXECUTE TO PUBLIC exposed them through
    // PostgREST: anyone with the anon key could read ANY card's stats by
    // posting arbitrary p_keys.
    for (const fn of [
      "office_employee_view_stats",
      "office_employee_lead_stats",
      "office_employee_contact_stats",
      "office_daily_views",
      "office_traffic_sources",
    ]) {
      expect(migration).toContain(`'${fn}'`);
    }
    expect(migration).toMatch(/FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE EXECUTE ON FUNCTION public\.office_unique_visitors/);
  });
});

describe("milestones follow real views", () => {
  const milestones = read("src/lib/milestones.ts");

  it("fire on the highest milestone REACHED, not an exact landing — concurrent views can jump the count", () => {
    expect(milestones).toMatch(/MILESTONE_COUNTS\.find\(\(c\) => \(count \?\? 0\) >= c\)/);
  });

  it("exclude seeded demo rows without dropping NULL-visitor rows", () => {
    expect(milestones).toMatch(/visitor_id\.is\.null,visitor_id\.not\.like\.\$\{SEEDED_VISITOR_PREFIX\}%/);
  });
});
