import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visitKey, visitKeys, visitPushTag, VISIT_RANK } from "../src/lib/visit-notify";
import { VIEW_VISIT_WINDOW_MS } from "../src/lib/view-window";

// ── One person, one visit, one notification ──────────────────────────────────
//
// Reported from the field, twice: "someone views my card and I get two
// notifications." Reproduced in production data — this pair landed 0.88s apart
// on the owner's phone from a SINGLE view:
//
//   21:28:02  milestone_5   "First 5 views!"
//   21:28:03  card_viewed   "Aaron Lavi viewed your card near New York, US."
//
// and this one, from a single visitor who viewed and then saved the contact:
//
//   15:50:57  card_viewed   "Someone viewed your card near Great Neck, US."
//   15:51:33  contact_saved "Someone saved your contact card near Great Neck, US."
//
// Each writer deduped only against ITSELF, so three pieces of code could each
// legitimately decide to ring the phone for one person's single visit. The fix
// moves dedupe onto the VISIT: every notification a visitor can cause carries
// the same visit_key, a unique index makes the second insert impossible, and
// the row upgrades in place (viewed → saved → shared their info) under the same
// push collapse id so the lock-screen banner is REPLACED, never stacked.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const cardEvents = () => read("src/app/api/card-events/route.ts");
const leads = () => read("src/app/api/leads/route.ts");
const milestones = () => read("src/lib/milestones.ts");
const apns = () => read("src/lib/apns.ts");
const sw = () => read("public/sw.js");

describe("the visit is what gets deduped", () => {
  it("gives one visitor on one card the same key across a visit", () => {
    const now = 1_760_000_000_000;
    const a = visitKey({ cardOwner: "menashharooni-swiftcard", visitorId: "v1", ip: "1.2.3.4", now });
    const b = visitKey({ cardOwner: "menashharooni-swiftcard", visitorId: "v1", ip: "1.2.3.4", now: now + 60_000 });
    expect(a).toBe(b);
  });

  it("separates two different people on the same card", () => {
    const now = 1_760_000_000_000;
    const a = visitKey({ cardOwner: "c", visitorId: "v1", ip: "1.2.3.4", now });
    const b = visitKey({ cardOwner: "c", visitorId: "v2", ip: "1.2.3.4", now });
    expect(a).not.toBe(b);
  });

  it("stays one visit across a bucket boundary", () => {
    // 10:29 view, 10:31 save: fixed 30-minute buckets put those in different
    // keys, so the save would notify a second time. The previous bucket is
    // checked too — that is what makes the window slide.
    const now = 1_760_000_000_000;
    const boundary = Math.ceil(now / VIEW_VISIT_WINDOW_MS) * VIEW_VISIT_WINDOW_MS;
    const before = visitKeys({ cardOwner: "c", visitorId: "v1", now: boundary - 60_000 });
    const after = visitKeys({ cardOwner: "c", visitorId: "v1", now: boundary + 60_000 });
    expect(after.current).not.toBe(before.current);
    expect(after.previous).toBe(before.current);
  });

  it("looks the previous bucket up and only joins a visit still inside the window", () => {
    const lib = read("src/lib/visit-notify.ts");
    expect(lib).toMatch(/\.in\("visit_key", \[keys\.current, keys\.previous\]\)/);
    expect(lib).toMatch(/\.gte\("created_at", new Date\(now - VIEW_VISIT_WINDOW_MS\)\.toISOString\(\)\)/);
  });

  it("separates two different cards for the same visitor", () => {
    const now = 1_760_000_000_000;
    expect(visitKey({ cardOwner: "card-a", visitorId: "v1", now }))
      .not.toBe(visitKey({ cardOwner: "card-b", visitorId: "v1", now }));
  });

  it("lets the same person notify again on a genuine return visit", () => {
    // A repeat view past the window is real news and must ring again — the
    // same rule the traffic chart already uses (view-window.ts).
    const now = 1_760_000_000_000;
    const a = visitKey({ cardOwner: "c", visitorId: "v1", now });
    const b = visitKey({ cardOwner: "c", visitorId: "v1", now: now + VIEW_VISIT_WINDOW_MS * 2 });
    expect(a).not.toBe(b);
  });

  it("falls back to the IP when the visitor has no id", () => {
    const now = 1_760_000_000_000;
    const a = visitKey({ cardOwner: "c", visitorId: null, ip: "9.9.9.9", now });
    const b = visitKey({ cardOwner: "c", visitorId: "", ip: "9.9.9.9", now });
    expect(a).toBe(b);
    expect(a).toContain("ip:9.9.9.9");
  });

  it("is case-insensitive about the card slug", () => {
    const now = 1_760_000_000_000;
    expect(visitKey({ cardOwner: "MenashHarooni-SwiftCard", visitorId: "v1", now }))
      .toBe(visitKey({ cardOwner: "menashharooni-swiftcard", visitorId: "v1", now }));
  });
});

