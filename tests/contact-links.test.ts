import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bindViaLink,
  contactCardUrl,
  CONTACT_LINK_PARAM,
  isContactToken,
  MAX_DEVICES_PER_LINK,
  newContactToken,
  withContactToken,
} from "@/lib/contact-links";
import { confidenceOf, decideKnownContact } from "@/lib/known-contact";

// Warm-lead plan PR A5. A per-contact link is the only way a contact added by
// hand is ever recognised — and the easiest way to recognise the WRONG person
// if a scanner, a forward or a copied URL is mistaken for them.

type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let seq = 0;
let failInsert: string | null = null;

function table(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const rows = () => (db[name] ??= []);
  const matching = () => rows().filter((r) => filters.every((f) => f(r)));
  const q = {
    select() { return q; },
    eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return q; },
    is(c: string, v: unknown) { filters.push((r) => (r[c] ?? null) === v); return q; },
    in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return q; },
    update(p: Row) { patch = p; return q; },
    insert(row: Row) {
      if (failInsert === name) return Promise.resolve({ error: { code: "42P01" } });
      if (name === "contact_devices" && rows().some((r) => r.lead_id === row.lead_id && r.visitor_id === row.visitor_id)) {
        return Promise.resolve({ error: { code: "23505" } });
      }
      rows().push({ id: `row-${++seq}`, ...row });
      return Promise.resolve({ error: null });
    },
    maybeSingle() { return Promise.resolve({ data: matching()[0] ?? null, error: null }); },
    then(res: (v: unknown) => unknown) {
      if (patch) for (const r of matching()) Object.assign(r, patch);
      return Promise.resolve({ data: patch ? null : matching(), error: null }).then(res);
    },
  };
  return q;
}
const admin = { from: (n: string) => table(n) } as never;

const OWNER = "owner-1";
const TOKEN = "AbCdE12345";

beforeEach(() => {
  failInsert = null;
  db = {
    cards: [{ username: "dana-lee", user_id: OWNER }],
    profiles: [],
    contact_links: [{ id: "link-1", token: TOKEN, lead_id: "priya", owner_id: OWNER, open_count: 0, first_opened_at: null, devices_bound: 0, revoked_at: null }],
    contact_devices: [],
  };
});

describe("the token", () => {
  it("is 10 base62 characters and nothing else", () => {
    for (let i = 0; i < 50; i++) expect(isContactToken(newContactToken())).toBe(true);
    expect(isContactToken("short")).toBe(false);
    expect(isContactToken("AbCdE1234!")).toBe(false);
    expect(isContactToken(null)).toBe(false);
  });

  it("rides on a parameter Safari's Link Tracking Protection does not strip", () => {
    expect(CONTACT_LINK_PARAM).toBe("ct");
    expect(["fbclid", "gclid", "msclkid", "mc_eid", "dclid", "igshid", "twclid", "ttclid"]).not.toContain(CONTACT_LINK_PARAM);
  });

  it("is appended without breaking a query the link already has", () => {
    expect(withContactToken("https://swiftcard.me/dana", TOKEN)).toBe(`https://swiftcard.me/dana?ct=${TOKEN}`);
    expect(withContactToken("https://swiftcard.me/dana?shared=1", TOKEN)).toBe(`https://swiftcard.me/dana?shared=1&ct=${TOKEN}`);
  });
});

describe("minting a contact's link", () => {
  it("returns a tracked URL and records who it was for", async () => {
    const url = await contactCardUrl(admin, { leadId: "priya", cardSlug: "dana-lee", channel: "sms" });
    expect(url).toMatch(/^https:\/\/swiftcard\.me\/dana-lee\?ct=[A-Za-z0-9]{10}$/);
    expect(db.contact_links.at(-1)).toMatchObject({ lead_id: "priya", owner_id: OWNER, channel: "sms" });
  });

  it("falls back to the plain card link when it can't record the token", async () => {
    failInsert = "contact_links";
    expect(await contactCardUrl(admin, { leadId: "priya", cardSlug: "dana-lee", channel: "email" })).toBe("https://swiftcard.me/dana-lee");
  });

  it("never mints for a message that isn't to a known lead", async () => {
    expect(await contactCardUrl(admin, { leadId: null, cardSlug: "dana-lee", channel: "email" })).toBe("https://swiftcard.me/dana-lee");
  });
});

