import { describe, it, expect } from "vitest";
import {
  WATCH_API_VERSION,
  buildWatchCard,
  buildWatchResponse,
} from "@/lib/watch-contract";

const APP = "https://swiftcard.me";

describe("buildWatchCard", () => {
  it("projects a card row into the watch contract", () => {
    const card = buildWatchCard(
      {
        username: "jane-acme",
        name: "Jane Doe",
        title: "CEO",
        company: "Acme",
        phone: "+15551234567",
        email: "jane@acme.com",
        website: "https://acme.com",
        photo_url: "https://cdn/x.jpg",
        logo_url: "https://cdn/logo.png",
      },
      APP,
    );
    expect(card.cardUrl).toBe("https://swiftcard.me/card/jane-acme");
    expect(card.walletPassUrl).toBe("https://swiftcard.me/api/wallet/pass?card=jane-acme");
    expect(card.qrValue).toBe(card.cardUrl);
    expect(card.title).toBe("CEO");
    expect(card.photoUrl).toBe("https://cdn/x.jpg");
  });

  it("trims a trailing slash on appUrl and defaults a blank name", () => {
    const card = buildWatchCard({ username: "x" }, "https://swiftcard.me/");
    expect(card.cardUrl).toBe("https://swiftcard.me/card/x");
    expect(card.name).toBe("SwiftCard");
    expect(card.title).toBeNull();
  });

  it("url-encodes the username in the wallet pass link", () => {
    const card = buildWatchCard({ username: "a b&c" }, APP);
    expect(card.walletPassUrl).toBe("https://swiftcard.me/api/wallet/pass?card=a%20b%26c");
  });
});

describe("buildWatchResponse", () => {
  it("versions the payload and includes only cards with a username", () => {
    const res = buildWatchResponse(
      [{ username: "a", name: "A" }, { username: "", name: "blank" }, { name: "no-username" }],
      APP,
    );
    expect(res.apiVersion).toBe(WATCH_API_VERSION);
    expect(res.cards).toHaveLength(1);
    expect(res.cards[0].username).toBe("a");
    expect(typeof res.updatedAt).toBe("string");
    expect(Number.isNaN(Date.parse(res.updatedAt))).toBe(false);
  });
});