describe("the push tag survives APNs' 64-byte cap", () => {
  it("stays short even for a maximum-length visitor id", () => {
    const key = visitKey({ cardOwner: "a".repeat(80), visitorId: "b".repeat(64), ip: "1.2.3.4" });
    expect(key.length).toBeGreaterThan(64); // the raw key would be rejected
    expect(visitPushTag(key).length).toBeLessThanOrEqual(64);
  });

  it("is the same tag for every notification in one visit", () => {
    const key = visitKey({ cardOwner: "c", visitorId: "v1", now: 1_760_000_000_000 });
    expect(visitPushTag(key)).toBe(visitPushTag(key));
  });
});

describe("a visit only ever moves UP", () => {
  it("ranks a save above a view and a lead above both", () => {
    expect(VISIT_RANK.card_viewed).toBeLessThan(VISIT_RANK.milestone);
    expect(VISIT_RANK.milestone).toBeLessThan(VISIT_RANK.contact_saved);
    expect(VISIT_RANK.contact_saved).toBeLessThan(VISIT_RANK.new_lead);
  });

  it("suppresses an equal-or-lower event instead of notifying again", () => {
    const lib = read("src/lib/visit-notify.ts");
    expect(lib).toMatch(/if \(rankOf\(notice\.type\) <= rankOf\(open\.type\)\) return "suppressed"/);
  });

  it("upgrades the row that exists rather than inserting a second", () => {
    const lib = read("src/lib/visit-notify.ts");
    expect(lib).toMatch(/async function upgrade\(/);
    expect(lib).toMatch(/\.from\("notifications"\)\s*\.update\(/);
  });

  it("keeps the unique index as the race backstop", () => {
    expect(read("src/lib/visit-notify.ts")).toMatch(/if \(code === "23505"\)/);
  });

  it("still works if the visit_key column was never migrated", () => {
    const lib = read("src/lib/visit-notify.ts");
    expect(lib).toMatch(/code === "42703" \|\| code === "PGRST204"/);
  });
});

describe("every notifier goes through the visit ledger", () => {
  it("card views and contact saves notify via notifyVisit", () => {
    const src = cardEvents();
    expect(src).toMatch(/await notifyVisit\(\{/);
    expect(src).toMatch(/cardOwner: card_owner_username,\s*\n\s*visitorId: visitor_id,\s*\n\s*ip,/);
  });

  it("card-events no longer pushes on its own", () => {
    // A direct sendPushToUser here is how the second banner used to escape.
    expect(cardEvents()).not.toMatch(/sendPushToUser/);
  });

  it("a new lead upgrades the same visit instead of buzzing a third time", () => {
    const src = leads();
    expect(src).toMatch(/notifyVisit\(\{/);
    expect(src).toMatch(/cardOwner: card_owner,\s*\n\s*visitorId: visitor_id,\s*\n\s*ip,/);
    expect(src).not.toMatch(/sendPushToUser/);
  });

  it("a locked lead's push still withholds the vCard", () => {
    expect(leads()).toMatch(/locked \|\| !insertedLead\?\.id/);
  });
});

describe("a milestone is a bell row and nothing more", () => {
  // Superseded 2026-09-06 by the push policy. This block used to guard the
  // "fold the milestone into the visit's push" compromise; milestones now have
  // no route to a phone at all, because a view count is a statistic and
  // push-policy.ts has no category that can carry one. What still matters is
  // that the bell row is written — it is the once-ever ledger, and without it
  // the same milestone announces itself again on the next view.
  it("never pushes, on any path", () => {
    expect(milestones()).not.toMatch(/sendPushToUser/);
    expect(milestones()).not.toMatch(/deferPush/);
  });

  it("writes NOTHING — it detects, the visit announces", () => {
    // This is the fix for the pair quoted at the top of this file. milestones.ts
    // used to insert its own row and dedupe only against itself, so the visit
    // ledger never saw it and one view produced two notifications a second
    // apart. It is now detection-only.
    const src = milestones();
    expect(src).not.toMatch(/insertNotification/);
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).toMatch(/NOTHING IS WRITTEN HERE/);
  });

  it("the milestone rides the visit's OWN row, upgrading it", () => {
    const src = cardEvents();
    expect(src).toMatch(/if \(milestone\) \{\s*\n\s*await notifyVisit\(\{/);
    // Announced AFTER the view: notifyVisit only moves a visit UP the rank
    // list, so the view (rank 1) creates the row and the milestone (rank 2)
    // upgrades it. Reversed, the owner would get a bare statistic and never
    // learn who was on their card.
    expect(src.indexOf("notified = await notifyVisit(")).toBeLessThan(src.indexOf("if (milestone) {"));
  });

  it("the merged row still says WHO viewed, not just the number", () => {
    // The whole risk of merging two rows into one is that the surviving copy
    // drops the useful half. The body keeps the view sentence and appends the
    // count; the title carries the celebration.
    expect(cardEvents()).toMatch(/title: milestone\.title,/);
    expect(cardEvents()).toMatch(/body: `\$\{notice\.body\} That's \$\{milestone\.reached/);
  });

  it("the once-ever ledger is a column an upgrade cannot erase", () => {
    // A lead captured later in the same visit upgrades the SAME row and
    // rewrites its type — so a type-based ledger would forget the milestone had
    // been announced and fire it again. upgrade() sets `milestone` and never
    // clears it.
    expect(cardEvents()).toMatch(/milestone: milestone\.type,/);
    const vn = read("src/lib/visit-notify.ts");
    expect(vn).toMatch(/\.\.\.\(notice\.milestone \? \{ milestone: notice\.milestone \} : \{\}\)/);
    // ...and the ledger read no longer trusts the type alone.
    expect(milestones()).toMatch(/milestone\.eq\.\$\{type\},type\.eq\.\$\{type\}/);
    // The unique index is the race backstop.
    expect(read("supabase/milestone-one-bell.sql")).toMatch(/notifications_milestone_once_idx_v2/);
  });

  it("no longer has a push to defer, so the caller no longer defers one", () => {
    const src = cardEvents();
    expect(src).not.toMatch(/deferMilestonePush/);
    expect(src).not.toMatch(/pushBody/);
  });

  it("does not overwrite the bell row's own type, so the milestone ledger holds", () => {
    // A visit row upgraded to a milestone type would be overwritten again by
    // the next save in that visit, erasing the ledger and letting the same
    // milestone fire a second time.
    const src = cardEvents();
    expect(src).toMatch(/type: notice\.type,/);
    expect(src).toMatch(/title: notice\.title,/);
  });

  it("leaves the CRM the plain event, not our gamification", () => {
    const src = cardEvents();
    expect(src).toMatch(/type: "conversation\.notification",\s*\n\s*event: isView \? "card_viewed" : "contact_saved",\s*\n\s*title: notice\.title,\s*\n\s*body: notice\.body,/);
  });
});

describe("the lock screen actually replaces the banner", () => {
  it("sends an APNs collapse id so iOS overwrites the earlier notification", () => {
    const src = apns();
    expect(src).toMatch(/"apns-collapse-id"/);
    expect(src).toMatch(/\(payload\.tag \?\? ""\)\.slice\(0, 64\)/);
  });

  it("uses the same mechanism on the web via the notification tag", () => {
    expect(sw()).toMatch(/tag: data\.tag \?\? "swiftcard"/);
  });
});
