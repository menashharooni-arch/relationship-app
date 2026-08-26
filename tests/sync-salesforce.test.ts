import { describe, it, expect, vi, beforeEach } from "vitest";

// Salesforce sync contract: org-host allowlist (SSRF), required-field
// fallbacks (LastName/Company are mandatory on a Lead), find-by-email upsert,
// and the full capture context in Description.

vi.mock("@/lib/crm-connection", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/crm-connection")>();
  return {
    ...real,
    resolveCrmOwnerId: async (_p: string, uid: string) => uid,
    getCrmConnection: async () => ({ token: "tok", syncError: null, metadata: { instance_url: "https://acme.my.salesforce.com" } }),
    setSyncError: async () => {},
  };
});

import { syncLeadToSalesforce, isSalesforceInstanceUrl } from "@/lib/sync-salesforce";

const calls: { url: string; init?: RequestInit }[] = [];
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/query")) return new Response(JSON.stringify({ records: [] }), { status: 200 });
    return new Response(JSON.stringify({ id: "00Q123" }), { status: 201 });
  });
});

describe("instance URL allowlist", () => {
  it("accepts only Salesforce hosts over https", () => {
    expect(isSalesforceInstanceUrl("https://acme.my.salesforce.com")).toBe(true);
    expect(isSalesforceInstanceUrl("https://na139.salesforce.com")).toBe(true);
    expect(isSalesforceInstanceUrl("http://acme.my.salesforce.com")).toBe(false);
    expect(isSalesforceInstanceUrl("https://evil.com/?x=.salesforce.com")).toBe(false);
    expect(isSalesforceInstanceUrl("https://salesforce.com.evil.com")).toBe(false);
    expect(isSalesforceInstanceUrl(null)).toBe(false);
  });
});

describe("lead writes", () => {
  it("required fields never fail a sparse capture; context rides in Description", async () => {
    await syncLeadToSalesforce({ name: "Maya", email: "m@x.co", phone: null, company: null, whereMet: "Expo hall", source: "QR code", capturedByCard: "maya-card", tags: ["hot"] }, "u1");
    const write = calls.find((c) => c.url.includes("/sobjects/Lead") && c.init?.method === "POST");
    expect(write).toBeTruthy();
    const body = JSON.parse(String(write!.init!.body));
    expect(body.LastName).toBe("Maya");          // single name → LastName
    expect(body.Company).toBe("Maya");           // no company → person's name
    expect(body.LeadSource).toBe("SwiftCard");
    expect(body.Description).toContain("Met: Expo hall");
    expect(body.Description).toContain("Captured via: QR code");
    expect(body.Description).toContain("Card: https://swiftcard.me/maya-card");
    expect(body.Description).toContain("Tags: hot");
  });

  it("an existing Lead with the email is UPDATED, not duplicated", async () => {
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/query")) return new Response(JSON.stringify({ records: [{ Id: "00Qexisting" }] }), { status: 200 });
      return new Response(null, { status: 204 });
    });
    await syncLeadToSalesforce({ name: "Aaron Lavi", email: "a@x.co", phone: null, company: "Malve" }, "u1");
    const patch = calls.find((c) => c.url.includes("/sobjects/Lead/00Qexisting") && c.init?.method === "PATCH");
    expect(patch).toBeTruthy();
    expect(calls.some((c) => c.init?.method === "POST" && c.url.includes("/sobjects/Lead"))).toBe(false);
  });
});
