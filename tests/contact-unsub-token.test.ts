import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { contactUnsubUrl, verifyContactUnsubToken } from "@/lib/messaging";

// The signed token behind the invite's and every lead follow-up's one-click
// unsubscribe. Signing must fail LOUDLY (never sign with a public constant);
// verifying must fail QUIETLY (a 500 on the List-Unsubscribe-Post endpoint reads
// to providers as a broken opt-out, which is worse than sending no header).

function tokenFor(email: string): string {
  return new URL(contactUnsubUrl(email)).searchParams.get("token")!;
}

describe("contact unsubscribe token", () => {
  const prevOauth = process.env.OAUTH_SECRET;
  const prevCron = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.OAUTH_SECRET = "a".repeat(64);
    delete process.env.CRON_SECRET;
  });
  afterEach(() => {
    if (prevOauth === undefined) delete process.env.OAUTH_SECRET;
    else process.env.OAUTH_SECRET = prevOauth;
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
  });

  it("round-trips and normalizes the address", () => {
    expect(verifyContactUnsubToken(tokenFor("  Dana@Example.COM "))).toBe("dana@example.com");
  });

  it("rejects a tampered signature", () => {
    const t = tokenFor("dana@example.com");
    const [encoded, sig] = t.split(".");
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(verifyContactUnsubToken(`${encoded}.${flipped}`)).toBeNull();
  });

  it("returns null rather than throwing on a wrong-length signature", () => {
    // timingSafeEqual throws on unequal buffer lengths — that must not surface
    // as a 500 from the one-click endpoint.
    expect(() => verifyContactUnsubToken("abc.xy")).not.toThrow();
    expect(verifyContactUnsubToken("abc.xy")).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifyContactUnsubToken("")).toBeNull();
    expect(verifyContactUnsubToken("nodot")).toBeNull();
  });

  it("with no secret: VERIFY rejects cleanly, SIGN fails loudly", () => {
    const t = tokenFor("dana@example.com");
    delete process.env.OAUTH_SECRET;
    delete process.env.CRON_SECRET;
    // Regression test for the secret lookup that used to sit outside the try.
    expect(() => verifyContactUnsubToken(t)).not.toThrow();
    expect(verifyContactUnsubToken(t)).toBeNull();
    expect(() => contactUnsubUrl("dana@example.com")).toThrow();
  });
});
