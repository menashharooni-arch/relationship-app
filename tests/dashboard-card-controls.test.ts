import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── One control for opening your own card, not two ───────────────────────────
//
// History, because this regressed once and the mechanism is easy to repeat:
//
//   2026-06-25  A "Preview" link was added inside CardPreviewDownload, rendered
//               whenever the `previewUrl` prop was passed.
//   2026-07-10  The dashboard DROPPED previewUrl — which removed that link —
//               and added the "View live card" button instead. One control.
//   2026-07-27  An iOS audit needed previewUrl back, because DownloadCardButton
//               uses it as the native share target (WKWebView can't save a
//               generated PNG). Restoring the prop silently resurrected the
//               "Preview" link, putting two buttons for the same URL side by
//               side again. The commit even noted the link reappearing and
//               shipped anyway.
//
// The trap: `previewUrl` serves TWO purposes, and the one you want (native
// share) drags in the one you don't (the link). These pin them apart.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the dashboard has exactly one way to open your live card", () => {
  const preview = read("src/components/CardPreviewDownload.tsx");
  const dashboard = read("src/app/dashboard/page.tsx");

  it("CardPreviewDownload renders no Preview link", () => {
    expect(preview, "the Preview link is back — it duplicates View live card").not.toMatch(/>\s*Preview\s*</);
    // The specific shape that came back: an anchor guarded on previewUrl.
    expect(preview, "previewUrl is rendering a link again").not.toMatch(/\{previewUrl && \(\s*<a/);
  });

  it("but previewUrl still reaches DownloadCardButton for the native share", () => {
    // Deleting the prop to kill the link would break iOS sharing — the reason
    // it was restored in the first place. Keep both facts true at once.
    expect(preview).toMatch(/shareUrl=\{previewUrl\}/);
    expect(dashboard).toMatch(/previewUrl=\{cardUrl\}/);
  });

  it("View live card is the one control, and it's still there", () => {
    // Match the rendered TEXT NODE, not the bare phrase: the phrase also appears
    // in the comment explaining why previewUrl renders nothing, so a plain count
    // sees two and fails. (Third time a comment of mine has fooled one of these
    // assertions — always anchor on what actually ships.)
    const rendered = dashboard.match(/>\s*View live card\s*</g) ?? [];
    expect(rendered.length, "View live card is missing, or duplicated").toBe(1);
  });
});
