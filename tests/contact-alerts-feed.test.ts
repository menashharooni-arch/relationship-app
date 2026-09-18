import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeClientTags, RESERVED_LEAD_TAG } from "@/lib/lead-tags";
import { ALERTS_MUTED_TAG } from "@/lib/contact-return-notify";

// Warm-lead plan PR B2: the in-app side of a returning-contact alert.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the per-contact mute", () => {
  it("is a reserved tag: a tag edit can neither set it nor drop it", () => {
    expect(RESERVED_LEAD_TAG.test(ALERTS_MUTED_TAG)).toBe(true);
    expect(mergeClientTags(["vip", ALERTS_MUTED_TAG], [])).toEqual(["vip"]);
    expect(mergeClientTags(["vip"], [ALERTS_MUTED_TAG])).toEqual([ALERTS_MUTED_TAG, "vip"]);
  });

  it("has its own owner-scoped route that touches only that tag", () => {
    const src = read("src/app/api/leads/[id]/alerts/route.ts");
    expect(src).toMatch(/ownsLead\(usernames, lead\)/);
    expect(src).toMatch(/filter\(\(t\) => t !== ALERTS_MUTED_TAG\)/);
  });

  it("is a switch on the contact, saved on tap", () => {
    expect(read("src/components/ContactsClient.tsx")).toMatch(/<ContactAlertsToggle key=\{selected\.id\} leadId=\{selected\.id\} initiallyMuted=\{\(selected\.tags \?\? \[\]\)\.includes\("alerts-muted"\)\} \/>/);
  });
});

describe("Wrong person?", () => {
  const src = read("src/app/api/leads/[id]/wrong-person/route.ts");

  it("only for the owner's own alert about their own contact", () => {
    expect(src).toMatch(/!ownsLead\(usernames, lead\) \|\| !note \|\| note\.user_id !== user\.id \|\| note\.lead_id !== leadId/);
  });

  it("unbinds the visit's browsers (kept and marked — the trust metric) and removes the alert", () => {
    expect(src).toMatch(/update\(\{ wrong_at: new Date\(\)\.toISOString\(\) \}\)/);
    expect(src).not.toMatch(/from\("contact_devices"\)\s*\.delete/);
    expect(src).toMatch(/from\("notifications"\)\.delete\(\)\.eq\("id", notificationId\)\.eq\("user_id", user\.id\)/);
  });

  it("takes the contact off that visit's events, so their history and score stop counting it", () => {
    expect(src).toMatch(/from\("card_events"\)\.update\(\{ lead_id: null, lead_confidence: null \}\)/);
    expect(src).toMatch(/from\("card_views"\)\.update\(\{ lead_id: null \}\)/);
  });

  it("is offered only on rows that name a returning contact", () => {
    const panel = read("src/components/NotificationsPanel.tsx");
    expect(panel).toMatch(/const NAMED_RETURN_TYPES = new Set\(\["contact_returned", "contact_engaged"\]\);/);
    expect(panel).toMatch(/NAMED_RETURN_TYPES\.has\(n\.type\) && n\.lead_id &&/);
  });
});

describe("the feed", () => {
  const panel = read("src/components/NotificationsPanel.tsx");

  it("opens the contact by id, and falls back to the name match only for older rows", () => {
    expect(panel).toMatch(/const match = n\.lead_id\s*\?\s*\{ id: n\.lead_id \}/);
    expect(panel).toMatch(/"contact_returned", "contact_engaged"\]\);/);
  });

  it("blurs a Free account's contact names in titles, in the panel and the bell", () => {
    expect(panel).toMatch(/<NotificationBody text=\{n\.title\} \/>/);
    expect(read("src/components/NotificationBell.tsx")).toMatch(/<NotificationBody text=\{n\.title\} \/>/);
  });

  it("refreshes every 10s while on screen, and not at all while hidden", () => {
    expect(panel).toMatch(/setInterval\(poll, 10000\)/);
    expect(panel).toMatch(/if \(document\.visibilityState === "hidden"\) return;/);
  });

  it("the API hands back lead_id, and still works without the column", () => {
    const api = read("src/app/api/notifications/route.ts");
    expect(api).toMatch(/scopedQuery\("id, type, title, body, read, created_at, card_owner, lead_id"\)/);
    expect(api).toMatch(/if \(error\) \(\{ data: scoped, error \} = await scopedQuery\("id, type, title, body, read, created_at, card_owner"\)\);/);
  });
});

describe("measuring it", () => {
  it("opening a contact stamps their alerts as opened — once, owner-scoped, after the response", () => {
    const page = read("src/app/contacts/page.tsx");
    expect(page).toMatch(/\.update\(\{ opened_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\("user_id", ownerId\)\s*\.eq\("lead_id", selectedLeadParam\)\s*\.is\("opened_at", null\)/);
    expect(page).toMatch(/after\(async \(\) => \{/);
  });
});
