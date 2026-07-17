import { detectNativeApp } from "@/lib/platform";

/**
 * Native file-handoff for the Capacitor iOS shell.
 *
 * WHY: a WKWebView cannot save a Blob/anchor `download` or an
 * `attachment`-disposition response — the tap silently no-ops. That is a real
 * App Review 2.1 "the button does nothing" risk for our download surfaces
 * (Save Contact .vcf, CSV export, card/QR images). The reliable native path is
 * to open the file's URL in the SYSTEM browser sheet
 * (@capacitor/browser → SFSafariViewController), which natively renders a
 * vCard "Add to Contacts" preview and offers Save/Share for other file types.
 *
 * Web is completely untouched: `detectNativeApp()` is false on web/SSR, so
 * these helpers return false and callers keep their existing Blob/anchor path.
 */

/** True only inside the native shell. */
export function isNativeShell(): boolean {
  return detectNativeApp();
}

/**
 * On native, open an absolute (or root-relative) URL in the system browser and
 * return true (handled). On web, return false so the caller runs its normal
 * download path. Best-effort: if the Browser plugin is missing (old shell
 * build) we fall back to a top-level navigation, which at least lets iOS's
 * document handler take over instead of a dead Blob click.
 */
export async function openFileViaSystemBrowser(url: string): Promise<boolean> {
  if (!detectNativeApp()) return false;
  const abs = url.startsWith("http")
    ? url
    : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: abs });
    return true;
  } catch {
    try {
      window.location.href = abs;
    } catch {
      /* ignore */
    }
    return true;
  }
}
