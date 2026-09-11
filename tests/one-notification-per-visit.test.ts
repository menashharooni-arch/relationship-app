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

describe("a milestone is a bell row and a headline, never a push of its own", () => {
  // Two rules that sound contradictory and are not, so both are pinned here.
  //
  //   A milestone may not CAUSE a push. There is no category that carries a
  //   view count and there must not be one: a statistic is the product
  //   cheering, and cheering does not get to interrupt anybody.
  //
  //   A milestone MAY retitle the push the view was already sending
  //   (2026-09-11, owner's call). The card_view push for the view that crossed
  //   it is going out regardless, under a switch the person agreed to; the only
  //   question is whether its headline reads "Card viewed" or "50 views — on
  //   fire!". Same buzz, better sentence. Before this, the one moment an owner
  //   is unambiguously pleased was the one moment the phone kept to itself.
  it("never pushes, on any path", () => {
    expect(milestones()).not.toMatch(/sendPushToUser/);
    expect(milestones()).not.toMatch(/deferPush/);
  });

  it("rides the view's push as its TITLE — no second push, no new category", () => {
    const src = cardEvents();
    // Passed on the VIEW notice, which is the one already carrying
    // pushCategory "card_view"...
    expect(src).toMatch(/\.\.\.\(milestone \? \{ pushTitle: milestone\.title \} : \{\}\)/);
    // ...while the milestone's OWN notifyVisit call still has no pushCategory,
    // so it can do nothing but write the bell row.
    const milestoneCall = src.slice(src.indexOf("if (milestone) {"));
    expect(milestoneCall.slice(0, 900)).not.toMatch(/pushCategory/);
    // visit-notify spends it on the push title only — the bell row keeps the
    // view's own wording until the milestone upgrade rewrites it.
    const vn = read("src/lib/visit-notify.ts");
    expect(vn).toMatch(/title: notice\.pushTitle \?\? notice\.title,/);
  });

  it("every milestone headline fits the lock-screen title budget", async () => {
    // A title the OS cuts mid-word turns a celebration into a stump. They are
    // authored strings, so this is checkable at the source.
    const { MAX_TITLE_CHARS } = await import("../src/lib/push-policy");
    const titles = [...milestones().matchAll(/\{ title: "([^"]+)", +body:/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThanOrEqual(11);
    for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(MAX_TITLE_CHARS);
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

  it("takes the headline and leaves the body alone — no deferral machinery", () => {
    const src = cardEvents();
    // There is no queue, no "announce this later": the milestone is known
    // before the view's push goes out, so it is simply part of it.
    expect(src).not.toMatch(/deferMilestonePush/);
    // And it takes the TITLE only. The body stays "Someone viewed your card
    // near Austin" — the number is already in the headline, and who was on the
    // card is the half a bare statistic would have thrown away.
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
