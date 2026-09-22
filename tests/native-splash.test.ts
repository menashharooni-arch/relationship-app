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
    expect(component).toMatch(/cachedMarkup\[file\] \?\?=/);
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

// v2 (owner, 2026-09-17): "that navy screen [should] just be the same exact
// color as my logo … just the main part of my logo is in the center". The
// whole screen is the icon's own gradient and only its mark sits in the
// centre. It ships beside v1, chosen by the app build, because frame 0 must
// match the launch image compiled into whichever build is installed.
describe("native splash v2", () => {
  const v2 = read("src/lib/splash/markup-v2.html");
  const capacitor = read("capacitor.config.ts");

  it("is recognised by its token, and sent a file that starts on ITS launch image", () => {
    expect(component).toMatch(/SPLASH_V2_TOKEN = "SwiftCardSplash\/2"/);
    expect(component).toMatch(/\.includes\(SPLASH_V2_TOKEN\)/);
    expect(component).toMatch(/join\(process\.cwd\(\), "src\/lib\/splash", file\)/);
    // A v2 build now gets the TRANSITION file — frame 0 is still v2's launch
    // image, so the handoff is unchanged; it then cross-fades to the new
    // screen (2026-09-22). Its frame 0 is pinned in the transition suite.
    expect(component).toMatch(/2: "markup-v2to3\.html"/);
    // …and every build without a token is a v1 build, and gets its own.
    expect(component).toMatch(/1: "markup-v1to3\.html"/);
    // The CURRENT build ships the v3 launch image, so that is what it says it
    // carries; v2 stays reachable for the builds already installed.
    expect(capacitor).toMatch(/appendUserAgent: "SwiftCardApp SwiftCardSplash\/3"/);
  });

  it("paints the logo's gradient full screen, from the very first frame", () => {
    expect(v2).not.toMatch(/1A2342/i);
    const gradient = v2.match(/linear-gradient\(135deg,[^)]+\)/)?.[0];
    expect(gradient).toBeTruthy();
    // The hold frame (root) and the plane must be the SAME gradient, sized to
    // the same 100vmax square the launch image aspect-fills, or the handoff
    // from the static image shifts.
    const fill = `background:${gradient} 50% 50% / 100vmax 100vmax no-repeat,#364278;`;
    expect(v2).toContain(`html.sc-splash-hold #sc-splash-vfork{ ${fill} }`);
    const plane = v2.slice(v2.indexOf(".vfk-plane{"));
    expect(plane.slice(0, plane.indexOf("}"))).toContain(fill);
    expect(v2).toMatch(/--vfk-mark: 20\.4978vmax/);
  });

  it("uses one smooth bolt mask, defined once", () => {
    expect((v2.match(/--vfk-bolt: url\("data:image\/webp;base64,/g) ?? []).length).toBe(1);
    expect((v2.match(/var\(--vfk-bolt\)/g) ?? []).length).toBe(4);
    expect((v2.match(/src="data:image\/webp;base64,/g) ?? []).length).toBe(1);
    const build = read("scripts/build-splash-v2.mjs");
    expect(build).toMatch(/public\/icon-512\.png/);
    // sharp widens a 1-channel buffer to 3 bands; reading it as 1 sheared the
    // bolt into a striped sliver.
    expect(build).toMatch(/\.extractChannel\(0\)/);
  });

  it("keeps every v1 guard", () => {
    expect(v2).toMatch(/d\.classList\.add\("sc-splash-armed"\);d\.classList\.add\("sc-splash-hold"\)/);
    expect(v2).toMatch(/html:not\(\.sc-splash-armed\) #sc-splash-vfork\{display:none!important\}/);
    expect(v2).toMatch(/d\.classList\.remove\("sc-splash-armed"\)/);
    expect(v2).toMatch(/document\.referrer\.indexOf\(location\.origin\)===0/);
    expect(v2).toMatch(/animation:vfk-clear 1400ms linear both;/);
    expect(v2).not.toMatch(/mask-mode:\s*luminance/);
    expect(v2).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});

// ── v3: the owner's reference image ─────────────────────────────────────────
// Owner, 2026-09-20: make the splash this image, then run the same lightning
// into it. Everything about the SEQUENCE is v2's and is covered above; what is
// pinned here is the artwork it now starts from, and the versioning that keeps
// an installed app from handing off to a frame 0 that is not its launch image.
describe("native splash v3", () => {
  const v3 = read("src/lib/splash/markup-v3.html");
  const build = read("scripts/build-splash-v3.mjs");
  const capacitor = read("capacitor.config.ts");

  it("is served only to builds that carry the v3 launch image", () => {
    expect(component).toMatch(/SPLASH_V3_TOKEN = "SwiftCardSplash\/3"/);
    expect(component).toMatch(/ua\.includes\(SPLASH_V3_TOKEN\) \? 3 : ua\.includes\(SPLASH_V2_TOKEN\) \? 2 : 1/);
    expect(component).toMatch(/markup-v3\.html/);
    expect(capacitor).toMatch(/SwiftCardSplash\/3/);
  });

  it("frame 0 is the reference field, root and plane painting the identical fill", () => {
    // Both the HOLD frame (painted by the root before the native launch image
    // is dropped) and the plane must be the same field, sized to the same
    // 100vmax square the launch image aspect-fills, or the handoff shifts.
    const field = v3.match(/radial-gradient\([^;]+linear-gradient\(146\.5deg,#2c489f 0%,#111b49 100%\)/)?.[0];
    expect(field, "the v3 field").toBeTruthy();
    const fill = `background:${field} 50% 50% / 100vmax 100vmax no-repeat,#1f3274;`;
    expect(v3).toContain(`html.sc-splash-hold #sc-splash-vfork{ ${fill} }`);
    const plane = v3.slice(v3.indexOf(".vfk-plane{"));
    expect(plane.slice(0, plane.indexOf("}"))).toContain(fill);
    // v2's lighter field is gone.
    expect(v3).not.toContain("linear-gradient(135deg,#4a5ea5");
  });

  it("draws the mark at the size the launch image does", () => {
    // 28.125vmax is the reference's own card (36.07% of its width) expressed
    // against the mark's box; scripts/verify-splash.mjs measures the real thing.
    expect(v3).toMatch(/--vfk-mark: 28\.125vmax/);
    expect(build).toMatch(/const MARK_VMAX = \+\(CARD_VMAX \* \(REF\.side \/ 290\)\)/);
  });

  it("the mark is drawn from the reference, not lifted out of the app icon", () => {
    expect(build).toContain("BOLT_PATH");
    // It never READS the icon — the shape is the traced path in the script.
    expect(build).not.toMatch(/sharp\(ICON\)|const ICON =/);
    // Two glow passes, fitted to the reference's measured falloff.
    expect(build).toMatch(/GLOW_LAYERS = \[[\s\S]*sigma: 35[\s\S]*sigma: 16[\s\S]*\]/);
  });

  it("opens through its OWN bolt, with one mask defined once", () => {
    expect((v3.match(/--vfk-bolt: url\("data:image\/webp;base64,/g) ?? []).length).toBe(1);
    expect((v3.match(/var\(--vfk-bolt\)/g) ?? []).length).toBe(4);
    expect((v3.match(/src="data:image\/webp;base64,/g) ?? []).length).toBe(1);
    expect(build).toMatch(/svgBolt\(MASK_PX\)/);
  });

  it("keeps every v1 guard", () => {
    expect(v3).toMatch(/d\.classList\.add\("sc-splash-armed"\);d\.classList\.add\("sc-splash-hold"\)/);
    expect(v3).toMatch(/html:not\(\.sc-splash-armed\) #sc-splash-vfork\{display:none!important\}/);
    expect(v3).toMatch(/d\.classList\.remove\("sc-splash-armed"\)/);
    expect(v3).toMatch(/document\.referrer\.indexOf\(location\.origin\)===0/);
    expect(v3).toMatch(/animation:vfk-clear 1400ms linear both;/);
    expect(v3).not.toMatch(/mask-mode:\s*luminance/);
    expect(v3).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});

// ── The transition files: the new screen on the apps already installed ──────
// Owner, 2026-09-22: "I don't want to wait for the review." The launch image
// lives in the bundle, so a phone with an older build shows ITS image at
// launch whatever the server sends. These files start there — pixel-identical,
// so the handoff is still invisible — and cross-fade to the new screen under
// the charge, before the fork lands. Measured against the real launch asset:
// frame 0 differs by 0.4/255 on average.
describe("native splash — transition builds", () => {
  const v2to3 = read("src/lib/splash/markup-v2to3.html");
  const v1to3 = read("src/lib/splash/markup-v1to3.html");
  const v2 = read("src/lib/splash/markup-v2.html");
  const v1 = read("src/lib/splash/markup.html");
  const build = read("scripts/build-splash-transition.mjs");

  it("every installed build is sent the file whose frame 0 is ITS launch image", () => {
    expect(component).toMatch(/3: "markup-v3\.html"/);
    expect(component).toMatch(/2: "markup-v2to3\.html"/);
    expect(component).toMatch(/1: "markup-v1to3\.html"/);
  });

  it.each([
    ["v2to3", v2to3, v2],
    ["v1to3", v1to3, v1],
  ])("%s holds the old ground and the old mark at frame 0", (_name, transition, old) => {
    // the ground the root paints while held — the old one, not the new one
    const oldHold = old.match(/html\.sc-splash-hold #sc-splash-vfork\{ background:([^;]+); \}/)?.[1];
    expect(oldHold).toBeTruthy();
    expect(transition).toContain(`html.sc-splash-hold #sc-splash-vfork{ background:${oldHold}; }`);
    // …and the layer that paints that image: the old mark, at the old size.
    const oldMark = old.match(/<img class="vfk-icon" src="(data:image\/webp;base64,[^"]+)"/)?.[1];
    const oldSize = old.match(/--vfk-mark: ([\d.]+)vmax;/)?.[1];
    expect(transition).toContain(`.vfk-legacy{`);
    expect(transition).toContain(`background:url("${oldMark}") 50% 50% / ${oldSize}vmax ${oldSize}vmax no-repeat,${oldHold};`);
  });

  it("gives the old screen no time of its own: gone 130ms after the app takes over", () => {
    // Owner, 2026-09-22: remove the navy screen with the app icon, keep the
    // new one. The clock starts when the native launch image is taken away, so
    // the fade begins at 0 and is over before the fork starts at 150ms. It
    // cannot be instant — frame 0 must still BE that build's launch image or
    // the mark jumps at the handoff — so 130ms is the floor.
    for (const t of [v2to3, v1to3]) {
      expect(t).toMatch(/@keyframes vfk-legacy-out\{/);
      expect(t).toMatch(/0%\{ opacity:1 \}/);
      expect(t).toMatch(/9\.285\d*%\{ opacity:0 \}/);
      expect(t).toMatch(/100%\{ opacity:0 \}/);
      expect(t).toMatch(/animation:vfk-legacy-out 1400ms linear both;/);
      // …and no second "hold it a while longer" stop.
      expect(t).not.toMatch(/7\.857\d*%\{ opacity:1 \}/);
    }
    expect(build).toMatch(/FADE_START_MS = 0/);
    expect(build).toMatch(/FADE_END_MS = 130/);
  });

  it("is the v3 sequence otherwise — one animation, not three", () => {
    for (const t of [v2to3, v1to3]) {
      expect(t).toMatch(/--vfk-mark: 28\.125vmax/);          // the new mark
      expect(t).toMatch(/linear-gradient\(146\.5deg/);        // the new field
      expect(t).toMatch(/animation:vfk-clear 1400ms linear both;/);
      expect(t).toMatch(/d\.classList\.add\("sc-splash-armed"\);d\.classList\.add\("sc-splash-hold"\)/);
      expect(t).toMatch(/html:not\(\.sc-splash-armed\) #sc-splash-vfork\{display:none!important\}/);
      expect(t).toMatch(/prefers-reduced-motion:\s*reduce/);
      expect((t.match(/--vfk-bolt: url\("data:image\/webp;base64,/g) ?? []).length).toBe(1);
    }
  });
});
