import { describe, it, expect } from "vitest";
import { mergeClientTags, RESERVED_LEAD_TAG } from "@/lib/lead-tags";

// Reserved lead tags are server-owned; a client PATCH must not set or clear
// them. These tests pin the exact protection: cross-org injection and the Free
// paywall/automation tags are preserved from the row, client tags are honored.

describe("mergeClientTags — server-owned tags are protected", () => {
  it("drops a client-injected cross-org tag", () => {
    const out = mergeClientTags(["sc-office-victimOrg", "unread"], []);
    expect(out).toEqual(["unread"]);
    expect(out).not.toContain("sc-office-victimOrg");
  });

  it("preserves the paywall lock even when the client omits it", () => {
    // Free user tries to unlock a capped lead by sending tags without sc-locked.
    const out = mergeClientTags(["unread"], ["sc-locked"]);
    expect(out).toContain("sc-locked");
    expect(out).toContain("unread");
  });

  it("keeps the row's real org tag when the client can't see it", () => {
    const out = mergeClientTags(["contacted"], ["sc-office-realOrg", "preset-warm"]);
    expect(out).toContain("sc-office-realOrg");
    expect(out).toContain("preset-warm");
    expect(out).toContain("contacted");
  });

  it("ignores client attempts to pause/unpause automation", () => {
    expect(mergeClientTags(["flow-paused"], [])).toEqual([]);
    expect(mergeClientTags(["email-paused", "sms-paused"], [])).toEqual([]);
    // and can't strip an existing pause
    expect(mergeClientTags([], ["flow-paused"])).toEqual(["flow-paused"]);
  });

  it("protects the SMS consent marker (sms-ok) — client can't forge or strip it", () => {
    // A client can't fabricate consent by injecting sms-ok…
    expect(mergeClientTags(["sms-ok", "unread"], [])).toEqual(["unread"]);
    // …and can't strip an existing consent (or lack of it) off the row.
    expect(mergeClientTags(["unread"], ["sms-ok"])).toContain("sms-ok");
  });

  it("de-duplicates and tolerates non-string / non-array input", () => {
    expect(mergeClientTags(["a", "a", "b"], [])).toEqual(["a", "b"]);
    expect(mergeClientTags(null, ["sc-locked"])).toEqual(["sc-locked"]);
    expect(mergeClientTags([1, "ok", null], [])).toEqual(["ok"]);
  });

  it("regex matches exactly the reserved namespaces", () => {
    for (const t of ["sc-office-x", "sc-locked", "flow-paused", "email-paused", "sms-paused", "preset-warm"]) {
      expect(RESERVED_LEAD_TAG.test(t)).toBe(true);
    }
    for (const t of ["unread", "contacted", "vip", "sc-lockedx", "email", "presets"]) {
      expect(RESERVED_LEAD_TAG.test(t)).toBe(false);
    }
  });
});
