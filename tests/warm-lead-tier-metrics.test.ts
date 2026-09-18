import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPushPrefs } from "@/lib/push-policy";
import { contactReturnNotice } from "@/lib/contact-return-notify";
import type { KnownContact } from "@/lib/known-contact";
import { warmLeadMetrics } from "@/lib/warm-lead-metrics";

// Warm-lead plan PR C4: the tier in the alert, "Only Hot contacts", and the
// admin scorecard.

const priya: KnownContact = {
  kind: "known", leadId: "p", name: "Priya Shah", cardOwner: "dana", confidence: "form",
  capturedAt: "2026-09-10T15:00:00Z", status: null, tags: [], whereMet: "RE/MAX Summit",
};

describe("the tier in the alert", () => {
  it("leads a Pro lock screen when the contact is Hot", () => {
    const n = contactReturnNotice({ contact: priya, eventType: "viewed_card", surface: "card", visitsThisWeek: 3, paid: true, tier: "hot" })!;
    expect(n.pushBody).toBe("Hot · Met at RE/MAX Summit · 3rd visit this week");
  });

  it("is never on a Free lock screen", () => {
    const n = contactReturnNotice({ contact: priya, eventType: "viewed_card", surface: "card", visitsThisWeek: 3, paid: false, tier: "hot" })!;
    expect(n.pushBody).toBe("Open SwiftCard to see who");
  });
});

describe("Only Hot contacts", () => {
  it("is off unless switched on", () => {
    expect(readPushPrefs({}).returningHotOnly).toBe(false);
    expect(readPushPrefs({ _push: { returningHotOnly: true } }).returningHotOnly).toBe(true);
  });

  it("holds a returning contact who isn't Hot to the bell", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/card-events/route.ts"), "utf8");
    expect(route).toMatch(/readPushPrefs\(owner\.customization\)\.returningHotOnly &&\s*\n\s*intent\?\.tier !== "hot"/);
    expect(route).toMatch(/returnNotice = \{ \.\.\.returnNotice, pushCategory: undefined \};/);
  });

  it("is saved by the preferences route and shown only while Returning contacts is on", () => {
    expect(readFileSync(join(process.cwd(), "src/app/api/push/preferences/route.ts"), "utf8"))
      .toMatch(/if \(typeof body\.returningHotOnly === "boolean"\) push\.returningHotOnly = body\.returningHotOnly;/);
    expect(readFileSync(join(process.cwd(), "src/components/PushPreferencesForm.tsx"), "utf8"))
      .toMatch(/\{prefs\.contact_return !== false && \(/);
  });
});

describe("the admin scorecard", () => {
  it("says it is not recording, rather than zeros, before the migration", async () => {
    const broken = { from: () => ({ select: () => ({ in: () => ({ not: () => ({ gte: () => ({ limit: () => Promise.resolve({ data: null, error: { code: "42703" } }) }) }) }) }) }) } as never;
    expect(await warmLeadMetrics(broken)).toEqual({ available: false });
  });

  it("is on /admin/analytics with wrong-person as a rate", () => {
    expect(readFileSync(join(process.cwd(), "src/app/api/admin/analytics/route.ts"), "utf8")).toMatch(/const warmLead = await warmLeadMetrics\(admin, now\);/);
    expect(readFileSync(join(process.cwd(), "src/app/admin/analytics/AnalyticsClient.tsx"), "utf8")).toMatch(/a\.warmLead\.wrongRate > 2/);
  });
});
