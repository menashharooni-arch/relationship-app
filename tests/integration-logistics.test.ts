import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The logistics audit (owner order 2026-08-27): every integration sends the
// RIGHT information, and the small traps around it stay closed. Each pin here
// is a bug that existed or a leak that almost did.

const read = (p: string) => readFileSync(p, "utf8");

describe("what each provider is sent", () => {
  it("the Zapier webhook carries company and capture method", () => {
    // Both were collected but never sent — a Zap could not route by company
    // or distinguish a QR scan from a shared link.
    const src = read("src/app/api/leads/route.ts");
    const zap = src.slice(src.indexOf('"lead.created"'), src.indexOf('"lead.created"') + 400);
    expect(zap).toContain("company: company || null");
    expect(zap).toContain("source: source ? getSourceLabel(source) : null");
  });

  it("the Zapier sample payload shown in Settings matches the real one", () => {
    const ui = read("src/components/ZapierSettings.tsx");
    expect(ui).toContain('"company"');
    expect(ui).toContain('"source"');
  });

  it("Pipedrive links the company as a real Organization", () => {
    const src = read("src/lib/sync-pipedrive.ts");
    expect(src).toContain("/api/v2/organizations/search");
    expect(src).toContain("org_id");
  });

  it("HighLevel sends the lead's own tags as first-class tags", () => {
    expect(read("src/lib/sync-highlevel.ts")).toContain("...(lead.tags ?? [])");
  });
});

describe("tag hygiene at the boundaries", () => {
  it("capture-time CRM tags are the whitelisted set, never raw visitor input", () => {
    // A visitor could otherwise name tags that fire the owner's HighLevel
    // workflows the moment their own submission syncs.
    const src = read("src/app/api/leads/route.ts");
    const start = src.indexOf("const leadData");
    const block = src.slice(start, src.indexOf("after(", start));
    expect(block).toContain("tags: safeTags.length ? safeTags : null");
    expect(block).not.toMatch(/tags:\s*Array\.isArray\(tags\)/);
  });

  it("edit-sync strips server-owned tags before they reach a CRM", () => {
    // sc-locked / sms-paused / flow-* are internal state, not contact data.
    const src = read("src/app/api/leads/[id]/route.ts");
    expect(src).toContain("RESERVED_LEAD_TAG.test(t)");
  });
});

describe("landing back from an OAuth connect", () => {
  it("?integration=… opens the section the cards live in", () => {
    // The green Connected badge and the success flash are invisible if the
    // page opens on Profile — which is exactly what it did.
    const src = read("src/app/settings/flows/page.tsx");
    expect(src).toMatch(/openIntegrations \? "notifications"/);
  });
});
