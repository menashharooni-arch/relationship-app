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
 * image (#1A2342 with the icon at 112px, centred). To be identical on the FIRST
 * frame the markup has to be in the initial HTML — a mount effect would paint a
 * blank frame first, which is exactly the flash of nothing this replaces.
 *
 * It is emitted only for shell requests (UA token / sc_shell cookie), so the
 * website never downloads the ~16KB of inlined artwork. Both images are data
 * URIs for the same reason the markup is inline: a network request for the icon
 * could not resolve before the first frame.
 *
 * It plays once per launch: the markup stamps a short-lived `sc_splash` cookie
 * and this component skips itself while that cookie is present.
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
export default async function NativeSplash() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  if (!isNativeRequest(h.get("user-agent"), c.get("sc_shell")?.value ?? null)) return null;
  // Already played this launch — see the cookie note in markup.html. Without
  // this the strike would replay on every full page load inside the app, and
  // every request would carry the inlined artwork.
  if (c.get("sc_splash")?.value === "1") return null;

  const markup = readFileSync(join(process.cwd(), "src/lib/splash/markup.html"), "utf8");
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: markup }} />;
}
