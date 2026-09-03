import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const markup = read("src/lib/splash/markup.html");
const component = read("src/components/NativeSplash.tsx");
const layout = read("src/app/layout.tsx");

// The iOS launch animation (owner-specified 2026-08-31): lightning across the
// whole screen, the logo emerging from the flash, then the logo's own bolt
// opening onto the app. Everything pinned here is something that broke at
// least once while building it.
describe("native splash", () => {
  it("renders only for the shell, and only for an actual launch", () => {
    expect(component).toMatch(/isNativeRequest\(/);
    // Launch detection must stay STATELESS. It was a 2-minute `sc_splash`
    // cookie, which outlives the app and so skipped the animation entirely
    // when you quit and reopened inside two minutes — the commonest reopen
    // there is. Sec-Fetch-Site tells us directly: `same-origin` is a
    // navigation from one of our own pages, anything else is a launch.
    expect(component).toMatch(/sec-fetch-site"\) === "same-origin"\) return null/);
    expect(component).not.toMatch(/c\.get\("sc_splash"\)/);
    expect(markup).not.toMatch(/document\.cookie\s*=\s*"sc_splash/);
    // The client-side half, which also covers iOS 15 (no Sec-Fetch-Site).
    expect(markup).toMatch(/document\.referrer\.indexOf\(location\.origin\)===0/);
    // ~52KB of inlined artwork: read once per process, never per request.
    expect(component).toMatch(/cachedMarkup \?\?=/);
  });

  it("never replays on a tab tap: a router fetch is not a launch", () => {
    // Home tab from Contacts/Links is a client-side navigation. The App
    // Router fetches the dashboard layout with `RSC: 1` and mounts the
    // payload into the running page; React inserts dangerouslySetInnerHTML
    // markup WITHOUT executing its inline scripts, so the guard never ran and
    // the lightning replayed mid-session (2026-09-03). The shell's fetch()
    // did not carry Sec-Fetch-Site, so that check alone was not enough.
    // 1. The server CANNOT gate this: Next strips `rsc`, `next-router-prefetch`
    //    and `next-url` before headers() sees them (verified 2026-09-03 —
    //    a gate on them was dead code). Don't reintroduce one.
    expect(component).not.toMatch(/h\.get\("rsc"\)|h\.get\("next-router-prefetch"\)|h\.get\("next-url"\)/);
    // 2. Client: hidden unless the parse-time guard armed it, so no delivery
    //    path that skips the script can ever show the overlay.
    expect(markup).toMatch(/d\.classList\.add\("sc-splash-armed"\);d\.classList\.add\("sc-splash-hold"\)/);
    expect(markup).toMatch(/html:not\(\.sc-splash-armed\) #sc-splash-vfork\{display:none!important\}/);
    // 3. The arming is dropped once the sequence ends, so a re-mount later in
    //    the same session cannot borrow the launch's class.
    expect(markup).toMatch(/d\.classList\.remove\("sc-splash-armed"\)/);
    expect(markup).toMatch(/addEventListener\("animationend"/);
    expect(markup).toMatch(/setTimeout\(disarm, \d+\)/);
    // The armed default must never be undone by the animation running anyway:
    // the root still animates by default, but display:none wins.
    expect(markup).toMatch(/animation:vfk-clear 1400ms linear both;/);
  });

  it("holds frame 0 until the native splash is actually gone", () => {
    // The overlay's clock starts at parse, but iOS keeps the static launch
    // image over the webview until SplashScreen.hide() runs. That used to wait
    // on React hydration (1-3s on a remote-URL shell), so the lightning played
    // underneath an opaque splash and the user saw a different slice of it
    // every launch. Frame 0 is pixel-identical to the launch image, so holding
    // there is invisible; the overlay hands off from its own script instead.
    expect(markup).toMatch(/sc-splash-hold/);
    expect(markup).toMatch(/animation-play-state:paused !important/);
    expect(markup).toMatch(/Capacitor\.Plugins\.SplashScreen/);
    // Every failure path releases: reject, no plugin, promise never settles.
    expect(markup).toMatch(/r\.then\(release, release\)/);
    expect(markup).toMatch(/setTimeout\(release, plugin \? \d+ : \d+\)/);
  });

  it("can never show a black frame during the handoff", () => {
    // The navy field is painted by .vfk-plane THROUGH data-URI mask images,
    // which WebKit decodes asynchronously. On device there was a window where
    // the plane painted as nothing and the app's near-black body showed
    // through — the "logo → black flash → animation" cold-open glitch
    // (2026-08-31). Two defences, both required:
    // 1. While held, the root paints solid navy — a plain color, no decode.
    expect(markup).toMatch(/html\.sc-splash-hold #sc-splash-vfork\{ background:#1A2342; \}/);
    // 2. hide() waits for every inline image to decode (capped so a decode
    //    failure can never stall the launch).
    expect(markup).toMatch(/function decoded\(cb\)/);
    expect(markup).toMatch(/j\.decode\(\)\.then\(one,one\)/);
    expect(markup).toMatch(/setTimeout\(fin, \d+\)/);
    expect(markup).toMatch(/decoded\(function\(\)\{ requestAnimationFrame/);
  });

  it("scales the mark to whatever the launch image renders", () => {
    // The launch image is 2732x2732 shown scaleAspectFill, and its mark
    // measures exactly 560px, so it lands at 560*max(W,H)/2732 = 20.4978vmax.
    // A hard-coded px value matched one device and made the mark visibly jump
    // on every other one.
    expect(markup).toMatch(/--vfk-mark: 20\.4978vmax/);
    expect(markup).not.toMatch(/width:112px/);
  });

  it("keeps <body> untransformed while it is up", () => {
    // A transformed ancestor becomes the containing block for a fixed element:
    // the native page-in rise made the overlay size to the body box (844x512
    // instead of 844x390 in landscape) and snap 10px when it ended.
    expect(markup).toMatch(/html\.native-app:not\(\.sc-nosplash\) body\{ animation:none !important; \}/);
    // ...and sized against the viewport, not inset:0, so any future transform
    // can only offset the overlay, never resize it.
    expect(markup).toMatch(/position:fixed; top:0; left:0; width:100vw; height:100vh/);
  });

  it("lives in the launch pages' layouts, never the root layout", () => {
    // It used to be the first child of <body> in the ROOT layout. That put its
    // headers()/cookies() reads on every route, which forced the ENTIRE site —
    // homepage, /pricing, /privacy, every marketing/SEO page — to server-render
    // in a lambda per request instead of serving static HTML from the CDN
    // (2026-09-01 perf fix). The shell never loads those pages: src/proxy.ts
    // redirects "/" for shell requests before any HTML is sent, so a cold
    // launch can only paint /dashboard or /login. The splash renders from
    // THOSE layouts — still in the initial HTML (a layout flushes before the
    // page's data fetches), so the first-frame handoff from the static iOS
    // launch image is preserved. It is a position:fixed max-z overlay, so
    // where it sits in the DOM does not matter visually.
    expect(layout).not.toMatch(/import NativeSplash/);
    expect(layout).not.toMatch(/<NativeSplash/);
    for (const p of ["src/app/dashboard/layout.tsx", "src/app/login/layout.tsx"]) {
      const l = read(p);
      expect(l).toMatch(/<NativeSplash \/>/);
      // The splash must flush before the page: children come after it.
      expect(l.indexOf("<NativeSplash />")).toBeLessThan(l.indexOf("{children}"));
    }
    // The root layout must stay free of per-request APIs, or every static
    // marketing page silently goes dynamic again.
    expect(layout).not.toMatch(/from "next\/headers"/);
  });

  it("can never eat a tap, and goes inert rather than lingering", () => {
    expect(markup).toMatch(/pointer-events:none/);
    // React owns the subtree, so the overlay is NOT removed from the DOM — it
    // has to end hidden instead, or it would sit over the app forever.
    expect(markup).toMatch(/100%\s*\{ opacity:0; visibility:hidden/);
  });

  it("masks by alpha, never by luminance", () => {
    // mask-mode:luminance turned the black cover layer into nothing and does
    // not exist at all on iOS 15.0-15.3 (the app's deployment target is 15.0).
    // The bolt asset is an opaque bolt on a transparent field, so plain alpha
    // masking is both correct and universally supported.
    expect(markup).not.toMatch(/mask-mode:\s*luminance/);
    expect(markup).not.toMatch(/mask-source-type:\s*luminance/);
  });

  it("uses the shipped icon, rebuildable from it", () => {
    // Two inlined WebP assets — the icon and the bolt mask — both derived from
    // public/icon-512.png by scripts/build-splash-assets.mjs. The mask URL
    // repeats across the prefixed mask properties, so count them by role.
    expect((markup.match(/src="data:image\/webp;base64,/g) ?? []).length).toBe(1);
    expect((markup.match(/url\("data:image\/webp;base64,/g) ?? []).length).toBeGreaterThanOrEqual(1);
    const build = read("scripts/build-splash-assets.mjs");
    expect(build).toMatch(/public\/icon-512\.png/);
    // The icon's corners must be cut transparent — opaque, they showed as a
    // dark box the moment the lightning lit up behind the mark.
    expect(build).toMatch(/roundedAlpha\(SIZE, R\)/);
  });

  it("honours reduced motion", () => {
    expect(markup).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
