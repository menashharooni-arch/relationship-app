import { describe, it, expect } from "vitest";
import { buildTourSteps, type TourContext } from "@/lib/tour-steps";

// The tour an invited teammate (office sub-user) takes right after building
// their company card. Asserted on the BUILT steps, not the source: a copy fix
// once landed as a `bodyFor` under the wrong step, and every account's
// "General" step then talked about connecting Salesforce.

const member: TourContext = { tier: "office", isOfficeMember: true, hasCards: true, isNative: false };
const owner: TourContext = { tier: "office", isOfficeMember: false, hasCards: true, isNative: false };
const pro: TourContext = { tier: "pro", isOfficeMember: false, hasCards: true, isNative: false };
const free: TourContext = { tier: "free", isOfficeMember: false, hasCards: true, isNative: false };

const step = (ctx: TourContext, id: string) => buildTourSteps(ctx).find((s) => s.id === id);

describe("the tour a team member gets", () => {
  it("never shows the owner's console, billing, referrals or Help-us-grow", () => {
    const ids = buildTourSteps(member).map((s) => s.id);
    for (const hidden of ["nav-admin", "settings-billing", "settings-refer", "nav-grow"]) {
      expect(ids, hidden).not.toContain(hidden);
    }
  });

  it("describes ONE company card — no arrow, no + Add card (both hidden for members)", () => {
    const body = step(member, "my-cards")!.body;
    expect(body).toMatch(/company card/i);
    expect(body).not.toMatch(/Add card|arrow|unlimited/i);
  });

  it("talks about their card, not 'ALL your cards'", () => {
    expect(step(member, "notif-bell")!.body).not.toMatch(/ALL your cards/);
  });

  it("never pitches upgrading, pricing or a trial anywhere", () => {
    for (const s of buildTourSteps(member)) {
      expect(`${s.title} ${s.body}`, s.id).not.toMatch(/upgrade|free pro|trial|pricing|\$\d/i);
    }
  });

  it("frames integrations around the team's CRM", () => {
    expect(step(member, "settings-integrations")!.body).toMatch(/your team connects a CRM/);
  });
});

describe("every account's General step is about General", () => {
  it.each([["member", member], ["owner", owner], ["pro", pro], ["free", free]] as const)("%s", (_, ctx) => {
    const general = step(ctx, "settings-general");
    expect(general, "settings-general step missing").toBeTruthy();
    expect(general!.body).not.toMatch(/Salesforce|CRM|Zapier/);
  });
});
