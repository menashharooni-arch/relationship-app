import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, FUNNEL_PATHS, isFunnelPath } from "@/lib/events";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// The whole point of this feature is that the funnel is MEASURED. Every guard
// here exists because the previous attempt shipped a full event vocabulary
// that fired nowhere, and nobody noticed for months.

describe("track() reaches our own database, not just PostHog", () => {
  const events = read("src/lib/events.ts");

  it("fires the first-party sink before the optional PostHog leg", () => {
    // The bug this pins: `if (!KEY) return;` used to be the FIRST line of
    // track(), so with no PostHog key every call in the app was a no-op.
    const body = events.slice(events.indexOf("export function track("), events.indexOf("export function trackCta"));
    const sink = body.indexOf("sendFirstParty");
    const keyGuard = body.indexOf("if (!KEY) return");
    expect(sink, "track() no longer calls the first-party sink").toBeGreaterThan(-1);
    expect(keyGuard, "the PostHog key guard vanished").toBeGreaterThan(-1);
    expect(sink, "the PostHog key guard runs BEFORE the first-party sink — events are lost again").toBeLessThan(keyGuard);
  });

  it("pageviews reach the first-party sink too", () => {
    const body = events.slice(events.indexOf("export function trackPageview"));
    expect(body).toContain("sendFirstParty(\"page_viewed\"");
  });

  it("sends exactly five payload keys, none of them a person", () => {
    // The request body is the contract with the ingest route. Pinned as an
    // exact set rather than a banned-word scan so ADDING a field is what
    // fails, which is how a name or an email would actually get in here.
    const body = events.slice(events.indexOf("function sendFirstParty"), events.indexOf("let ph:"));
    const payload = body.slice(body.indexOf("JSON.stringify({"), body.indexOf("})", body.indexOf("JSON.stringify({")));
    const keys = [...payload.matchAll(/^\s*(\w+)[,:]/gm)].map((m) => m[1]);
    expect(new Set(keys)).toEqual(new Set(["name", "props", "sessionKey", "path", "internal"]));
  });
});

describe("the ingest route is a hardened public endpoint", () => {
  const route = read("src/app/api/events/route.ts");

  it("validates the event name against the closed vocabulary", () => {
    expect(route).toContain("KNOWN.has(name)");
    expect(route).toContain("new Set<string>(EVENTS)");
  });

  it("rate-limits by IP", () => {
    expect(route).toContain("isRateLimited(`product-events:");
  });

  it("allow-lists property keys instead of passing the payload through", () => {
    expect(route).toContain("ALLOWED_PROPS");
    // An allow-list that contains an id defeats its own purpose.
    const list = route.slice(route.indexOf("const ALLOWED_PROPS"), route.indexOf("] as const", route.indexOf("const ALLOWED_PROPS")));
    for (const banned of ["cardId", "orgId", "email", "userId"]) {
      expect(list.includes(banned), `ALLOWED_PROPS lets ${banned} through`).toBe(false);
    }
  });

  it("stores neither the IP address nor the User-Agent", () => {
    const insert = route.slice(route.indexOf('from("product_events").insert'), route.length);
    for (const banned of ["ip", "user-agent", "userAgent", "ua"]) {
      expect(insert.toLowerCase().includes(banned.toLowerCase() + ":"), `the insert stores ${banned}`).toBe(false);
    }
  });

  it("marks anything that is not the production deployment as internal", () => {
    // A dev server and a preview build share the production database. Without
    // this, two local `next dev` servers write real-looking page views into
    // the funnel — which is exactly what happened the minute the table existed.
    expect(route).toContain('process.env.VERCEL_ENV !== "production"');
  });

  it("never fails a user action — every path answers ok", () => {
    // No 4xx/5xx anywhere: a rejected event is silently accepted so the client
    // never retries, never logs, and never surfaces anything to a user.
    expect(route).not.toMatch(/status:\s*(4\d\d|5\d\d)/);
  });
});

