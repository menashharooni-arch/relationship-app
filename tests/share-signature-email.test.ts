import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { signatureImageUrl } from "../src/lib/messaging";

// ── Sharing a card by email must show the card ───────────────────────────────
//
// The email reads "Hi {name}, save my contact information in the link below",
// then the link, then the sender's signature — a picture of their actual card.
//
// It didn't, reliably. The signature image was embedded as the raw Supabase
// storage URL of card-signatures/<slug>.png, an object that
//   • only exists once the owner has opened Preview & copy, and
//   • is DELETED on every card edit that changes how the signature looks.
//
// So the common state was "no stored object", and the email fell back to a grey
// name-only box — no card. Worse, mail ALREADY DELIVERED turned into a
// broken-image icon the moment the owner edited their card, because the
// recipient fetches that URL at open time, long after the send.
//
// Now every email embeds /api/card-signature/<slug>.png, which resolves at
// FETCH time: the stored signature when it exists, the card's live opengraph
// render (generated on demand, cannot 404) when it doesn't. One stable URL that
// always resolves to a picture of the current card.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const shareCard = () => read("src/app/api/leads/share-card/route.ts");
const messaging = () => read("src/lib/messaging.ts");
const sigRoute = () => read("src/app/api/card-signature/[username]/route.ts");

describe("the signature URL always resolves to a card", () => {
  it("exists as a route, not a raw storage link", () => {
    expect(existsSync(join(root, "src/app/api/card-signature/[username]/route.ts"))).toBe(true);
  });

  it("prefers the owner's stored Swift Signature", () => {
    expect(sigRoute()).toMatch(/storage\/v1\/object\/public\/\$\{BUCKET\}/);
  });

  it("falls through to the live card render when there is no stored image", () => {
    const src = sigRoute();
    expect(src).toMatch(/const live = `\$\{APP_URL\}\/\$\{slug\}\/opengraph-image`/);
    expect(src).toMatch(/let target = live/);
  });

  it("never 404s — every branch redirects to an image", () => {
    const src = sigRoute();
    // The only non-redirect exit is a malformed slug, which is not a card.
    expect(src).toMatch(/if \(!\/\^\[a-z0-9-\]\{1,40\}\$\/\.test\(slug\)\)/);
    expect(src).toMatch(/NextResponse\.redirect\(target/);
  });

  it("is a stable link — no per-send cache-buster to go stale", () => {
    expect(signatureImageUrl("menashharooni-swiftcard"))
      .toBe("https://swiftcard.me/api/card-signature/menashharooni-swiftcard.png");
    expect(signatureImageUrl("MenashHarooni-SwiftCard"))
      .toBe("https://swiftcard.me/api/card-signature/menashharooni-swiftcard.png");
    expect(signatureImageUrl(null)).toBeNull();
  });

  it("no longer HEAD-checks storage on the send path", () => {
    // The old resolveSignatureImageUrl blocked every send on a storage round
    // trip and still went stale the moment the card was edited afterwards.
    expect(messaging()).not.toMatch(/resolveSignatureImageUrl/);
  });
});

describe("the shared-by-email message", () => {
  it("greets the contact and puts the link above the signature", () => {
    const src = shareCard();
    expect(src).toMatch(/Hi \$\{esc\(contactFirst\)\},/);
    expect(src).toMatch(/Save my contact information in the link below\./);
    // link paragraph, then the signature block
    expect(src.indexOf("${esc(cardUrl.replace")).toBeLessThan(src.indexOf("${preview}"));
  });

  it("never greets by an email address or a stray symbol", () => {
    expect(shareCard()).toMatch(/\/\^\[\\p\{L\}'’-\]\{2,\}\$\/u\.test\(firstWord\)/);
  });

  it("always shows the card image — the grey name-only fallback is gone", () => {
    const src = shareCard();
    expect(src).toMatch(/const sigUrl = signatureImageUrl\(lead\.card_owner as string\)/);
    expect(src).not.toMatch(/View &amp; save my card →<\/span>/);
  });

  it("makes the signature clickable to the shared card link", () => {
    expect(shareCard()).toMatch(/<a href="\$\{cardUrl\}"[^>]*><img src="\$\{sigUrl\}"/);
  });

  it("keeps a text link under the image for clients that block images", () => {
    expect(shareCard()).toMatch(/View &amp; save my card →<\/a>/);
  });

  it("sizes the image for every mail client (width attribute, not just CSS)", () => {
    expect(shareCard()).toMatch(/width="360" style="display:block;width:100%;max-width:360px;height:auto/);
  });

  it("paints its own background so dark mode can't invert the text away", () => {
    expect(shareCard()).toMatch(/background-color:#ffffff/);
  });

  it("drops the SwiftCard alt-text branding for paid senders", () => {
    expect(shareCard()).toMatch(/\$\{paid \? "" : " — SwiftCard"\}/);
  });
});

describe("owner-supplied text can't break the tag it sits in", () => {
  it("escapes quotes in the share email", () => {
    const src = shareCard();
    expect(src).toMatch(/replace\(\/"\/g, "&quot;"\)/);
    expect(src).toMatch(/replace\(\/'\/g, "&#39;"\)/);
  });

  it("escapes quotes in the shared signature builder", () => {
    const src = messaging();
    expect(src).toMatch(/replace\(\/"\/g, "&quot;"\)/);
    expect(src).toMatch(/replace\(\/'\/g, "&#39;"\)/);
  });
});

describe("every personal email is a real HTML document", () => {
  // These bodies carry "→" and "·". A client that is not told the encoding
  // renders them as "â†'" and "Â·" — which is what the recipient sees as a
  // broken, unprofessional signature. The transactional templates always
  // declared a charset; the personal ones did not.
  const wrapped = [
    "src/app/api/leads/share-card/route.ts",
    "src/app/api/scanner/send/route.ts",
  ];

  it("declares utf-8, a viewport and a light color-scheme once, centrally", () => {
    const src = messaging();
    expect(src).toMatch(/export function emailDocument\(/);
    expect(src).toMatch(/<!doctype html><html lang="en"><head><meta charset="utf-8">/);
    expect(src).toMatch(/<meta name="viewport" content="width=device-width,initial-scale=1">/);
    expect(src).toMatch(/<meta name="color-scheme" content="light">/);
  });

  for (const path of wrapped) {
    it(`${path} sends through emailDocument, not a bare <div>`, () => {
      const src = read(path);
      expect(src, `${path} does not import emailDocument`).toMatch(/emailDocument/);
      expect(src, `${path} still builds a bare <div> body`).toMatch(/emailDocument\(`?\s*\n?\s*<div/);
    });
  }

  it("the typed follow-up shell is wrapped too", () => {
    expect(messaging()).toMatch(/return emailDocument\(`<div style="font-family/);
  });

  it("gives Gmail a preheader instead of letting it scrape 'Hi Sarah,'", () => {
    expect(messaging()).toMatch(/display:none!important;visibility:hidden/);
    expect(read("src/app/api/leads/share-card/route.ts"))
      .toMatch(/\[ownerName, ownerTitle, ownerCompany\]\.filter\(Boolean\)\.join\(" · "\)/);
  });
});
