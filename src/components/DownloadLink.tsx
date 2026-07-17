"use client";

import { openFileViaSystemBrowser } from "@/lib/native-file";

// A normal download link on the web (an <a href> that streams a file). Inside
// the native iOS shell an attachment response can't be saved by WKWebView, so
// on native we intercept the click and open the URL in the system browser
// sheet (where iOS can display/save/share the file). Web behavior is identical
// to a plain <a> — openFileViaSystemBrowser returns false off-native, so the
// default navigation proceeds.
export default function DownloadLink({
  href,
  className,
  title,
  children,
}: {
  href: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={title}
      className={className}
      onClick={(e) => {
        // Fire-and-forget: if native handles it, stop the dead in-webview nav.
        void openFileViaSystemBrowser(href).then((handled) => {
          if (handled) {
            /* already opened in the system browser */
          }
        });
        // Synchronously prevent the WKWebView navigation on native. We can't
        // await here, but detectNativeApp() is synchronous inside the helper;
        // mirror it so the default is only prevented in the shell.
        if (typeof window !== "undefined" && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </a>
  );
}