describe("the funnel pages are an allow-list, not every route", () => {
  it("excludes the public card and Swift Links pages", () => {
    // Those are the highest-traffic routes in the product and already have a
    // counted, bot-filtered table of their own (card_views). Letting them in
    // would make product_events mostly visitor traffic.
    expect(isFunnelPath("/card/johnsmith-acme")).toBe(false);
    expect(isFunnelPath("/links/johnsmith-acme")).toBe(false);
  });

  it("includes the pages that actually are the funnel", () => {
    for (const p of ["/", "/pricing", "/upgrade", "/cards/new"]) {
      expect(isFunnelPath(p), `${p} is not counted as a funnel page`).toBe(true);
    }
  });

  it("only lists real routes", () => {
    for (const p of FUNNEL_PATHS) {
      if (p === "/") continue;
      const dir = join(process.cwd(), "src/app", p.slice(1));
      expect(() => readFileSync(join(dir, "page.tsx"), "utf8"), `${p} has no page`).not.toThrow();
    }
  });
});

describe("every step the admin funnel draws can actually fill", () => {
  const client = read("src/app/admin/analytics/AnalyticsClient.tsx");
  const steps = [...client.matchAll(/\{ key: "([a-z_]+)",[^}]*?\}/g)].map((m) => m[0]);

  it("draws at least the core journey", () => {
    expect(steps.length).toBeGreaterThanOrEqual(8);
  });

  // A step whose event is never fired renders as a permanent zero, which reads
  // as "nobody does this" rather than "we never measured it" — the exact lie
  // this whole feature exists to stop telling.
  it("has a live source for every step", () => {
    const src = ["src/lib/events.ts", "src/components/AnalyticsProvider.tsx", "src/components/PlanGate.tsx", "src/components/UpgradeButton.tsx"]
      .map(read)
      .join("\n");
    const appWide = read("src/app/cards/new/NewCardWizard.tsx") + read("src/app/checkout/CheckoutClient.tsx");
    for (const step of steps) {
      const key = /key: "([a-z_]+)"/.exec(step)![1];
      if (step.includes("fromAccounts: true")) continue; // counted from the DB
      expect(EVENTS.includes(key as never), `${key} is not a real event name`).toBe(true);
      const fired = src.includes(`"${key}"`) || appWide.includes(`"${key}"`);
      expect(fired, `the admin funnel draws "${key}" but nothing fires it`).toBe(true);
    }
  });
});

describe("the admin page can name every gate a user can hit", () => {
  it("has plain words for every PlanGate feature key in the product", () => {
    // "Which Pro features they want" is the panel's answer to what to build
    // and what to sell. A key with no entry falls back to the raw slug, which
    // is the one row on that chart nobody can read at a glance.
    const client = read("src/app/admin/analytics/AnalyticsClient.tsx");
    const labelled = new Set(
      [...client.slice(client.indexOf("const GATE_LABEL"), client.indexOf("const gateLabel")).matchAll(/"?([a-z0-9-]+)"?:\s*"/g)].map((m) => m[1]),
    );
    const srcFiles = ["src/app/cards/[id]/edit/CardEditForm.tsx", "src/app/cards/new/NewCardWizard.tsx", "src/app/dashboard/page.tsx"];
    const used = new Set<string>();
    for (const f of srcFiles) {
      for (const m of read(f).matchAll(/feature="([a-z0-9-]+)"/g)) used.add(m[1]);
    }
    expect(used.size, "no PlanGate feature keys found — did the prop get renamed?").toBeGreaterThan(3);
    for (const key of used) {
      expect(labelled.has(key), `GATE_LABEL has no plain-English name for "${key}"`).toBe(true);
    }
  });
});

describe("the migration matches what the code writes", () => {
  const sql = read("supabase/product-events.sql");

  it("is service-role only", () => {
    expect(sql).toContain("alter table product_events enable row level security");
    // RLS with a policy would expose the funnel to the anon key.
    expect(sql).not.toMatch(/create policy/i);
  });

  it("declares every column the ingest route inserts", () => {
    for (const col of ["name", "props", "session_key", "path", "is_internal"]) {
      expect(sql, `product_events is missing ${col}`).toContain(col);
    }
  });

  it("prunes itself", () => {
    expect(sql).toContain("prune_product_events");
  });
});
