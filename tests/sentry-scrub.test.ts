import { describe, it, expect } from "vitest";
import { scrubEvent, scrubDeep, scrubString, scrubUrl } from "@/lib/sentry-scrub";

// The promise is "contact data never leaves our stack". A dashboard can't prove
// that — a scrubber that silently stopped matching looks exactly like a scrubber
// that's working. These tests are the proof.
//
// Each case is a real leak path, not a hypothetical: Postgres puts the offending
// VALUE in its error text, fetch embeds the whole URL, and a breadcrumb can carry
// an entire request body.

const LEAD_EMAIL = "jordan.reed@northwind-realty.com";
const LEAD_PHONE = "+1 (512) 555-0147";

describe("free-text redaction", () => {
  it("strips an email out of a Postgres constraint error", () => {
    // The exact shape that leaks: the value is inside the message, not a field.
    const msg = `duplicate key value violates unique constraint "leads_email_key" DETAIL: Key (email)=(${LEAD_EMAIL}) already exists.`;
    const out = scrubString(msg);
    expect(out).not.toContain(LEAD_EMAIL);
    expect(out).not.toContain("northwind-realty");
    // The diagnostic half must survive, or we've traded a leak for a blind spot.
    expect(out).toContain("leads_email_key");
  });

  it("strips phone numbers in the formats we actually store", () => {
    for (const p of [LEAD_PHONE, "512-555-0147", "512.555.0147", "+15125550147"]) {
      expect(scrubString(`Twilio rejected ${p}`), p).not.toContain("555");
    }
  });

  it("does NOT eat numbers that make a stack trace readable", () => {
    // Over-redaction destroys the thing we're here to read. Line/column numbers,
    // ports, timestamps and byte counts must survive.
    const trace = "at handler (/src/app/api/leads/route.ts:227:15) took 1043ms, 8721 bytes, port 3000";
    expect(scrubString(trace)).toBe(trace);
  });

  it("leaves a card slug alone — it's public by design", () => {
    // Slugs appear in public URLs and are how you tell WHICH card broke.
    expect(scrubString("/card/jordan-reed?shared=1")).toContain("jordan-reed");
  });
});

describe("deep scrubbing", () => {
  it("drops lead-owned fields at any depth, whatever the key casing", () => {
    const out = scrubDeep({
      lead: { name: "Jordan Reed", email: LEAD_EMAIL, phone: LEAD_PHONE },
      nested: { deeper: { where_met: "Austin Expo", convoDetails: "wants Q4 space" } },
      "COMPANY-DESCRIPTION": "a real estate brokerage",
    });
    const json = JSON.stringify(out);
    for (const secret of ["Jordan Reed", LEAD_EMAIL, "Austin Expo", "wants Q4 space", "brokerage"]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("drops credentials, which are worse than PII if stored", () => {
    const out = scrubDeep({
      headers: { authorization: "Bearer sk_live_abc123", cookie: "sb-access-token=xyz" },
      api_token: "pat-na1-secret",
      serviceRoleKey: "eyJhbGciOi",
    });
    const json = JSON.stringify(out);
    for (const secret of ["sk_live_abc123", "sb-access-token", "pat-na1-secret", "eyJhbGciOi"]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("keeps the non-sensitive shape that makes an error diagnosable", () => {
    const out = scrubDeep({ status: 403, provider: "highlevel", cardOwner: "jordan-reed", retries: 2 });
    expect(out).toEqual({ status: 403, provider: "highlevel", cardOwner: "jordan-reed", retries: 2 });
  });

  it("survives cycles-by-depth and doesn't recurse forever", () => {
    // Deeply nested payloads shouldn't blow the stack inside beforeSend.
    let deep: Record<string, unknown> = { email: LEAD_EMAIL };
    for (let i = 0; i < 40; i++) deep = { nest: deep };
    expect(() => scrubDeep(deep)).not.toThrow();
    expect(JSON.stringify(scrubDeep(deep))).not.toContain(LEAD_EMAIL);
  });
});

describe("URL scrubbing", () => {
  it("keeps the path, drops the query string", () => {
    // The path is the diagnostic value; the query is where PII rides along.
    expect(scrubUrl("/api/leads/share-card?email=" + LEAD_EMAIL)).toBe("/api/leads/share-card?[redacted]");
  });

  it("still redacts PII embedded in a path", () => {
    expect(scrubUrl(`/api/x/${LEAD_EMAIL}`)).not.toContain("jordan.reed");
  });
});

describe("scrubEvent — the beforeSend contract", () => {
  it("drops request bodies, cookies and query strings outright", () => {
    const out = scrubEvent({
      request: {
        url: "https://swiftcard.me/api/leads?phone=" + LEAD_PHONE,
        data: { name: "Jordan Reed", email: LEAD_EMAIL, phone: LEAD_PHONE },
        cookies: { "sb-access-token": "xyz" },
        query_string: "phone=" + LEAD_PHONE,
        headers: { authorization: "Bearer secret", "user-agent": "Mozilla/5.0", cookie: "a=b" },
      },
    });
    expect(out).not.toBeNull();
    expect(out!.request!.data).toBeUndefined();
    expect(out!.request!.cookies).toBeUndefined();
    expect(out!.request!.query_string).toBeUndefined();
    // Only the allow-listed header survives — everything else is dropped, not reviewed.
    expect(out!.request!.headers).toEqual({ "user-agent": "Mozilla/5.0" });
    expect(JSON.stringify(out)).not.toContain("Jordan Reed");
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("reduces user to an opaque id and nothing else", () => {
    // Keeping the id is what turns 400 anonymous errors into "one user, 400
    // times". A UUID identifies nobody outside our own database.
    const out = scrubEvent({ user: { id: "uuid-123", email: LEAD_EMAIL, username: "jordan" } });
    expect(out!.user).toEqual({ id: "uuid-123" });
  });

  it("scrubs the exception message, where Postgres leaks values", () => {
    const out = scrubEvent({
      exception: { values: [{ type: "PostgresError", value: `Key (email)=(${LEAD_EMAIL}) already exists.` }] },
    });
    expect(out!.exception!.values![0].value).not.toContain(LEAD_EMAIL);
    // Type is preserved — it's how the issue groups.
    expect(out!.exception!.values![0].type).toBe("PostgresError");
  });

  it("scrubs breadcrumbs, extra, tags and contexts", () => {
    const out = scrubEvent({
      breadcrumbs: [{ message: `POST /api/leads ${LEAD_EMAIL}`, data: { phone: LEAD_PHONE } }],
      extra: { lead: { email: LEAD_EMAIL } },
      tags: { note: LEAD_EMAIL },
      contexts: { custom: { email: LEAD_EMAIL } },
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain(LEAD_EMAIL);
    expect(json).not.toContain("555-0147");
  });

  it("FAILS CLOSED — discards the event if scrubbing throws", () => {
    // The only safe direction. Sending a raw event because the scrubber broke is
    // exactly the outcome this whole file exists to prevent.
    const hostile = { get request(): never { throw new Error("boom"); } };
    expect(scrubEvent(hostile as never)).toBeNull();
  });

  it("passes through an event with nothing sensitive in it", () => {
    const clean = { message: "Stripe webhook signature mismatch", tags: { route: "/api/stripe/webhook" } };
    expect(scrubEvent({ ...clean })).toEqual(clean);
  });
});
