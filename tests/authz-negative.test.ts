import { describe, it, expect } from "vitest";
import { isSelfTraffic, baseSlugForOwnerLookup } from "@/lib/self-traffic";
import { ownsLead } from "@/lib/lead-access";
import { resolveBrandTargetIds } from "@/lib/office-brand-targets";
import { buildClaimInsert } from "@/lib/draft-claim";

// ─────────────────────────────────────────────────────────────────────────────
// Negative authorization tests. There is NO database RLS in this app — tenant
// isolation is 100% these app-layer decisions, so every deny path below is the
// actual security boundary. Each helper is the pure core the route calls.
// ─────────────────────────────────────────────────────────────────────────────

// ── Owner self-traffic exclusion (analytics: views / card-events / event) ────
describe("isSelfTraffic — only the true owner is excluded", () => {
  it("excludes the owner viewing their OWN card (logged-in owner / own public link / preview)", () => {
    expect(isSelfTraffic("owner-1", "owner-1")).toBe(true);
  });

  it("does NOT exclude a different logged-in user (team member / office admin viewing a colleague's card)", () => {
    // A teammate or office admin is a legitimate visitor of someone else's card.
    expect(isSelfTraffic("owner-1", "teammate-2")).toBe(false);
    expect(isSelfTraffic("owner-1", "office-admin-3")).toBe(false);
  });

  it("does NOT exclude a signed-out visitor (no viewer id) — the common case", () => {
    // Shared device / same office IP while signed out still counts: exclusion is
    // identity-based, never IP-based, so a null viewer is always a real visitor.
    expect(isSelfTraffic("owner-1", null)).toBe(false);
    expect(isSelfTraffic("owner-1", undefined)).toBe(false);
    expect(isSelfTraffic("owner-1", "")).toBe(false);
  });

  it("never excludes when the slug has no resolvable owner", () => {
    expect(isSelfTraffic(null, "some-user")).toBe(false);
    expect(isSelfTraffic(undefined, "some-user")).toBe(false);
    expect(isSelfTraffic("", "")).toBe(false);
  });

  it("cannot collapse two different accounts into a self-match", () => {
    expect(isSelfTraffic("account-A", "account-B")).toBe(false);
  });

  it("resolves a SwiftLink surface back to its underlying card slug for the owner lookup", () => {
    // "<slug>__links" traffic must be attributed to the same owner as "<slug>".
    expect(baseSlugForOwnerLookup("jane__links")).toBe("jane");
    expect(baseSlugForOwnerLookup("jane")).toBe("jane");
    expect(baseSlugForOwnerLookup("a-b-c__links")).toBe("a-b-c");
    // Only a trailing suffix is stripped — a slug that merely contains it stands.
    expect(baseSlugForOwnerLookup("jane__links__links")).toBe("jane__links");
  });
});

// ── Lead / contact access (one user cannot touch another's contacts) ─────────
describe("ownsLead — cross-account contact isolation", () => {
  const mine = ["jane", "jane-acme"]; // this caller's own card slugs

  it("allows a lead captured on any of the caller's own cards", () => {
    expect(ownsLead(mine, { card_owner: "jane" })).toBe(true);
    expect(ownsLead(mine, { card_owner: "jane-acme" })).toBe(true);
  });

  it("DENIES a lead belonging to another user's card (guessed lead id / IDOR)", () => {
    expect(ownsLead(mine, { card_owner: "someone-else" })).toBe(false);
  });

  it("denies a missing lead and a lead with no owner (no accidental allow)", () => {
    expect(ownsLead(mine, null)).toBe(false);
    expect(ownsLead(mine, undefined)).toBe(false);
    expect(ownsLead(mine, { card_owner: null })).toBe(false);
    expect(ownsLead(mine, {})).toBe(false);
  });

  it("a user with no cards (sentinel list) matches nothing", () => {
    expect(ownsLead(["__none__"], { card_owner: "jane" })).toBe(false);
  });
});

// ── Office uniform branding (a stale membership cannot rebrand a card) ────────
describe("resolveBrandTargetIds — office branding blast radius", () => {
  it("targets the owner plus members still verifiably in the office", () => {
    const targets = resolveBrandTargetIds("owner", ["m1", "m2"], ["m1", "m2"]);
    expect(targets).toEqual(["owner", "m1", "m2"]);
  });

  it("EXCLUDES a member with a stale office_members row whose profile left the office", () => {
    // m2 switched teams / office lapsed: active in office_members but no longer
    // pointed at this office. Their live card must NOT be overwritten.
    const targets = resolveBrandTargetIds("owner", ["m1", "m2"], ["m1"]);
    expect(targets).toEqual(["owner", "m1"]);
    expect(targets).not.toContain("m2");
  });

  it("never rebrands a foreign account that isn't a verified member", () => {
    const targets = resolveBrandTargetIds("owner", ["m1"], ["m1", "cross-office-user"]);
    // cross-office-user isn't in the active-member list, so it's never targeted
    // even though it appears in the verified set.
    expect(targets).toEqual(["owner", "m1"]);
  });

  it("owner is always included exactly once, even if also listed as a member", () => {
    const targets = resolveBrandTargetIds("owner", ["owner", "m1"], ["owner", "m1"]);
    expect(targets).toEqual(["owner", "m1"]);
  });

  it("with no members, only the owner's own cards are branded", () => {
    expect(resolveBrandTargetIds("owner", [], [])).toEqual(["owner"]);
  });
});

// ── Guest draft claim (a draft always lands under the SESSION user) ──────────
describe("buildClaimInsert — a draft cannot be claimed onto another account", () => {
  it("ignores a payload-supplied user_id and attaches the row to the session user", () => {
    const r = buildClaimInsert("session-user", { username: "acme", user_id: "victim-id" }, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.insert.user_id).toBe("session-user");
    expect(r.insert.user_id).not.toBe("victim-id");
  });

  it("two different sessions claiming the same draft each get their OWN row owner", () => {
    const a = buildClaimInsert("user-A", { username: "shared" }, false);
    const b = buildClaimInsert("user-B", { username: "shared" }, false);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.insert.user_id).toBe("user-A");
    expect(b.insert.user_id).toBe("user-B");
  });
});
