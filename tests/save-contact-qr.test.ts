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

describe("scanning saves the contact AND leaves them on the card", () => {
  it("lands on the card page with ?save=1, not the raw .vcf", () => {
    // Pointing straight at /api/.../vcard delivers the contact and then strands
    // the visitor on a blank page — the card they scanned is gone. The card
    // page has to be what loads, so it's underneath the contact sheet.
    const block = qrCallBlock();
    expect(block, "QR no longer lands on the card page").toMatch(/\/card\/.+save=1/);
    expect(block, "QR points straight at the raw vCard again — that strands the visitor").not.toMatch(/\/api\/card\//);
  });

  it("?save=1 actually hands the phone the contact", () => {
    // The landing page is only half the job: without this the visitor gets the
    // card and no contact at all.
    const page = readFileSync(join(root, "src/app/card/[username]/page.tsx"), "utf8");
    expect(page).toMatch(/save === "1"/);
    expect(page).toContain("<ScanSaveContact");
    const comp = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    expect(comp, "the contact is no longer fetched").toMatch(/\/api\/card\/.+\/vcard/);
  });

  it("delivers via an iframe so the card page survives", () => {
    // Navigating the top frame to a text/vcard URL leaves Android Chrome on a
    // blank tab — the exact failure this whole change exists to prevent.
    const comp = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    expect(comp).toMatch(/createElement\("iframe"\)/);
    expect(comp, "top-frame navigation would blank the page on Android").not.toMatch(/window\.location\s*=|location\.href\s*=/);
  });

  it("fires once — two contact sheets is worse than none", () => {
    const comp = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    expect(comp).toMatch(/fired\.current/);
  });

  it("the QR carries source=qr_code so the whole visit is attributed to the scan", () => {
    expect(qrCallBlock()).toMatch(/source=qr_code/);
  });
});

// ── Notification parity ──────────────────────────────────────────────────────
//
// Owner requirement: scanning the QR and tapping Save Contact both end at the
// phone's "Add to Contacts" sheet, so the owner's portal must react identically
// — same bell entry, same activity row, same CRM dispatch. /api/card-events
// owns all three, keyed off event_type "downloaded_vcard"; any divergence in
// what the two callers POST forks the flow silently, with the QR path simply
// producing no notification at all.

describe("a QR save notifies the owner exactly like a button save", () => {
  const scan = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
  const button = readFileSync(join(root, "src/components/SaveContactButton.tsx"), "utf8");
  const events = readFileSync(join(root, "src/app/api/card-events/route.ts"), "utf8");

  it("both send downloaded_vcard to /api/card-events", () => {
    // The button routes through its trackEvent() helper and the scan posts
    // inline, so assert the two things that actually matter rather than one
    // shared spelling: each names the event, and each hits the endpoint that
    // turns it into a notification.
    for (const [name, srcFile] of [["button", button], ["scan", scan]] as const) {
      expect(srcFile, `${name} no longer sends downloaded_vcard`).toContain('"downloaded_vcard"');
      expect(srcFile, `${name} no longer posts to /api/card-events`).toContain("/api/card-events");
    }
  });

  it("that event type is what fires the bell, the activity row and the CRM", () => {
    expect(events).toMatch(/event_type === "downloaded_vcard"/);
    const block = events.slice(events.indexOf('event_type === "downloaded_vcard"'));
    expect(block).toContain("insertNotification");
    expect(block).toContain('type: "contact_saved"');
    expect(block).toContain("dispatchCrmEvent");
  });

  it("both also post the contact_save analytics event", () => {
    for (const [name, srcFile] of [["button", button], ["scan", scan]] as const) {
      expect(srcFile, `${name} missing the analytics event`).toMatch(/event_type: "contact_save"/);
    }
  });

  it("the QR popup itself holds no share-back form", () => {
    // While the popup is open the visitor is looking at their PHONE. A form
    // behind the code asks at the one moment nobody is reading the screen.
    const popup = src.slice(src.indexOf("{showQr && ("), src.indexOf("<style>"));
    expect(popup, "the share-back ask is back inside the QR popup").not.toContain("have yours too");
    expect(popup, "the QR popup grew a form again").not.toMatch(/<form/);
    expect(popup, "the QR popup should contain the code and little else").toContain("<MiniQR");
  });

  it("closing the QR popup raises the same share-back sheet the button raises", () => {
    const close = src.slice(src.indexOf("function closeQr()"), src.indexOf("async function downloadVCard"));
    expect(close, "closing the QR no longer opens the share sheet").toContain("setShowSheet(true)");
    // Someone who already shared shouldn't be asked twice — they get the
    // signup nudge instead, same as every other dismissal path.
    expect(close).toContain("hasSharedWith");
    expect(close).toContain("triggerSignupNudge");
  });

  it("a phone scan raises it too, once the OS contact sheet is done", () => {
    const scan = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    // Assert the DISPATCH, not the event name — merely importing the constant
    // satisfies a name check while the announcement is gone (this test passed
    // vacuously against exactly that mutation before being tightened).
    expect(scan, "the phone flow never announces the save").toMatch(/dispatchEvent\(\s*new CustomEvent\(SCAN_SAVED_EVENT/);
    expect(src, "SaveContactButton doesn't listen for the phone flow").toMatch(/addEventListener\(SCAN_SAVED_EVENT/);
    // Both signals must exist: iOS draws the sheet WITHOUT hiding the page, so
    // a visibility-only trigger would mean the ask simply never appears there.
    expect(scan, "lost the visibility signal").toContain("visibilitychange");
    expect(scan, "lost the timer fallback — iOS would never fire the ask").toMatch(/setTimeout\(announce/);
    expect(scan, "the ask could fire twice").toContain("announced");
  });

  it("the scan's source is a KNOWN label, not a raw slug in the owner's bell", () => {
    // The notification body interpolates getSourceLabel(source). An unmapped
    // value falls through to source.replace(/_/g," ") and prints lowercase junk
    // like "qr scan" — the exact regression documented on swift_links.
    const labels = readFileSync(join(root, "src/lib/source-labels.ts"), "utf8");
    expect(labels).toMatch(/qr_code:/);
    expect(scan, "scan must not hardcode a source outside the label map").not.toMatch(/source: "qr_/);
  });

  it("the vCard route still serves a contact file, which is what makes scanning work", () => {
    const route = readFileSync(join(root, "src/app/api/card/[username]/vcard/route.ts"), "utf8");
    expect(route).toContain("text/vcard");
    expect(route, "phones need the vCard inline to offer Add to Contacts").toContain("inline");
  });

  it("stays scannable: the encoded URL is sparse enough at the rendered size", () => {
    // A dense QR photographed across a desk fails to scan. At the popup's 196px,
    // keep modules comfortably above the ~4px phone cameras need.
    const url = `https://swiftcard.me/card/${"a".repeat(40)}?save=1`;
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

  it("the two buttons stay aligned before AND after the contact is saved", () => {
    // The saved label ("Saved to Contacts!") is longer than "Save Contact". In
    // the narrowed flex-1 it wraps to two lines without nowrap, so the row's
    // buttons end up different heights and visibly stop lining up at the exact
    // moment the visitor succeeds.
    expect(buttonWithHandler("onClick={downloadVCard}"), "the save button will wrap when it flips to Saved").toMatch(/whitespace-nowrap/);
    expect(buttonWithHandler("setShowQr(true)"), "the QR label will wrap on narrow cards").toMatch(/whitespace-nowrap/);
    // Equal heights regardless of content.
    const row = src.slice(src.indexOf('<div className="flex items-stretch'), src.indexOf("onClick={downloadVCard}"));
    expect(row, "the button row is no longer stretch-aligned").toContain("items-stretch");
  });

  it("Save Contact flexes to fill the row while the QR button stays shrink-0", () => {
    // Match the onClick ATTRIBUTE, not the bare identifier — the latter hits
    // the function's own definition higher up the file and slices nothing.
    expect(buttonWithHandler("onClick={downloadVCard}"), "Save Contact should absorb the remaining width").toMatch(/flex-1/);
    expect(buttonWithHandler("setShowQr(true)"), "the QR button should not grow into Save Contact's space").toMatch(/shrink-0/);
  });
});
