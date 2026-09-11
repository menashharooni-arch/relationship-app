import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveRowStyle, tileMedia, TILE_SIZES, layoutTiles } from "@/lib/swiftlink-tiles";

// Owner order 2026-09-09: how each additional link LOOKS (Featured / Grid /
// Compact, its preview, its row style) is chosen PER LINK on the Social
// design tab. The old Socials-tab size picker and the page-wide row style are
// gone from the UI; stored data from before keeps rendering the same.
const read = (p: string) => readFileSync(p, "utf8");

describe("per-link row style", () => {
  it("a link's own pick wins, including an explicit Standard over a page-wide Solid", () => {
    expect(resolveRowStyle({ rowStyle: "solid" }, undefined)).toBe("solid");
    expect(resolveRowStyle({ rowStyle: "outline" }, "solid")).toBe("outline");
    expect(resolveRowStyle({ rowStyle: "tile" }, "solid")).toBe("tile");
  });
  it("a link never touched falls back to the legacy page-wide style, then Standard", () => {
    expect(resolveRowStyle({}, "solid")).toBe("solid");
    expect(resolveRowStyle({}, "outline")).toBe("outline");
    expect(resolveRowStyle({}, undefined)).toBe("tile");
    expect(resolveRowStyle({}, "garbage")).toBe("tile");
  });
  it("unknown stored values are ignored, not rendered", () => {
    expect(resolveRowStyle({ rowStyle: "neon" as never }, undefined)).toBe("tile");
  });
});

describe("per-link uploaded media", () => {
  it("renders only for paid, only over https, only image or video", () => {
    const img = { media: { url: "https://x.supabase.co/a.jpg", type: "image" as const } };
    expect(tileMedia(img, true)).toEqual(img.media);
    expect(tileMedia(img, false)).toBeNull();
    expect(tileMedia({ media: { url: "http://x/a.jpg", type: "image" } }, true)).toBeNull();
    expect(tileMedia({ media: { url: "javascript:alert(1)", type: "image" } }, true)).toBeNull();
    expect(tileMedia({ media: { url: "https://x/a.mp4", type: "gif" as never } }, true)).toBeNull();
    expect(tileMedia({}, true)).toBeNull();
  });
});

describe("the picker vocabulary", () => {
  it("is Featured / Grid / Compact — Auto is retired", () => {
    expect(TILE_SIZES.map((t) => t.id)).toEqual(["featured", "grid", "compact"]);
    expect(TILE_SIZES.map((t) => t.name)).toEqual(["Featured", "Grid", "Compact"]);
  });
  it("legacy links with no size still lay out as before (grid, odd one promoted)", () => {
    const L = (size?: "featured" | "grid" | "compact") => ({ label: "x", url: "https://x.com", size });
    expect(layoutTiles([L(), L(), L()], true).map((t) => t.size)).toEqual(["featured", "grid", "grid"]);
  });
});

describe("where the controls live", () => {
  it("the Socials tab/step no longer carries a size picker (both editors)", () => {
    for (const p of ["src/app/cards/[id]/edit/CardEditForm.tsx", "src/app/cards/new/NewCardWizard.tsx"]) {
      const src = read(p);
      expect(src).not.toMatch(/LinkSizeControl/);
      // …and both hand their links to the design controls for the per-link
      // section. Matched across the whole element rather than on one line: the
      // editor now passes them conditionally, because an Office can lock the
      // links and the controls must be OMITTED rather than shown and silently
      // reverted by the server on save (see office-links-lock.test.ts).
      const el = /<SwiftLinkStyleControls[\s\S]{0,400}?\/>/.exec(src);
      expect(el, `${p}: SwiftLinkStyleControls is no longer rendered`).toBeTruthy();
      expect(el![0]).toMatch(/links=\{(links|linksLocked \? undefined : links)\}/);
      expect(el![0]).toMatch(/onLinksChange=\{(setLinks|linksLocked \? undefined : setLinks)\}/);
    }
  });
  it("the per-link panel shows one sub-row per size: media for Featured/Grid, row style for Compact", () => {
    const src = read("src/components/LinkButtonsControls.tsx");
    expect(src).toMatch(/size === "compact" \? \([\s\S]{0,1200}BUTTON_STYLES\.map/);
    expect(src).toMatch(/<LinkMediaControl link=\{l\} locked=\{locked\}/);
    // A row-style pick is written explicitly (even Standard) so it beats the legacy page-wide setting.
    expect(src).toMatch(/patch\(i, \{ rowStyle: o\.id \}\)/);
    // Section headers have no look of their own.
    expect(src).toMatch(/if \(l\.kind === "header"\) return null/);
  });
  it("the design panel no longer writes the page-wide linkButtonStyle", () => {
    expect(read("src/components/SwiftLinkDesign.tsx")).not.toMatch(/onChange\(\{ linkButtonStyle/);
  });
  it("the public tile renders uploaded video muted + inline, never a play overlay for it", () => {
    const src = read("src/components/SwiftLinkButtons.tsx");
    expect(src).toMatch(/<video[\s\S]{0,300}autoPlay[\s\S]{0,80}muted[\s\S]{0,80}loop[\s\S]{0,80}playsInline/);
    expect(src).toMatch(/\{videoThumb && !media && \(/);
    expect(src).toMatch(/const media = tileMedia\(link, paid\)/);
  });
  it("video uploads never ride through the function body — signed URL, allow-listed type, capped size", () => {
    const src = read("src/app/api/upload/link-video/route.ts");
    expect(src).toMatch(/createSignedUploadUrl\(path\)/);
    expect(src).toMatch(/const path = `\$\{user\.id\}\/link-video-/);
    expect(src).toMatch(/MAX_VIDEO_BYTES = 25 \* 1024 \* 1024/);
    expect(read("src/app/api/upload/route.ts")).toMatch(/field !== "photo" && field !== "logo" && field !== "hero" && field !== "link"/);
  });
});
