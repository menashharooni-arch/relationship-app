import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { isInviteExpired, inviteDaysLeft, INVITE_TTL_MS } from "@/lib/office-invite";

const now = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("isInviteExpired", () => {
  it("uses stored expires_at when present", () => {
    expect(isInviteExpired({ status: "pending", expires_at: new Date(now + DAY).toISOString() }, now)).toBe(false);
    expect(isInviteExpired({ status: "pending", expires_at: new Date(now - DAY).toISOString() }, now)).toBe(true);
  });

  it("falls back to invited_at + TTL when expires_at is absent", () => {
    expect(isInviteExpired({ status: "pending", invited_at: new Date(now - (INVITE_TTL_MS - DAY)).toISOString() }, now)).toBe(false);
    expect(isInviteExpired({ status: "pending", invited_at: new Date(now - (INVITE_TTL_MS + DAY)).toISOString() }, now)).toBe(true);
  });

  it("only pending invites can expire (active/revoked/declined never do)", () => {
    const old = new Date(now - 10 * INVITE_TTL_MS).toISOString();
    expect(isInviteExpired({ status: "active", invited_at: old }, now)).toBe(false);
    expect(isInviteExpired({ status: "revoked", invited_at: old }, now)).toBe(false);
    expect(isInviteExpired({ status: "declined", invited_at: old }, now)).toBe(false);
  });

  it("no timestamps → not expired (can't prove it)", () => {
    expect(isInviteExpired({ status: "pending" }, now)).toBe(false);
  });
});

describe("inviteDaysLeft", () => {
  it("rounds up whole days remaining", () => {
    expect(inviteDaysLeft({ expires_at: new Date(now + 3 * DAY + 1000).toISOString() }, now)).toBe(4);
    expect(inviteDaysLeft({ expires_at: new Date(now + 6 * DAY).toISOString() }, now)).toBe(6);
  });
  it("is 0 once expired", () => {
    expect(inviteDaysLeft({ expires_at: new Date(now - DAY).toISOString() }, now)).toBe(0);
  });
  it("falls back to invited_at + TTL", () => {
    expect(inviteDaysLeft({ invited_at: new Date(now).toISOString() }, now)).toBe(14);
  });
});

// ── Guard: office_members has no created_at column ──────────────────────────
// It is `invited_at` (default now()). PostgREST fails the WHOLE query when a
// select names a column that doesn't exist, so a single stray `created_at`
// silently returned null instead of erroring loudly — which emptied the admin
// Team page's pending-invite list and made the pending-seat count read zero.
// Nothing in the UI showed an error, so it went unnoticed. This scans every
// office_members query chain in the source for the wrong column name.
describe("office_members queries use invited_at, never created_at", () => {
  const files = [
    "src/lib/office-team.ts",
    "src/lib/office-seats.ts",
    "src/app/api/office/invite/route.ts",
    "src/app/api/office/members/route.ts",
    "src/app/api/office/role/route.ts",
    "src/app/api/office/decline/route.ts",
    "src/app/api/join/route.ts",
  ];

  it("no office_members select/update references created_at", () => {
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      const needle = 'from("office_members")';
      let idx = src.indexOf(needle);
      while (idx !== -1) {
        // The chained .select()/.update() follows the .from() call; 300 chars
        // comfortably covers the longest chain in these files. Comments are
        // stripped first — the fix notes deliberately NAME the wrong column to
        // explain why it's wrong, and that shouldn't trip the guard.
        const chain = src.slice(idx, idx + 300).replace(/\/\/[^\n]*/g, "");
        expect(chain, `${file}: office_members chain must not use created_at`).not.toMatch(/created_at/);
        idx = src.indexOf(needle, idx + needle.length);
      }
    }
  });
});
