import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { cardEventNotice } from "@/lib/card-event-notify";

// A card owner reported that someone opened their card and nothing happened:
// no notification, and nothing in that person's conversation. Both were real,
// and both were quiet — every piece recorded correctly, the pieces just never
// met. These tests pin the joins that were missing.

describe("what the owner is told", () => {
  it("announces a view, which used to be silent by design", () => {
    const n = cardEventNotice({ eventType: "viewed_card", visitorName: "Aaron Lavi" });
    expect(n).not.toBeNull();
    expect(n!.type).toBe("card_viewed");
    expect(n!.body).toBe("Aaron Lavi viewed your card.");
  });

  it("says Someone when the visitor is genuinely unknown, rather than guessing", () => {
    for (const name of [null, undefined, "", "   "]) {
      expect(cardEventNotice({ eventType: "viewed_card", visitorName: name })!.body)
        .toBe("Someone viewed your card.");
    }
  });

  it("distinguishes a Swift Links view from a card view", () => {
    expect(cardEventNotice({ eventType: "viewed_card", visitorName: "Aaron", source: "swift_links" })!.body)
      .toBe("Aaron viewed your Swift Links.");
    expect(cardEventNotice({ eventType: "viewed_card", visitorName: "Aaron", source: "qr_code" })!.body)
      .toBe("Aaron viewed your card.");
  });

  it("keeps the save notification, and names the source only there", () => {
    const saved = cardEventNotice({ eventType: "downloaded_vcard", visitorName: "Aaron", source: "qr_code" });
    expect(saved!.type).toBe("contact_saved");
    expect(saved!.body).toMatch(/^Aaron saved your contact card from /);

    // A view's source is noise on the most frequent notification an owner gets.
    expect(cardEventNotice({ eventType: "viewed_card", visitorName: "Aaron", source: "qr_code" })!.body)
      .not.toMatch(/from/);

    // direct_link is the default and reads as clutter.
    expect(cardEventNotice({ eventType: "downloaded_vcard", visitorName: "Aaron", source: "direct_link" })!.body)
      .toBe("Aaron saved your contact card.");
  });

  it("stays silent for events that are not news", () => {
    for (const t of ["clicked_save_contact", "clicked_link", "unknown_event", ""]) {
      expect(cardEventNotice({ eventType: t })).toBeNull();
    }
  });
});

// ── The joins, pinned at the source ─────────────────────────────────────────
// These read the files rather than mounting React. What broke here was not
// logic inside a component — it was a field left off a request body in three
// places, which no unit test of those components would have noticed.

const read = (p: string) => readFile(p, "utf8");

describe("a contact is always linked to its own activity", () => {
  it("every surface that creates a contact sends visitor_id", async () => {
    // SaveContactButton, ConnectButton and SocialLinkIntercept all POSTed to
    // /api/leads without it, so the contact row stored null — and the
    // conversation view joins card_events BY visitor_id. The events existed;
    // they had nothing to attach to.
    for (const f of ["SaveContactButton", "ConnectButton", "SocialLinkIntercept", "LeadCaptureForm"]) {
      const src = await read(`src/components/${f}.tsx`);
      const leadPost = src.slice(src.indexOf('fetch("/api/leads"'));
      expect(leadPost.length, `${f}: no /api/leads call found`).toBeGreaterThan(0);
      expect(leadPost.slice(0, 900), `${f} must send visitor_id`).toMatch(/visitor_id:/);
    }
  });

  it("the conversation asks by lead, and never bails on a missing visitor id", async () => {
    const src = await read("src/components/ContactsClient.tsx");
    expect(src).toMatch(/card-events\?lead_id=/);
    // The client half of the same bug: a contact with no visitor_id returned
    // early and never even asked, so its conversation was empty by construction.
    expect(src).not.toMatch(/if \(!lead\.visitor_id\) return;/);
  });

  it("a view carries who it was, once that is known", async () => {
    // Views used to send only the browser id, which is why they could never be
    // attributed to a person or named in a notification.
    const src = await read("src/components/CardEventTracker.tsx");
    expect(src).toMatch(/getVisitorInfo/);
    expect(src).toMatch(/visitor_name:/);
    expect(src).toMatch(/visitor_email:/);
  });
});

describe("the bell does not wait", () => {
  it("polls on mount and when the app comes back to the foreground", async () => {
    const src = await read("src/components/NotificationBell.tsx");
    // A 30s interval alone meant opening the app showed state from up to half a
    // minute ago — after a push had already buzzed the phone.
    expect(src).toMatch(/visibilitychange/);
    expect(src).toMatch(/addEventListener\("focus"/);
    // Called immediately, not only inside setInterval.
    expect(src).toMatch(/\n\s*poll\(\);/);
  });
});
