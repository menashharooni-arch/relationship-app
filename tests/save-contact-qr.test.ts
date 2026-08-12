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

  it("delivers once — two contact sheets is worse than none", () => {
    // Was asserting /fired\.current/, a name that now survives ONLY inside the
    // comment describing the old bug — so it passed while guarding nothing.
    // Anchor on the live guard around the iframe instead.
    const comp = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    const deliver = comp.slice(comp.indexOf("if (!delivered.current)"), comp.indexOf("── Raise the share-back"));
    expect(deliver, "the contact delivery is no longer once-guarded").toMatch(/delivered\.current = true/);
    expect(deliver).toMatch(/createElement\("iframe"\)/);
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

  it("that event type is what fires the bell, the activity row and the CRM", async () => {
    // The route now handles views alongside saves, and the copy moved into
    // lib/card-event-notify so it could be tested directly instead of grepped.
    // What must not change: a save still reaches all three destinations, and
    // still under the type the rest of the product keys on.
    expect(events).toMatch(/event_type === "downloaded_vcard"/);
    const block = events.slice(events.indexOf('event_type === "viewed_card"'));
    expect(block).toContain("insertNotification");
    expect(block).toContain("dispatchCrmEvent");

    const { cardEventNotice } = await import("@/lib/card-event-notify");
    expect(cardEventNotice({ eventType: "downloaded_vcard" })?.type).toBe("contact_saved");
  });

  it("both also post the contact_save analytics event", () => {
    for (const [name, srcFile] of [["button", button], ["scan", scan]] as const) {
      expect(srcFile, `${name} missing the analytics event`).toMatch(/event_type: "contact_save"/);
    }
  });

  it("Done is the only visible way out — no X (owner preference)", () => {
    const popup = src.slice(src.indexOf("{showQr && ("), src.indexOf("<style>"));
    expect(popup, "the X came back to the QR popup").not.toMatch(/aria-label="Close"/);
    // But it must still be closable, or the popup is a trap: Done + backdrop.
    // Whitespace-tolerant: the repo checks out CRLF, so a \n literal never matches.
    expect(popup, "the QR popup lost its Done button").toMatch(/>\s*Done\s*</);
    expect(popup, "the backdrop no longer closes the popup").toContain("e.target === e.currentTarget && closeQr()");
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
    expect(scan, "lost the focus signal").toMatch(/addEventListener\("focus"/);
    expect(scan, "lost the timer fallback — iOS would never fire the ask").toMatch(/setTimeout\(announce/);
  });

  it("the once-guards survive an effect re-run", () => {
    // The first version early-returned on a ref ABOVE the listener setup, so a
    // second effect pass (StrictMode, a remount) hit cleanup-then-early-return:
    // timers torn down, never rebuilt, and the ask silently never fired. The
    // guards must be per-concern refs INSIDE the body, not one gate over it.
    const scan = readFileSync(join(root, "src/components/ScanSaveContact.tsx"), "utf8");
    for (const guard of ["delivered", "announced", "tracked"]) {
      expect(scan, `${guard} is no longer ref-guarded`).toMatch(new RegExp(`${guard}\\.current`));
    }
    // Exactly 4-space indent = the effect's own top level. A guard nested
    // inside announce() (6 spaces) is correct and must not trip this; the
    // comment describing the old bug must not either.
    const body = scan.slice(scan.indexOf("useEffect(("));
    expect(body, "a blanket early return is back above the listener setup").not.toMatch(/^ {4}if \(\w+\.current\) return;/m);
    // And delivery must be a scoped guard rather than a gate over everything.
    expect(body).toMatch(/if \(!delivered\.current\) \{/);
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
  // ONLY the className line. Slicing the whole opening tag also swallowed the
  // JSX comments above the attribute — and one of those comments spells out
  // "text-sm, font-semibold, py-3, gap-2", so a font-weight mutation passed
  // while the real class said font-medium. Assert the class list itself.
  const cls = src.indexOf("className=", at);
  expect(cls, `no className after ${handler}`).toBeGreaterThan(-1);
  const eol = src.indexOf("\n", cls);
  return src.slice(cls, eol === -1 ? undefined : eol);
}

describe("desktop-only, and Save Contact stays the primary action", () => {
  it("the QR button is hidden on phones", () => {
    // On a phone you're already holding the device — there's nothing to scan.
    expect(buttonWithHandler("setShowQr(true)")).toMatch(/hidden md:flex/);
  });

  it("both buttons use the SAME font size, weight, height and icon size", () => {
    // They sit side by side, so any difference reads as a mistake. The QR
    // button was briefly text-[12.5px] with a w-3.5 icon to make it thinner —
    // it stays narrower through PADDING alone (px-3 vs px-4) plus Save Contact
    // taking flex-1, never by shrinking the label.
    const save = buttonWithHandler("onClick={downloadVCard}");
    const qr = buttonWithHandler("setShowQr(true)");
    for (const cls of ["text-sm", "font-semibold", "py-3", "gap-2", "rounded-full"]) {
      expect(save, `save button lost ${cls}`).toContain(cls);
      expect(qr, `QR button no longer matches on ${cls}`).toContain(cls);
    }
    // No bespoke font size on either — that's how they drifted apart.
    expect(qr, "the QR label has its own font size again").not.toMatch(/text-\[\d/);
    expect(save, "the save label has a bespoke font size").not.toMatch(/text-\[\d/);
    // Icons match too: a smaller glyph beside the same text still looks off.
    const iconSize = (block: string) => {
      const at = src.indexOf(block);
      const svg = src.slice(at, src.indexOf("</svg>", at));
      return (svg.match(/className="(w-[\d.]+) (h-[\d.]+)"/) ?? [])[0];
    };
    expect(iconSize("setShowQr(true)"), "the QR icon is a different size to the save icon")
      .toBe(iconSize("onClick={downloadVCard}"));
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

// ── The tail of every journey ────────────────────────────────────────────────
//
// Owner rule: once the "share your information" sheet is done with — submitted,
// "No thanks", the X, or the backdrop — the "create your free card" invite
// follows, on phone and computer alike. It's the last beat of every path
// through this component and the easiest thing to lose while rewiring the
// earlier steps, because nothing visibly breaks when it goes missing.

describe("the free-card invite closes out every path", () => {
  it("dismissing the sheet invites them", () => {
    const closeSheet = src.slice(src.indexOf("function closeSheet()"), src.indexOf("function closeQr()"));
    expect(closeSheet).toContain('triggerSignupNudge("vcard")');
  });

  it("all three dismissals route through that one function", () => {
    const sheet = src.slice(src.indexOf("{showSheet && ("), src.indexOf("{showQr && ("));
    // Backdrop, X and "No thanks". If any one wires straight to setShowSheet
    // instead, that exit silently stops inviting.
    expect(sheet, "backdrop no longer closes via closeSheet").toContain("e.target === e.currentTarget && closeSheet()");
    expect((sheet.match(/onClick=\{closeSheet\}/g) ?? []).length, "the X and No thanks should both call closeSheet").toBeGreaterThanOrEqual(2);
    expect(sheet, "a dismissal bypasses closeSheet").not.toMatch(/onClick=\{\(\) => setShowSheet\(false\)\}/);
  });

  it("submitting the form invites them too", () => {
    const done = src.slice(src.indexOf('setStatus("done")'));
    expect(done.slice(0, 400)).toContain('triggerSignupNudge("vcard")');
  });

  it("the new QR path doesn't spend the invite BEFORE the sheet", () => {
    // The invite fires once per session. If closing the QR popup nudged AND
    // opened the sheet, the sheet's own exit would find the invite already
    // spent — the visitor would never see it at the moment it's meant to land.
    const closeQr = src.slice(src.indexOf("function closeQr()"), src.indexOf("async function downloadVCard"));
    expect(closeQr, "not-yet-shared must open the sheet").toContain("setShowSheet(true)");
    expect(closeQr, "already-shared must invite directly").toContain('triggerSignupNudge("vcard")');
    expect(closeQr, "the two cases must be exclusive, not both").toMatch(/\} else \{/);
  });

  it("and neither does the phone scan", () => {
    const onScan = src.slice(src.indexOf("function onScanSaved()"), src.indexOf("window.addEventListener(SCAN_SAVED_EVENT"));
    expect(onScan).toContain("hasSharedWith");
    expect(onScan, "already-shared must invite directly").toContain('triggerSignupNudge("vcard")');
    expect(onScan, "otherwise the sheet comes first").toContain("setShowSheet(true)");
  });
});
