import { describe, it, expect } from "vitest";
import { welcomeEmail, marketingEmail, promoEmail, marketingHeaders } from "@/lib/email-templates";

// Deliverability invariants — these are the things that, if they regress, send
// legitimate mail to spam. Locking them here so a future refactor can't quietly
// reintroduce the unauthenticated sender or drop the one-click unsubscribe pair.

describe("email deliverability invariants", () => {
  it("marketingHeaders emits BOTH RFC 8058 one-click unsubscribe headers", () => {
    const url = "https://swiftcard.me/unsubscribe?token=abc";
    const h = marketingHeaders(url);
    // A footer link alone is not enough — Gmail/Yahoo require both of these.
    expect(h["List-Unsubscribe"]).toBe(`<${url}>`);
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("default sender is the authenticated swiftcard.me domain, never onboarding@resend.dev", () => {
    const e = welcomeEmail({
      firstName: "Alex",
      cardUrl: "https://swiftcard.me/card/alex",
      unsubscribeUrl: "https://swiftcard.me/unsubscribe?token=x",
    });
    expect(e.from).toContain("swiftcard.me");
    expect(e.from).not.toContain("resend.dev");
  });

  it("marketing + promo emails carry a plain-text alternative (multipart, not HTML-only)", () => {
    const mk = marketingEmail({
      firstName: "Alex", subject: "Hi", headline: "Big news", body: "Body copy",
      ctaLabel: "Go", ctaUrl: "https://swiftcard.me", unsubscribeUrl: "https://swiftcard.me/unsubscribe?token=x",
    });
    const promo = promoEmail({
      firstName: "Alex", code: "SAVE20", discountText: "20% off", headline: "Deal", body: "copy",
      unsubscribeUrl: "https://swiftcard.me/unsubscribe?token=x",
    });
    for (const e of [mk, promo]) {
      expect(typeof e.text).toBe("string");
      expect(e.text.trim().length).toBeGreaterThan(0);
    }
  });
});
