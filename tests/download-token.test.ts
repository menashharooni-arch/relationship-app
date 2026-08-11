import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// oauth-state and download-token both fail closed without a signing key — give
// the tests one, like every deployed environment has.
process.env.OAUTH_SECRET ||= "b".repeat(64);

import {
  signDownloadToken,
  verifyDownloadToken,
  isDownloadablePath,
  DOWNLOADABLE_PATHS,
} from "@/lib/download-token";
import { signState } from "@/lib/oauth-state";

// ── Download tokens carry identity where a cookie cannot ─────────────────────
//
// The iOS shell hands downloads to the SYSTEM browser, which uses Safari's
// cookie jar — the webview's Supabase session does not cross. So "Export CSV"
// and "Save to phone" opened a Safari sheet showing Unauthorized. The token puts
// identity in the URL instead, which means the URL is now a bearer credential
// for someone's contact list. These tests pin the properties that keep that
// safe; a regression here is a data-exposure bug, not a broken button.

const USER = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

describe("download token", () => {
  it("round-trips the user id for the path it was minted for", () => {
    const t = signDownloadToken(USER, "/api/leads/export");
    expect(verifyDownloadToken(t, "/api/leads/export")).toBe(USER);
  });

  it("cannot be spent at a DIFFERENT endpoint", () => {
    // Without the path binding, a token for the (Pro-gated, whole-contact-list)
    // CSV export could be replayed against any other route that trusts these.
    const t = signDownloadToken(USER, "/api/leads/vcard");
    expect(verifyDownloadToken(t, "/api/leads/export")).toBeNull();
    expect(verifyDownloadToken(t, "/api/office/analytics/export")).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const t = signDownloadToken(USER, "/api/leads/export");
    const [payload] = t.split(".");
    expect(verifyDownloadToken(`${payload}.deadbeef`, "/api/leads/export")).toBeNull();
  });

  it("rejects a re-encoded payload naming someone else", () => {
    // The attack the signature exists to stop: keep a valid-looking shape but
    // swap the user id for a victim's.
    const t = signDownloadToken(USER, "/api/leads/export");
    const sig = t.split(".")[1];
    const forged = Buffer.from(`${OTHER}|/api/leads/export|${Date.now()}`).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${sig}`, "/api/leads/export")).toBeNull();
  });

  it("rejects junk without throwing", () => {
    for (const junk of ["", ".", "a.b.c", "not-a-token", "!!!.???"]) {
      expect(verifyDownloadToken(junk, "/api/leads/export")).toBeNull();
    }
  });

  it("does not accept an OAuth state token", () => {
    // signState() carries only a user id and lives 15 minutes. If these two
    // shared a format, an OAuth state could be spent as a download credential.
    const state = signState(USER);
    expect(verifyDownloadToken(state, "/api/leads/export")).toBeNull();
  });

  describe("expiry", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("lives 60 seconds and no longer", () => {
      vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
      const t = signDownloadToken(USER, "/api/leads/export");

      vi.setSystemTime(new Date("2026-08-11T12:00:59Z"));
      expect(verifyDownloadToken(t, "/api/leads/export"), "still valid at 59s").toBe(USER);

      vi.setSystemTime(new Date("2026-08-11T12:01:01Z"));
      expect(verifyDownloadToken(t, "/api/leads/export"), "expired at 61s").toBeNull();
    });
  });
});

describe("mintable paths are an allowlist", () => {
  it("accepts exactly the three authenticated download routes", () => {
    expect([...DOWNLOADABLE_PATHS]).toEqual([
      "/api/leads/export",
      "/api/leads/vcard",
      "/api/office/analytics/export",
    ]);
  });

  it("refuses anything else", () => {
    // Without this the mint endpoint would sign a token for whatever path the
    // caller names — a confused deputy the moment another route trusts them.
    for (const p of [
      "/api/admin/users/export",
      "/api/leads",
      "../api/leads/export",
      "/api/leads/export/",
      "https://evil.example/api/leads/export",
      "",
    ]) {
      expect(isDownloadablePath(p), `should refuse ${p}`).toBe(false);
    }
  });
});
