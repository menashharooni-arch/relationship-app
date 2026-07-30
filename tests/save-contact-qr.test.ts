import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";

// The desktop "Scan QR code" popup on a card page.
//
// The QR must encode the vCARD endpoint, never the card page. Pointing it at
// /card/<user> looks equally correct in review and silently destroys the
// feature: scanning would just open the web card again, when the whole point is
// that the phone opens its native "Add to Contacts" screen prefilled. Same
// endpoint the native app hands to the system browser for exactly this reason.

const root = process.cwd();
const src = readFileSync(join(root, "src/components/SaveContactButton.tsx"), "utf8");

/** The MiniQR call inside the QR popup, with balanced braces. */
function qrCallBlock(): string {
  const at = src.indexOf("<MiniQR");
  expect(at, "the QR popup no longer renders a MiniQR").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("/>", at) + 2);
}

describe("the scan-QR popup saves a contact, it doesn't reopen the card", () => {
  it("encodes the vCard endpoint", () => {
    const block = qrCallBlock();
    expect(block, "QR no longer points at the vCard endpoint").toMatch(/\/api\/card\/.+\/vcard/);
  });

  it("does NOT encode the public card page", () => {
    const block = qrCallBlock();
    // `/card/${...}` without the /api prefix and /vcard suffix = the web card.
    expect(block).not.toMatch(/\$\{[^}]*\}\/card\/\$\{[^}]*\}`/);
  });

  it("the vCard route still serves a contact file, which is what makes scanning work", () => {
    const route = readFileSync(join(root, "src/app/api/card/[username]/vcard/route.ts"), "utf8");
    expect(route).toContain("text/vcard");
    expect(route, "phones need the vCard inline to offer Add to Contacts").toContain("inline");
  });

  it("stays scannable: the encoded URL is sparse enough at the rendered size", () => {
    // A dense QR photographed across a desk fails to scan. At the popup's 196px,
    // keep modules comfortably above the ~4px phone cameras need.
    const url = `https://swiftcard.me/api/card/${"a".repeat(40)}/vcard`;
    const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
    const pxPerModule = 196 / qr.modules.size;
    expect(pxPerModule, `${qr.modules.size}x${qr.modules.size} is too dense`).toBeGreaterThan(4);
  });
});

// Anchor on the click HANDLER, not the label — the label also appears in a
// nearby code comment, and slicing from there silently grabs the wrong element
// (it did on the first draft of this test, and passed vacuously).
function buttonWithHandler(handler: string): string {
  const at = src.indexOf(handler);
  expect(at, `no button with handler ${handler}`).toBeGreaterThan(-1);
  const start = src.lastIndexOf("<button", at);
  const end = src.indexOf(">", src.indexOf("className", at));
  return src.slice(start, end);
}

describe("desktop-only, and Save Contact stays the primary action", () => {
  it("the QR button is hidden on phones", () => {
    // On a phone you're already holding the device — there's nothing to scan.
    expect(buttonWithHandler("setShowQr(true)")).toMatch(/hidden md:flex/);
  });

  it("Save Contact flexes to fill the row while the QR button stays shrink-0", () => {
    // Match the onClick ATTRIBUTE, not the bare identifier — the latter hits
    // the function's own definition higher up the file and slices nothing.
    expect(buttonWithHandler("onClick={downloadVCard}"), "Save Contact should absorb the remaining width").toMatch(/flex-1/);
    expect(buttonWithHandler("setShowQr(true)"), "the QR button should not grow into Save Contact's space").toMatch(/shrink-0/);
  });
});
