import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activeEvent, cleanEventLabel, EVENT_LABEL_MAX, EVENT_MAX_MS, eventUntil } from "@/lib/event-tag";

// Warm-lead plan PR B3: "At an event?" stamps today's contacts with where the
// owner met them, so a returning-contact alert can say it back.
const NOW = Date.UTC(2026, 8, 18, 15);

describe("the event label", () => {
  it("is trimmed, single-spaced and bounded", () => {
    expect(cleanEventLabel("  RE/MAX   Summit  ")).toBe("RE/MAX Summit");
    expect(cleanEventLabel("x".repeat(100))!.length).toBe(EVENT_LABEL_MAX);
    expect(cleanEventLabel("   ")).toBeNull();
    expect(cleanEventLabel(42)).toBeNull();
  });

  it("can never carry the invisible marks notifications use", () => {
    expect(cleanEventLabel("RE/MAX⁢Summit⁤")).toBe("RE/MAXSummit");
  });
});

describe("how long it lasts", () => {
  it("until the local midnight the app sends", () => {
    const midnight = new Date(NOW + 9 * 3600_000).toISOString();
    expect(eventUntil(midnight, NOW)).toBe(midnight);
  });

  it("never more than a day, and never already over", () => {
    expect(Date.parse(eventUntil(new Date(NOW + 3 * EVENT_MAX_MS).toISOString(), NOW))).toBe(NOW + EVENT_MAX_MS);
    expect(Date.parse(eventUntil(new Date(NOW - 1000).toISOString(), NOW))).toBeGreaterThan(NOW);
    expect(Date.parse(eventUntil(undefined, NOW))).toBeGreaterThan(NOW);
  });

  it("stops applying once it ends", () => {
    const c = { _event: { label: "RE/MAX Summit", until: new Date(NOW + 1000).toISOString() } };
    expect(activeEvent(c, NOW)).toMatchObject({ label: "RE/MAX Summit" });
    expect(activeEvent(c, NOW + 2000)).toBeNull();
    expect(activeEvent({}, NOW)).toBeNull();
    expect(activeEvent(null, NOW)).toBeNull();
  });
});

describe("wired the way the rules assume", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("a lead captured during the event is saved as met there", () => {
    const leads = read("src/app/api/leads/route.ts");
    expect(leads).toMatch(/const eventTag = activeEvent\(ownerProfile\?\.customization\);/);
    expect(leads).toMatch(/\.\.\.\(eventTag \? \{ where_met: eventTag\.label \} : \{\}\)/);
  });

  it("the tag is written through the verified customization writer", () => {
    expect(read("src/app/api/profile/event/route.ts")).toMatch(/mutateCustomization<unknown>\(user\.id, EVENT_KEY/);
  });

  it("the chip lives in the dashboard's Share box, and its form is never a GET", () => {
    expect(read("src/app/dashboard/page.tsx")).toMatch(/<EventTagChip initial=\{activeEvent\(profile\.customization\)\} \/>/);
    expect(read("src/components/EventTagChip.tsx")).toMatch(/method="post"/);
  });
});
