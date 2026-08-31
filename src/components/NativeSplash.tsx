import { cookies, headers } from "next/headers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isNativeRequest } from "@/lib/native-request";

/**
 * The iOS shell's launch animation: a fork of lightning down the whole screen,
 * the logo emerging from the flash, then the logo's own bolt opening onto the
 * app. Owner-specified sequence, 2026-08-31.
 *
 * Why it is SERVER-rendered and shell-gated
 * -----------------------------------------
 * iOS shows a static launch image and cannot animate it, so this takes over the
 * instant the webview paints and its first frame is pixel-identical to that
 * image (#1A2342 with the icon at 20.351vmax, centred). To be identical on the
 * FIRST frame the markup has to be in the initial HTML — a mount effect would
 * paint a blank frame first, which is exactly the flash of nothing this
 * replaces. Both images are data URIs for the same reason: a network request
 * for the icon could not resolve before the first frame.
 *
 * It is emitted only for shell requests (UA token / sc_shell cookie), so the
 * website never downloads the inlined artwork.
 *
 * PLAYS ON EVERY LAUNCH, NEVER MID-SESSION
 * ----------------------------------------
 * This used to be gated on a 2-minute `sc_splash` cookie, which had it exactly
 * backwards: the cookie outlives the app, so quitting and reopening inside two
 * minutes — the single most common way anyone reopens an app — got NO launch
 * animation, while the guarantee it bought (no replay on in-app navigations)
 * is already provided precisely by the same-origin referrer check in the
 * markup. Launch detection is now stateless and correct:
 *
 *   `Sec-Fetch-Site: same-origin`  =>  a navigation from a page of ours, so
 *   this is not a launch: skip the payload entirely. A cold launch (or a
 *   universal link from another app) carries `none`, and iOS 15 — below the
 *   16.4 that added the header — omits it, in which case we still send the
 *   markup and the referrer guard suppresses the animation client-side.
 *
 * No cleanup script: React owns this subtree, so rather than removing the node
 * from under it the animation ends on `visibility:hidden`, and the root carries
 * `pointer-events:none` throughout — the overlay can never eat a tap, before or
 * after it finishes.
 *
 * The artwork is the shipped app icon, unmodified except for one repair: the
 * file is a solid square whose corners are filled with the same navy as the
 * splash, which showed as a dark box the moment light passed behind it. Those
 * corner pixels are transparent in the copy used here (scripts/build-splash-assets.mjs).
 */

// Read once per server process, not once per request: this is ~52KB of inlined
// artwork and a synchronous disk read has no business in the request path.
let cachedMarkup: string | null = null;
function splashMarkup(): string {
  cachedMarkup ??= readFileSync(join(process.cwd(), "src/lib/splash/markup.html"), "utf8");
  return cachedMarkup;
}

export default async function NativeSplash() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  if (!isNativeRequest(h.get("user-agent"), c.get("sc_shell")?.value ?? null)) return null;
  // A navigation from one of our own pages is not a launch — see above.
  if (h.get("sec-fetch-site") === "same-origin") return null;

  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: splashMarkup() }} />;
}