describe("a human opening the link", () => {
  it("binds that browser to the contact as the link's first device", async () => {
    const r = await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "phone-a" });
    expect(r).toMatchObject({ status: "bound", leadId: "priya", firstDevice: true });
    expect(db.contact_devices[0]).toMatchObject({ lead_id: "priya", visitor_id: "phone-a", bound_via: "link", link_device_index: 1 });
    expect(db.contact_links[0]).toMatchObject({ open_count: 1, devices_bound: 1 });
  });

  it("a second browser is marked as a forwarded open, and is never named", async () => {
    await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "phone-a" });
    const r = await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "husbands-phone" });
    expect(r).toMatchObject({ status: "bound", firstDevice: false });
    const b = db.contact_devices.find((d) => d.visitor_id === "husbands-phone")!;
    expect(confidenceOf(b as never)).toBe("forwarded");
    const resolved = decideKnownContact(
      [b as never],
      [{ id: "priya", name: "Priya", email: null, phone: null, card_owner: "dana-lee", created_at: "t", status: null, tags: [], where_met: null }],
      { emails: new Set(), phones: new Set() },
    );
    expect(resolved).toMatchObject({ kind: "known", confidence: "forwarded" });
  });

  it(`binds at most ${MAX_DEVICES_PER_LINK} browsers per link`, async () => {
    for (const v of ["a", "b", "c"]) await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: `device-${v}` });
    expect(await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "device-d" })).toMatchObject({ status: "capped" });
    expect(db.contact_devices).toHaveLength(MAX_DEVICES_PER_LINK);
  });

  it("re-opening from the same browser is not a new device", async () => {
    await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "phone-a" });
    expect(await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "phone-a" })).toMatchObject({ status: "already" });
    expect(db.contact_links[0].devices_bound).toBe(1);
  });

  it("does nothing on another owner's card, for a revoked link, or for a made-up token", async () => {
    expect(await bindViaLink(admin, { token: TOKEN, ownerId: "someone-else", visitorId: "x" })).toEqual({ status: "invalid" });
    expect(await bindViaLink(admin, { token: "ZZZZZ99999", ownerId: OWNER, visitorId: "x" })).toEqual({ status: "invalid" });
    db.contact_links[0].revoked_at = "2026-09-18T00:00:00Z";
    expect(await bindViaLink(admin, { token: TOKEN, ownerId: OWNER, visitorId: "x" })).toEqual({ status: "invalid" });
    expect(db.contact_devices).toHaveLength(0);
  });
});

describe("wired the way the rules assume", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const tracker = read("src/components/CardEventTracker.tsx");
  const events = read("src/app/api/card-events/route.ts");
  const messaging = read("src/lib/messaging.ts");
  const share = read("src/app/api/leads/share-card/route.ts");
  const unsub = read("src/app/api/unsubscribe/contact/route.ts");

  it("the tracker strips the token from the address bar before the human gate, and sends it only after", () => {
    expect(tracker).toMatch(/const CONTACT_LINK_PARAM = "ct";/);
    expect(tracker).toMatch(/window\.history\.replaceState\(/);
    const take = tracker.indexOf("const token = takeContactToken();");
    const gate = tracker.indexOf("await waitForHuman(");
    const send = tracker.indexOf("contact_token: token");
    expect(take).toBeGreaterThan(-1);
    expect(take).toBeLessThan(gate);
    expect(send).toBeGreaterThan(gate);
  });

  it("the server binds only on a view, never from a datacenter, after the owner check and before the resolution", () => {
    expect(events).toMatch(/if \(contact_token && event_type === "viewed_card" && ownerId\)/);
    expect(events).toMatch(/if \(!tokenGeo\.isHosting && rateOk\)/);
    const owner = events.indexOf("isOwnerActivity(");
    const bind = events.indexOf("bindViaLink(admin");
    const resolve = events.indexOf("resolveKnownContact(admin");
    expect(owner).toBeLessThan(bind);
    expect(bind).toBeLessThan(resolve);
  });

  it("follow-up texts and emails carry the contact's own link", () => {
    expect(messaging).toMatch(/contactCardUrl\(getAdminSupabase\(\), \{ leadId: opts\.leadId, cardSlug: opts\.cardUsername, channel: "sms" \}\)/);
    expect(messaging).toMatch(/contactCardUrl\(getAdminSupabase\(\), \{ leadId: opts\.leadId, cardSlug: opts\.cardUsername, channel: "email" \}\)/);
  });

  it("share-card sends the tracked link but shows the plain address", () => {
    expect(share).toMatch(/channel: "share_card", base: plainCardUrl/);
    expect(share).toMatch(/esc\(plainCardUrl\.replace/);
  });

  it("unsubscribing stops the person's links recognising anyone", () => {
    expect((unsub.match(/revokeContactLinksForEmail\(/g) ?? []).length).toBe(2);
  });
});
