import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readPushPrefs } from "@/lib/push-policy";
import { contactReturnNotice } from "@/lib/contact-return-notify";
import type { KnownContact } from "@/lib/known-contact";
import { warmLeadMetrics } from "@/lib/warm-lead-metrics";

// Warm-lead plan PR C4 shipped a Hot / Warm tier, "Only Hot contacts" and
// the admin scorecard. The owner removed Hot / Warm everywhere (2026-09-24:
// "It doesn't connect to anything"); the scorecard — whether returning-contact
// alerts name the right person — stays.

const priya: KnownContact = {
  kind: "known", leadId: "p", name: "Priya Shah", cardOwner: "dana", confidence: "form",
  capturedAt: "2026-09-10T15:00:00Z", status: null, tags: [], whereMet: "RE/MAX Summit",
};

describe("no Hot / Warm anywhere", () => {
  it("a returning contact's alert carries no tier", () => {
    const n = contactReturnNotice({ contact: priya, eventType: "viewed_card", surface: "card", visitsThisWeek: 3, paid: true })!;
    expect(n.pushBody).toBe("Met at RE/MAX Summit · 3rd visit this week");
    expect(contactReturnNotice({ contact: priya, eventType: "viewed_card", surface: "card", visitsThisWeek: 3, paid: false })!.pushBody).toBe("Open SwiftCard to see who");
  });

  it("the scoring, its badges, filters, sort, lists and the 'Only Hot contacts' switch are gone", () => {
    for (const f of ["src/lib/intent-score.ts", "src/lib/intent-load.ts", "src/components/FollowUpFirst.tsx", "src/app/office/admin/leads/TeamFollowUp.tsx"]) {
      expect(existsSync(join(process.cwd(), f)), f).toBe(false);
    }
    const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    const contacts = read("src/components/ContactsClient.tsx");
    expect(contacts).not.toMatch(/IntentBadge|tierFilter|warmingCount|Follow Up First|"Hot"|"Warm"/);
    expect(read("src/app/contacts/page.tsx")).not.toMatch(/loadIntent|warmingCount/);
    expect(read("src/app/dashboard/page.tsx")).not.toMatch(/FollowUpFirst|loadIntent/);
    expect(read("src/components/PushPreferencesForm.tsx")).not.toContain("Only Hot contacts");
    expect(readPushPrefs({ _push: { returningHotOnly: true } })).not.toHaveProperty("returningHotOnly");
    for (const f of ["src/app/api/card-events/route.ts", "src/app/api/push/catchup/route.ts", "src/app/api/push/preferences/route.ts"]) {
      expect(read(f), f).not.toMatch(/returningHotOnly|loadIntent/);
    }
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
