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

  // Owner, 2026-09-19: "every single contact that I add and any contact that
  // scans my Apple Wallet card or anything like that … has it tagged
  // correctly." Wallet, QR, NFC and sent links all end at the card's form
  // (/api/leads); by hand and a scanned paper card both land in leads/manual.
  it("a contact added by hand or scanned is saved as met there too", () => {
    const manual = read("src/app/api/leads/manual/route.ts");
    expect(manual).toMatch(/const eventTag = activeEvent\(profile\.customization\);/);
    expect(manual).toMatch(/const metAt = where_met\?\.trim\(\) \|\| eventTag\?\.label \|\| null;/);
    // Stored AND sent to the CRM/Zapier as the same value.
    expect(manual).toMatch(/where_met: metAt,/);
    expect(manual).toMatch(/whereMet: metAt,/);
  });

  it("never overwrites a 'Where you met' the owner typed", () => {
    const manual = read("src/app/api/leads/manual/route.ts");
    // What was typed comes FIRST in the fallback chain.
    expect(manual).toMatch(/where_met\?\.trim\(\) \|\| eventTag\?\.label/);
  });

  it("every path that creates a contact is covered", () => {
    // If a third writer of `leads` appears, it needs the tag too — this fails
    // until someone decides.
    const writers = ["src/app/api/leads/route.ts", "src/app/api/leads/manual/route.ts", "src/lib/demo-contact.ts"];
    for (const f of writers) expect(read(f)).toMatch(/from\("leads"\)\s*\n?\s*\.insert|from\("leads"\)\.insert/);
    // The sample contact that seeds a new account is deliberately NOT tagged.
    expect(read("src/lib/demo-contact.ts")).not.toMatch(/activeEvent/);
  });

  it("a tap before the page is interactive still saves, and comes back", () => {
    const route = read("src/app/api/profile/event/route.ts");
    expect(route).toMatch(/req\.formData\(\)/);
    expect(route).toMatch(/NextResponse\.redirect\(new URL\("\/dashboard", req\.url\), 303\)/);
  });

  it("gives a way out of the box: a cancel, Escape, and an empty blur", () => {
    const chip = read("src/components/EventTagChip.tsx");
    expect(chip).toMatch(/aria-label="Cancel"/);
    expect(chip).toMatch(/e\.key === "Escape"/);
    expect(chip).toMatch(/onBlur=\{\(\) => \{ if \(!draft\.trim\(\) && !saving\) cancel\(\); \}\}/);
    // Nothing is written until Save.
    expect(chip).toMatch(/const cancel = \(\) => \{ setEditing\(false\); setDraft\(""\); setError\(null\); \};/);
  });

  it("drops the line by itself when the tag ends mid-session", () => {
    expect(read("src/components/EventTagChip.tsx")).toMatch(/setTimeout\(\(\) => setActive\(null\)/);
  });
});
