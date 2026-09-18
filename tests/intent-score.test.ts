import { describe, it, expect } from "vitest";
import { compareIntent, INTENT, isHighIntentHost, scoreContact, type IntentInput } from "@/lib/intent-score";

// Warm-lead plan PR C1: the transparent Hot / Warm / Cold score.

const NOW = Date.UTC(2026, 9, 1, 12);
const DAY = 24 * 3600_000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const base = (over: Partial<IntentInput> = {}): IntentInput => ({
  capturedAt: ago(20), visits: [], taps: [], downloads: [], replies: [], ...over,
});

describe("tiers", () => {
  it("a contact who never came back is Cold, with nothing to say", () => {
    expect(scoreContact(base(), NOW)).toEqual({ tier: "cold", score: 0, reason: null, lastEngagedAt: null });
  });

  it("the visit they were captured in is not a return", () => {
    const r = scoreContact(base({ capturedAt: ago(1), visits: [new Date(Date.parse(ago(1)) + 10 * 60_000).toISOString()] }), NOW);
    expect(r.tier).toBe("cold");
  });

  it("one recent return visit is Warm", () => {
    const r = scoreContact(base({ visits: [ago(1)] }), NOW);
    expect(r.tier).toBe("warm");
    expect(r.reason).toBe("viewed 1× this week");
  });

  it("repeat visits plus a booking-link tap in the last few days is Hot", () => {
    const r = scoreContact(base({
      visits: [ago(0.2), ago(1), ago(2)],
      taps: [{ at: ago(0.2), host: "calendly.com", label: null }],
    }), NOW);
    expect(r.tier).toBe("hot");
    expect(r.reason).toBe("viewed 3× this week, tapped Calendly");
  });

  it("a reply outweighs everything else", () => {
    const r = scoreContact(base({ visits: [ago(2)], replies: [ago(1)] }), NOW);
    expect(r.reason).toBe("replied to you, viewed 1× this week");
  });

  it("uses the owner's own name for the link when it has one", () => {
    const r = scoreContact(base({ taps: [{ at: ago(1), host: "zillow.com", label: "Listings" }] }), NOW);
    expect(r.reason).toBe("tapped Listings");
  });
});

describe("recency", () => {
  it("halves every week", () => {
    const fresh = scoreContact(base({ visits: [ago(0)] }), NOW).score;
    const weekOld = scoreContact(base({ visits: [ago(INTENT.halfLifeDays)] }), NOW).score;
    expect(weekOld).toBeCloseTo(fresh / 2, 1);
  });

  it("a big burst three weeks ago is not Hot today", () => {
    const r = scoreContact(base({
      capturedAt: ago(28),
      visits: [ago(21), ago(21), ago(21), ago(21), ago(21), ago(21)],
      taps: [{ at: ago(21), host: "calendly.com", label: null }],
    }), NOW);
    expect(r.tier).toBe("cold");
    expect(r.reason).toBe("viewed 6× this month, tapped Calendly");
  });

  it("nothing older than the window counts", () => {
    expect(scoreContact(base({ capturedAt: ago(60), visits: [ago(31)] }), NOW).tier).toBe("cold");
  });
});

describe("high-intent links (decision D9: a built-in list)", () => {
  it("knows booking and listing sites, subdomains included", () => {
    for (const h of ["calendly.com", "www.calendly.com", "app.cal.com", "zillow.com", "meetings.hubspot.com"]) {
      expect(isHighIntentHost(h)).toBe(true);
    }
    for (const h of ["instagram.com", "notcalendly.com", "", null]) expect(isHighIntentHost(h)).toBe(false);
  });
});

describe("follow up first", () => {
  it("orders Hot before Warm before Cold, then most recent", () => {
    const hot = scoreContact(base({ visits: [ago(0.1), ago(1), ago(2)], replies: [ago(1)] }), NOW);
    const warmRecent = scoreContact(base({ visits: [ago(0.5)] }), NOW);
    const warmOlder = scoreContact(base({ visits: [ago(5)] }), NOW);
    const cold = scoreContact(base(), NOW);
    const sorted = [cold, warmOlder, hot, warmRecent].sort(compareIntent);
    expect(sorted).toEqual([hot, warmRecent, warmOlder, cold]);
  });
});
