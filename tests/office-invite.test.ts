import { describe, it, expect } from "vitest";
import { isInviteExpired, inviteDaysLeft, INVITE_TTL_MS } from "@/lib/office-invite";

const now = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("isInviteExpired", () => {
  it("uses stored expires_at when present", () => {
    expect(isInviteExpired({ status: "pending", expires_at: new Date(now + DAY).toISOString() }, now)).toBe(false);
    expect(isInviteExpired({ status: "pending", expires_at: new Date(now - DAY).toISOString() }, now)).toBe(true);
  });

  it("falls back to created_at + TTL when expires_at is absent", () => {
    expect(isInviteExpired({ status: "pending", created_at: new Date(now - (INVITE_TTL_MS - DAY)).toISOString() }, now)).toBe(false);
    expect(isInviteExpired({ status: "pending", created_at: new Date(now - (INVITE_TTL_MS + DAY)).toISOString() }, now)).toBe(true);
  });

  it("only pending invites can expire (active/revoked/declined never do)", () => {
    const old = new Date(now - 10 * INVITE_TTL_MS).toISOString();
    expect(isInviteExpired({ status: "active", created_at: old }, now)).toBe(false);
    expect(isInviteExpired({ status: "revoked", created_at: old }, now)).toBe(false);
    expect(isInviteExpired({ status: "declined", created_at: old }, now)).toBe(false);
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
  it("falls back to created_at + TTL", () => {
    expect(inviteDaysLeft({ created_at: new Date(now).toISOString() }, now)).toBe(14);
  });
});
