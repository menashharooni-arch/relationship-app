import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { requestLocation } from "@/lib/request-geo";

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION IS THIS REQUEST'S OWN EDGE GEO, HONESTLY DEGRADED.
//
// Audit scenario (14): VPN/proxy/missing data must fail honestly — null, a
// bare city, or a bare country code; never a placeholder, and NEVER a throw.
// An unguarded decodeURIComponent on x-vercel-ip-city once turned one
// malformed header into a 500 that lost the lead being captured.
// ─────────────────────────────────────────────────────────────────────────────

function reqWith(headers: Record<string, string>): NextRequest {
  return { headers: { get: (k: string) => headers[k] ?? null } } as unknown as NextRequest;
}

describe("requestLocation", () => {
  it("city + country → 'City, CC', with percent-encoding decoded", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "Austin", "x-vercel-ip-country": "US" }))).toBe("Austin, US");
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" }))).toBe("São Paulo, BR");
  });

  it("keeps a city even when the country header is missing — it used to be discarded", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "Austin" }))).toBe("Austin");
  });

  it("keeps a bare country when that's all there is", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-country": "US" }))).toBe("US");
  });

  it("no headers → null, never a placeholder", () => {
    expect(requestLocation(reqWith({}))).toBeNull();
  });

  it("a malformed percent-sequence degrades to absent instead of throwing", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "%E0%A4%A", "x-vercel-ip-country": "IN" }))).toBe("IN");
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "%ZZ" }))).toBeNull();
  });

  it("rejects a country that isn't a bare ISO code (spoofed/garbled header)", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-country": "us" }))).toBeNull();
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "Austin", "x-vercel-ip-country": "USA!" }))).toBe("Austin");
  });

  it("caps a forged oversized city", () => {
    const loc = requestLocation(reqWith({ "x-vercel-ip-city": "A".repeat(500), "x-vercel-ip-country": "US" }));
    expect(loc!.length).toBeLessThanOrEqual(84);
  });

  it("whitespace-only city is absent, not an empty label", () => {
    expect(requestLocation(reqWith({ "x-vercel-ip-city": "%20%20" }))).toBeNull();
  });
});
