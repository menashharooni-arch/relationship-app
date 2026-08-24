import type { NextRequest } from "next/server";

// Server-side "is this the iOS shell?" — the same two signals proxy.ts keys
// its "/" redirect on: the UA token appended by capacitor.config.ts
// (appendUserAgent "SwiftCardApp") and the `sc_shell` cookie the sc-boot
// script plants on first launch for builds whose UA carries no token.
//
// Why this exists: the AI-consent rules (App Review 5.1.1(i)/5.1.2(i)) are
// stricter in the app than on the web — in the app, "hasn't answered yet"
// must BLOCK, not pass. Client-side native detection can't carry that rule,
// because the one failure mode that matters is exactly the one where the
// client got it wrong (a webview state where the bridge wasn't visible —
// that's how the 3.1.1 login-sheet leak happened). The request headers are
// present on every fetch the webview makes, so the server can hold the line
// even when the page can't.
export function isShellRequest(req: NextRequest): boolean {
  return (
    (req.headers.get("user-agent") ?? "").includes("SwiftCardApp") ||
    req.cookies.get("sc_shell")?.value === "1"
  );
}
