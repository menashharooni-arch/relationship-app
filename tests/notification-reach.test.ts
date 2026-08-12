import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Two ways a notification that WAS written still failed to reach the owner.
// Both were confirmed by the notifications audit (2026-08-12) and both are
// invisible in a normal test account, because you need 20+ recent rows or a
// registered push subscription to see either one.
//
//   1. The unread cliff. Every notification query ordered by created_at and
//      took 20. Twenty recent READ rows pushed every older UNREAD one out of
//      the window — it disappeared from the list AND from the badge, which
//      counts only the rows it was handed (NotificationBell.tsx: filter on
//      the fetched array). Ordering unread-first keeps unread rows inside the
//      window no matter how much read history sits on top.
//   2. contact_saved never buzzed. new_lead and the milestones both write a
//      row AND push; contact_saved only wrote the row, so the owner learned
//      someone saved their card the next time they happened to open the
//      dashboard.
//
// These are pinned by reading the source because the failure is in the shape
// of the query and the presence of a call — there is no return value to
// assert on, and a future edit that drops either is silent in every other test.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the unread cliff: unread rows stay inside the fetched window", () => {
  // Every place a capped list of notifications is read. The badge is only ever
  // as correct as the least-ordered of these.
  const sources = [
    "src/app/api/notifications/route.ts",
    "src/app/dashboard/page.tsx",
  ];

  for (const path of sources) {
    it(`${path} orders every capped notifications read unread-first`, () => {
      const src = stripComments(read(path));
      // Each .limit(20) on the notifications table must be preceded by the
      // read-ascending order (false sorts before true in Postgres).
      const reads = src
        .split(/from\("notifications"\)/)
        .slice(1)
        .filter((chunk) => /\.limit\(/.test(chunk));

      expect(reads.length).toBeGreaterThan(0);
      for (const chunk of reads) {
        const upToLimit = chunk.slice(0, chunk.indexOf(".limit("));
        expect(upToLimit, `capped read in ${path} is missing the unread-first order`)
          .toMatch(/\.order\(\s*"read"\s*,\s*\{\s*ascending:\s*true\s*\}\s*\)/);
        // Still newest-first WITHIN each read/unread group.
        expect(upToLimit, `capped read in ${path} lost its created_at order`)
          .toMatch(/\.order\(\s*"created_at"\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/);
      }
    });
  }
});

describe("contact_saved reaches the phone, not just the bell", () => {
  const src = stripComments(read("src/app/api/card-events/route.ts"));

  it("pushes as well as inserting the notification", () => {
    expect(src).toMatch(/insertNotification\(/);
    expect(src).toMatch(/sendPushToUser\(/);
  });

  it("gates the push on the insert having actually written the row", () => {
    // insertNotification returns false when a dedupe index rejected the row as
    // a duplicate. Pushing anyway sends a buzz for a notification this request
    // never created — the exact duplicate the return value exists to prevent.
    const insertIdx = src.indexOf("insertNotification(");
    const pushIdx = src.indexOf("sendPushToUser(");
    expect(insertIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(insertIdx);
    const between = src.slice(insertIdx, pushIdx);
    expect(between, "the push is not gated on the insert's return value")
      .toMatch(/if\s*\(\s*wrote\s*\)/);
  });

  it("a dead push subscription can never fail the event write", () => {
    // The whole POST is already wrapped in a try that returns ok:true, but a
    // throw would skip the response body's shape — and this endpoint is called
    // from the public card page, where a failure is a lost analytics event.
    const pushCall = src.slice(src.indexOf("sendPushToUser("));
    expect(pushCall.slice(0, 400)).toMatch(/\.catch\(/);
  });
});
