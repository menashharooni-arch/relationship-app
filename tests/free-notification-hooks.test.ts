import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardEventNotice } from "@/lib/card-event-notify";
import { teaseLocation, stripLocationMarks } from "@/lib/location-privacy";
import { NATIVE_BODY_REMAP, NATIVE_HIDDEN_TYPES } from "@/lib/native-notification-copy";

// ── Notifications people want to open (owner, 2026-09-22) ────────────────────
//
// "If a free user, how are their push notifications going to look on their
// phone? We have to make it attractive to get them to want to upgrade. Maybe
// … it'll have the state blurred on the phone."
//
// The rules that make that safe: the push shows WHAT is being held back and
// never says Pro, upgrade or price (App Review 4.5.4 and, in the app, 3.1.1);
// the way to the blurred part lives on the website only.

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("someone who keeps coming back", () => {
  it("is named as a repeat visit, every plan", () => {
    const n = cardEventNotice({ eventType: "viewed_card", repeatVisits: 3, location: "Austin, TX", geoAccuracy: "city" })!;
    expect(n.title).toBe("3rd visit this week 👀");
    // The body keeps the where, so the Free lock screen still shows the gap.
    expect(teaseLocation(n.body)).toBe("Someone viewed your card in ▒▒▒▒▒, ▒▒.");
    expect(stripLocationMarks(n.body)).toBe("Someone viewed your card near Austin, TX.");
  });

  it("a first or second-ever look reads as before", () => {
    expect(cardEventNotice({ eventType: "viewed_card", repeatVisits: 1 })!.title).toBe("Card viewed");
    expect(cardEventNotice({ eventType: "viewed_card", surface: "links" })!.title).toBe("Swift Links viewed");
    // The card's first view ever outranks a repeat headline.
    expect(cardEventNotice({ eventType: "viewed_card", firstEver: true, repeatVisits: 4 })!.title).toBe("Your card's first view!");
  });

  it("fits the 40-character lock-screen title at any count", () => {
    for (const n of [2, 3, 11, 22, 99, 1234]) {
      expect(cardEventNotice({ eventType: "viewed_card", repeatVisits: n })!.title.length).toBeLessThanOrEqual(40);
    }
  });

  it("the ingest route counts visits by this browser, on this page, over 7 days", () => {
    const route = read("src/app/api/card-events/route.ts");
    expect(route).toMatch(/async function countRecentVisits/);
    expect(route).toMatch(/\.eq\("visitor_id", visitorId\)/);
    expect(route).toMatch(/\.eq\("surface", surface\)/);
    expect(route).toMatch(/Date\.now\(\) - REPEAT_VISIT_LOOKBACK_MS/);
    // Not for a known contact — "Priya is back" is the bigger news there.
    expect(route).toMatch(/repeatVisits: isView && !firstEver && !returning && visitor_id/);
  });
});

describe("the way to the blurred part", () => {
  it("is web-only, only on a redacted row, and names no plan or price", () => {
    const c = code("src/components/SeeWhoLink.tsx");
    expect(c).toMatch(/if \(isNative \|\| !text\.includes\("█"\)\) return null/);
    expect(c).not.toMatch(/\bPro\b|upgrade to|price|\$\d/i);
    expect(c).toContain("See who and where");
  });

  it("sits under both notification lists", () => {
    expect(read("src/components/NotificationsPanel.tsx")).toContain("<SeeWhoLink");
    expect(read("src/components/NotificationBell.tsx")).toContain("<SeeWhoLink");
  });
});

describe("the app never shows selling or billing copy in a notification", () => {
  it("rewords every stored body that sells", () => {
    for (const body of Object.values(NATIVE_BODY_REMAP)) {
      expect(body).not.toMatch(/upgrade|price|subscribe|cancel|billing/i);
    }
    expect(NATIVE_BODY_REMAP.plan_downgraded).toBeDefined();
    expect(NATIVE_HIDDEN_TYPES.has("personal_sub_reminder")).toBe(true);
  });

  it("both lists apply the same rules — the top bell used to apply none", () => {
    const bell = read("src/components/NotificationBell.tsx");
    expect(bell).toMatch(/NATIVE_HIDDEN_TYPES\.has\(n\.type\)/);
    expect(bell).toMatch(/NATIVE_BODY_REMAP\[n\.type\]/);
    expect(bell).toMatch(/n\.type !== "referral_claim"/);
    expect(bell).toMatch(/useIsNativeApp\(\)/);
    const panel = read("src/components/NotificationsPanel.tsx");
    expect(panel).toMatch(/useIsNativeApp\(\)/);
    expect(panel).toMatch(/NATIVE_HIDDEN_TYPES\.has\(n\.type\)/);
    expect(panel).toMatch(/NATIVE_BODY_REMAP\[n\.type\]/);
  });
});
