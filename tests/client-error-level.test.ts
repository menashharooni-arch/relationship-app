import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// STRUCTURAL GUARD.
//
// /api/client-error funnels straight into reportError, which is the production
// error log and (once ALERT_WEBHOOK_URL is set) the real-time alert channel. It
// used to report EVERY post regardless of level, so the hourly uptime probe —
// which posts {level:"info"} purely to prove the endpoint is still alive — became
// the only thing in the production error log: 13 events, 7 distinct "users", all
// self-inflicted.
//
// The reason this is a guard and not just a fix: the Sentry rollback watchdog
// triggers on an event count AND a distinct-user count. A steady drip of fake
// errors from our own monitoring has exactly the shape of a bad deploy, so the
// monitoring was capable of rolling back a healthy release. Monitoring that
// manufactures its own incidents is worse than no monitoring.

const src = readFileSync(join(process.cwd(), "src/app/api/client-error/route.ts"), "utf8");

// Prose about the bug is not the fix. The comment above the guard describes
// levels and reportError at length, so scanning the raw file would pass on the
// explanation alone.
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("/api/client-error only logs things that are actually errors", () => {
  it("reads the level off the request", () => {
    expect(code, "the route no longer looks at `level`").toMatch(/body\.level/);
  });

  it("returns early for anything that is not error/fatal", () => {
    // The early return must come BEFORE reportError, or the drop does nothing.
    const guardAt = code.search(/level\s*!==\s*["']error["']/);
    const reportAt = code.search(/await\s+reportError\(/);
    expect(guardAt, "no non-error guard found").toBeGreaterThan(-1);
    expect(reportAt, "reportError call not found").toBeGreaterThan(-1);
    expect(guardAt, "reportError runs before the level guard — info still logs")
      .toBeLessThan(reportAt);
  });

  it("still reports when a caller sends no level at all", () => {
    // window.onerror, unhandledrejection and the error boundaries don't set one.
    // Defaulting to anything other than "error" would silently blind the app.
    expect(code, "absent level no longer defaults to error — real errors go missing")
      .toMatch(/body\.level\s*\?\?\s*["']error["']/);
  });

  it("fatal is still reported", () => {
    expect(code, "fatal is being dropped").toMatch(/level\s*!==\s*["']fatal["']/);
  });
});
