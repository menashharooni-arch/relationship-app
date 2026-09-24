import { describe, it, expect, vi, beforeEach } from "vitest";

// Owner order 2026-09-24: a contact exchanged through SwiftCard lands in the
// other person's phone WITH their headshot — or their company logo when there
// is no headshot. Both directions: the visitor saving the card, and the owner
// saving a lead who shared their info back.

// ── Fake data the resolver reads ────────────────────────────────────────────
let cardRows: Array<Record<string, unknown>> = [];
let profileByEmail: Record<string, unknown> | null = null;
let ownerPhoto: string | null = null;
const activeCards = new Set<string>();
const ilikeArgs: string[] = [];

vi.mock("@/lib/supabase-admin", () => ({ getAdminSupabase: () => admin }));

const admin = {
  from: (table: string) => ({
    select: () => ({
      ilike: (_col: string, v: string) => {
        ilikeArgs.push(v);
        if (table === "cards") {
          return { order: () => ({ limit: async () => ({ data: cardRows }) }) };
        }
        return { limit: () => ({ maybeSingle: async () => ({ data: profileByEmail }) }) };
      },
      eq: () => ({ maybeSingle: async () => ({ data: { photo_url: ownerPhoto } }) }),
    }),
  }),
};

vi.mock("@/lib/card-active", () => ({
  isCardActive: async (u: string) => activeCards.has(u),
  ownerIsDeleted: (c: unknown) => !!(c as { _deleted?: boolean } | null)?._deleted,
}));

// The branding provider: only the domain we hand it, and the guesses we script.
let providerConfigured = true;
let candidates: Array<{ name: string; domain: string; logoUrl: string }> = [];
const suggestCalls: string[] = [];
vi.mock("@/lib/logo-provider", async (orig) => {
  const real = await orig<typeof import("@/lib/logo-provider")>();
  return {
    ...real,
    getLogoProvider: () => ({
      id: "fake",
      isConfigured: () => providerConfigured,
      suggest: async (q: string) => {
        suggestCalls.push(q);
        return { status: candidates.length ? "ok" : "no_match", candidates };
      },
    }),
  };
});

import { resolveLeadImageUrl, escapeIlikeLiteral, withLogoSize } from "@/lib/contact-photo";
import { buildVCard, pickContactImage } from "@/lib/vcard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = admin as any;

beforeEach(() => {
  cardRows = [];
  profileByEmail = null;
  ownerPhoto = null;
  activeCards.clear();
  ilikeArgs.length = 0;
  providerConfigured = true;
  candidates = [];
  suggestCalls.length = 0;
});

describe("pickContactImage — headshot first, logo second", () => {
  it("prefers the headshot when both exist", () => {
    expect(pickContactImage("https://x/head.jpg", "https://x/logo.png")).toEqual({ url: "https://x/head.jpg", kind: "headshot" });
  });
  it("falls back to the logo when there is no headshot", () => {
    expect(pickContactImage(null, "https://x/logo.png")).toEqual({ url: "https://x/logo.png", kind: "logo" });
    expect(pickContactImage("   ", "https://x/logo.png")).toEqual({ url: "https://x/logo.png", kind: "logo" });
  });
  it("is null with neither", () => {
    expect(pickContactImage(null, undefined)).toBeNull();
    expect(pickContactImage("", "")).toBeNull();
  });
});

describe("resolveLeadImageUrl — a lead who is a SwiftCard user", () => {
  it("uses the headshot of the live card that carries the email they shared", async () => {
    cardRows = [{ username: "jane-acme", user_id: "u1", customization: { photoUrl: "https://cdn/jane.jpg" }, logo_url: "https://cdn/acme.png" }];
    activeCards.add("jane-acme");
    const out = await resolveLeadImageUrl(db, { email: "Jane@Acme.com" });
    expect(out).toEqual({ url: "https://cdn/jane.jpg", kind: "headshot" });
    expect(suggestCalls).toEqual([]); // never asks the provider when their own card answers
  });

  it("uses the card's logo when the card has no headshot", async () => {
    cardRows = [{ username: "jane-acme", user_id: "u1", customization: { photoUrl: null }, logo_url: "https://cdn/acme.png" }];
    activeCards.add("jane-acme");
    const out = await resolveLeadImageUrl(db, { email: "jane@acme.com" });
    expect(out).toEqual({ url: "https://cdn/acme.png", kind: "logo" });
  });

  it("legacy card with no photoUrl key inherits the account photo", async () => {
    cardRows = [{ username: "jane-acme", user_id: "u1", customization: {}, logo_url: null }];
    activeCards.add("jane-acme");
    ownerPhoto = "https://cdn/account.jpg";
    const out = await resolveLeadImageUrl(db, { email: "jane@acme.com" });
    expect(out).toEqual({ url: "https://cdn/account.jpg", kind: "headshot" });
  });

  it("never uses a card that is not publicly live", async () => {
    cardRows = [{ username: "jane-acme", user_id: "u1", customization: { photoUrl: "https://cdn/jane.jpg" }, logo_url: null }];
    // not in activeCards → offline / deleted / over plan limit
    const out = await resolveLeadImageUrl(db, { email: "jane@gmail.com" });
    expect(out).toBeNull();
  });

  it("falls back to the account photo of a profile with no card row", async () => {
    profileByEmail = { photo_url: "https://cdn/acct.jpg", customization: {} };
    const out = await resolveLeadImageUrl(db, { email: "jane@gmail.com" });
    expect(out).toEqual({ url: "https://cdn/acct.jpg", kind: "headshot" });
  });

  it("ignores a deleted account's photo", async () => {
    profileByEmail = { photo_url: "https://cdn/acct.jpg", customization: { _deleted: true } };
    const out = await resolveLeadImageUrl(db, { email: "jane@gmail.com" });
    expect(out).toBeNull();
  });

  it("matches the address literally — ilike wildcards are escaped", async () => {
    await resolveLeadImageUrl(db, { email: "a_b%c@acme.com" });
    expect(ilikeArgs[0]).toBe("a\\_b\\%c@acme.com");
    expect(escapeIlikeLiteral("x\\y")).toBe("x\\\\y");
  });
});

