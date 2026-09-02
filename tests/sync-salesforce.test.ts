import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

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

describe("SOQL escaping", () => {
  it("neither quotes nor backslashes break out of the email literal", async () => {
    await syncLeadToSalesforce({ name: "X", email: "a\\' OR Name!='@x.co", phone: null, company: null }, "u1");
    const q = calls.find((c) => c.url.includes("/query"));
    const soql = decodeURIComponent(q!.url.split("q=")[1]);
    // Every backslash and quote in the value arrives escaped: the literal closes
    // exactly where the template intends, so the payload stays inert data.
    expect(soql).toContain("Email = 'a\\\\\\' OR Name!=\\'@x.co' LIMIT 1");
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
    // Fuzzy org duplicate rules must not eat leads we already email-dedup.
    expect((write!.init!.headers as Record<string, string>)["Sforce-Duplicate-Rule-Header"]).toBe("allowSave=true");
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

describe("refresh without expires_in", () => {
  it("the shared refresh machinery never persists a NaN expiry", () => {
    // Salesforce returns no expires_in on refresh. now + undefined*1000 is NaN
    // -> null in Postgres -> the refresh branch is skipped forever and the
    // connection dies at the org's session timeout. The fallback must exist.
    const src = readFileSync("src/lib/crm-connection.ts", "utf8");
    expect(src).toMatch(/typeof tokens\.expires_in === "number" \? tokens\.expires_in : 90 \* 60/);
  });
});
