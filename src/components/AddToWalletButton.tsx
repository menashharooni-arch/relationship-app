"use client";

import { detectNativeApp } from "@/lib/platform";

// "Add to Apple Wallet" download button. On the web it's a plain link to the
// pass route — the browser hands the .pkpass to Apple Wallet on iPhone/Mac.
// Parents render this only when hasWalletConfig() is true, so it never shows a
// broken download.
//
// NATIVE (Capacitor shell): a raw WKWebView doesn't reliably hand a .pkpass
// download to Wallet. Opening the same URL in the system-browser sheet
// (@capacitor/browser → SFSafariViewController) does — Safari recognizes the
// pass MIME type and shows Apple's native "Add to Wallet" UI. Web behavior is
// byte-identical (the intercept only engages inside the shell).
export default function AddToWalletButton({ username, className = "" }: { username: string; className?: string }) {
  const href = `/api/wallet/pass?card=${encodeURIComponent(username)}`;

  async function handleNativeOpen(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!detectNativeApp()) return; // web: normal link navigation
    e.preventDefault();
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: new URL(href, window.location.origin).toString() });
    } catch {
      // Plugin missing — fall back to webview navigation (may not open Wallet,
      // but never dead-ends silently).
      window.location.href = href;
    }
  }

  return (
    <a
      href={href}
      onClick={handleNativeOpen}
      className={`w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white bg-black hover:bg-gray-900 transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
        <path d="M17.05 12.54c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.38 2.05-1.44 2.5-.37 6.2 1.03 8.23.69.99 1.51 2.11 2.58 2.07 1.04-.04 1.43-.67 2.68-.67 1.25 0 1.6.67 2.7.65 1.11-.02 1.82-1.01 2.5-2.01.79-1.15 1.11-2.26 1.13-2.32-.02-.01-2.17-.83-2.19-3.29zM15.1 6.29c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.39 1.23-.52.61-.98 1.58-.86 2.51.91.07 1.84-.46 2.4-1.14z" />
      </svg>
      Add to Apple Wallet
    </a>
  );
}