describe("resolveLeadImageUrl — a lead with a business email", () => {
  it("uses the company logo on an exact domain match", async () => {
    candidates = [
      { name: "Acme Corp", domain: "acmecorp.com", logoUrl: "https://img.logo.dev/acmecorp.com?token=pk" },
      { name: "Acme", domain: "acme.com", logoUrl: "https://img.logo.dev/acme.com?token=pk" },
    ];
    const out = await resolveLeadImageUrl(db, { email: "bob@acme.com" });
    expect(suggestCalls).toEqual(["acme.com"]);
    expect(out).toEqual({ url: "https://img.logo.dev/acme.com?token=pk&size=256", kind: "logo" });
  });

  it("accepts the parent domain of a subdomain address", async () => {
    candidates = [{ name: "Acme", domain: "acme.com", logoUrl: "https://cdn.example/acme.png" }];
    const out = await resolveLeadImageUrl(db, { email: "bob@mail.acme.com" });
    expect(out).toEqual({ url: "https://cdn.example/acme.png", kind: "logo" });
  });

  it("refuses a guess for a different company", async () => {
    candidates = [{ name: "Acme Corp", domain: "acmecorp.com", logoUrl: "https://cdn.example/acmecorp.png" }];
    const out = await resolveLeadImageUrl(db, { email: "bob@acme.com" });
    expect(out).toBeNull();
  });

  it("never asks for a logo on a personal mailbox", async () => {
    candidates = [{ name: "Google", domain: "gmail.com", logoUrl: "https://cdn.example/google.png" }];
    for (const email of ["bob@gmail.com", "bob@icloud.com", "bob@outlook.com"]) {
      expect(await resolveLeadImageUrl(db, { email })).toBeNull();
    }
    expect(suggestCalls).toEqual([]);
  });

  it("is null without a provider credential, without an email, or with junk", async () => {
    providerConfigured = false;
    candidates = [{ name: "Acme", domain: "acme.com", logoUrl: "https://cdn.example/acme.png" }];
    expect(await resolveLeadImageUrl(db, { email: "bob@acme.com" })).toBeNull();
    providerConfigured = true;
    expect(await resolveLeadImageUrl(db, { email: null })).toBeNull();
    expect(await resolveLeadImageUrl(db, { email: "not-an-email" })).toBeNull();
    expect(await resolveLeadImageUrl(db, {})).toBeNull();
  });

  it("withLogoSize only touches Logo.dev URLs and never overrides a size", () => {
    expect(withLogoSize("https://img.logo.dev/acme.com?token=pk")).toBe("https://img.logo.dev/acme.com?token=pk&size=256");
    expect(withLogoSize("https://img.logo.dev/acme.com?token=pk&size=64")).toBe("https://img.logo.dev/acme.com?token=pk&size=64");
    expect(withLogoSize("https://cdn.example/acme.png")).toBe("https://cdn.example/acme.png");
    expect(withLogoSize("not a url")).toBe("not a url");
  });
});

describe("buildVCard embeds the picture", () => {
  it("writes a folded PHOTO line with the right TYPE", () => {
    const v = buildVCard({ name: "Jane Doe" }, { base64: "iVBORw0KGgo=", mime: "image/png" });
    expect(v).toContain("PHOTO;ENCODING=b;TYPE=PNG:iVBORw0KGgo=");
    const j = buildVCard({ name: "Jane Doe" }, { base64: "/9j/4AAQ", mime: "image/jpeg" });
    expect(j).toContain("PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQ");
  });
  it("omits PHOTO when there is no picture", () => {
    expect(buildVCard({ name: "Jane Doe" }, null)).not.toContain("PHOTO");
  });
});
