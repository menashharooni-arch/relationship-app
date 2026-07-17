import { describe, it, expect } from "vitest";
import { GET } from "@/app/.well-known/apple-app-site-association/route";

// Item 8 — Apple App Site Association file. Purely additive: a brand-new route
// with no existing behavior to change.

describe("Item 8 — /.well-known/apple-app-site-association", () => {
  it("serves valid AASA JSON with a JSON content-type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toHaveProperty("applinks");
    expect(body.applinks.apps).toEqual([]);
    expect(Array.isArray(body.applinks.details)).toBe(true);
  });

  it("declares the bundle id and the card/links paths", async () => {
    const body = await (await GET()).json();
    const detail = body.applinks.details[0];
    expect(detail.appID).toContain("me.swiftcard.app");
    expect(detail.paths).toEqual(["/card/*", "/links/*", "/join/*", "/auth/callback"]);
  });

  it("uses a clearly-marked Team ID placeholder (real value is an owner action)", async () => {
    const body = await (await GET()).json();
    expect(body.applinks.details[0].appID).toMatch(/^TEAMID_PLACEHOLDER\./);
  });
});
