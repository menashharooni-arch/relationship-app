// ── A card's background video has to actually play ──────────────────────────
//
// It never did. Uploading one worked, the poster was captured, the style saved
// — and all six templates painted the poster as a CSS background and stopped,
// because CSS cannot play a video and no <video> was ever rendered on a card.
// Every card with a video background showed a still frame, everywhere, from the
// day the feature shipped.
//
// These measure the three things that were wrong or could silently break again:
// the element exists in every template, it carries the exact attribute set iOS
// requires to autoplay without a tap (drop `muted` and it never starts; drop
// `playsInline` and it goes fullscreen), and it sits BEHIND the card's text
// rather than on top of it.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { appCss } from "./harness";
import ClassicPro from "@/components/card-templates/ClassicPro";
import ModernBold from "@/components/card-templates/ModernBold";
import PhotoFirst from "@/components/card-templates/PhotoFirst";
import LocalBusiness from "@/components/card-templates/LocalBusiness";
import LuxuryMinimal from "@/components/card-templates/LuxuryMinimal";
import LogoFirst from "@/components/card-templates/LogoFirst";
import { SAMPLE_DATA } from "@/components/card-templates/types";
import type { CardData } from "@/components/card-templates/types";

const TEMPLATES = [
  ["ClassicPro", ClassicPro], ["ModernBold", ModernBold], ["PhotoFirst", PhotoFirst],
  ["LocalBusiness", LocalBusiness], ["LuxuryMinimal", LuxuryMinimal], ["LogoFirst", LogoFirst],
] as const;

// A tiny real MP4 would need a fixture; the element's wiring is what is under
// test, so a URL that will never load is ideal — it also proves the poster
// fallback path is what a viewer sees when the video cannot play.
const withVideo: CardData = {
  ...SAMPLE_DATA,
  customization: {
    ...(SAMPLE_DATA.customization ?? {}),
    panelMedia: "https://example.invalid/bg.mp4",
    panelMediaType: "video",
    panelMediaPoster: "https://example.invalid/bg.jpg",
    panelDim: 0.35,
  },
} as CardData;

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

async function probe(Component: React.ComponentType<{ data: CardData }>, data: CardData) {
  const css = await appCss();
  const html = renderToStaticMarkup(createElement(Component, { data }));
  const page = await browser.newPage({ viewport: { width: 700, height: 600 } });
  try {
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>` +
        `<body class="sc-app" style="margin:0;padding:30px;background:#ddd">${html}</body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    return await page.evaluate(() => {
      const v = document.querySelector("video");
      if (!v) return { present: false } as const;
      const layer = v.parentElement!;
      const panel = layer.parentElement!;
      const cs = getComputedStyle;
      // Something with real ink on it, to compare paint order against.
      const texts = Array.from(panel.querySelectorAll("*")).filter(
        (e) => e.children.length === 0 && (e.textContent ?? "").trim().length > 2,
      );
      return {
        present: true,
        autoplay: v.autoplay, muted: v.muted, loop: v.loop,
        playsInline: v.hasAttribute("playsinline"),
        hasPoster: !!v.getAttribute("poster"),
        objectFit: cs(v).objectFit,
        layerZ: cs(layer).zIndex,
        panelIsolation: cs(panel).isolation,
        panelPosition: cs(panel).position,
        textCount: texts.length,
      } as const;
    });
  } finally {
    await page.close();
  }
}

describe.each(TEMPLATES)("%s", (_name, Component) => {
  it("renders a real <video> for a video background", async () => {
    const r = await probe(Component, withVideo);
    expect(r.present).toBe(true);
  });

  it("carries every attribute iOS needs to autoplay, and loops", async () => {
    const r = await probe(Component, withVideo);
    expect(r).toMatchObject({ autoplay: true, muted: true, loop: true, playsInline: true });
  });

  it("keeps the poster as the fallback a viewer sees if it cannot play", async () => {
    const r = await probe(Component, withVideo);
    expect(r.hasPoster).toBe(true);
  });

  it("fills the panel rather than letterboxing", async () => {
    const r = await probe(Component, withVideo);
    expect(r.objectFit).toBe("cover");
  });

  // The bug an obvious implementation would have: an absolutely positioned
  // layer paints ABOVE its in-flow siblings, so the video would cover the name,
  // the title and the phone number. -1 inside an isolated panel is what puts it
  // behind them.
  it("sits behind the card's own content", async () => {
    const r = await probe(Component, withVideo);
    expect(r.layerZ).toBe("-1");
    expect(r.panelIsolation).toBe("isolate");
    expect(r.panelPosition).not.toBe("static");
    expect(r.textCount).toBeGreaterThan(0);
  });

  it("renders nothing at all for a card with no video", async () => {
    const r = await probe(Component, SAMPLE_DATA);
    expect(r.present).toBe(false);
  });
});
