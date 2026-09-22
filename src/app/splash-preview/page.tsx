import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";

// ── Watch the launch animation without installing a build ───────────────────
//
// The launch image is COMPILED INTO the app, so the animation that hands off
// from it can only be sent to a build carrying that image (NativeSplash's
// SwiftCardSplash/N token). That is what keeps frame 0 identical to the static
// image — and it also means a new splash cannot be seen on a phone until the
// next App Store build ships. Owner, 2026-09-21: "did you ship the new splash
// screen, i dont see it?"
//
// This page plays the CURRENT version (markup-v3.html) on any device, in the
// browser or inside the app, so it can be reviewed before that build exists.
// It is the same file the shell is served, not a copy — a preview that could
// drift from the real thing would be worse than no preview.
//
// Deliberately: linked from nowhere, noindex, and it arms the overlay itself
// (the markup only arms on a cold launch, which a typed URL is not).
export const metadata: Metadata = {
  title: "Launch animation preview",
  robots: { index: false, follow: false },
};

// ?v= picks which one to watch. The default is what a NEW build plays; the
// transition files are what the apps already installed play, starting on their
// own launch image and cross-fading to the new screen (NativeSplash).
const FILES: Record<string, string> = {
  "3": "markup-v3.html",
  "2to3": "markup-v2to3.html",
  "1to3": "markup-v1to3.html",
};

export default async function SplashPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const key = v && FILES[v] ? v : "3";
  const file = FILES[key];
  const markup = readFileSync(join(process.cwd(), "src/lib/splash", file), "utf8");
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
      {/* What the bolt opens onto — the page underneath, as on a real launch. */}
      <h1 className="text-white text-2xl font-bold">SwiftCard</h1>
      <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
        {file === FILES["3"]
          ? "This is the launch animation a new app build plays. Tap replay to watch it again."
          : "This is what the app you already have plays: it starts on its own launch screen and cross-fades to the new one. Tap replay to watch it again."}
      </p>
      <div className="flex gap-3 text-xs text-gray-500">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={file === FILES["3"] ? "text-white font-semibold" : "underline"} href="/splash-preview">New build</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={file === FILES["2to3"] ? "text-white font-semibold" : "underline"} href="/splash-preview?v=2to3">Installed app</a>
      </div>
      {/* A FULL page load, not next/link: the overlay's guard and its clock
          both run at parse, and a client-side navigation would re-mount the
          markup without ever running its script — which is exactly the case
          the arming guard exists to suppress. Nothing would play. */}
      <a
        // Replays the one being watched, not the default. `key` comes from the
        // FILES table, never straight from the query, so nothing a visitor
        // types can land in the URL.
        href={key === "3" ? "/splash-preview" : `/splash-preview?v=${key}`}
        className="mt-1 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
      >
        Replay
      </a>

      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: markup }} />
      {/* The markup arms itself only for a cold launch (no same-origin
          referrer). Tapping Replay IS a same-origin navigation, so arm it here
          — after the markup, so this runs once its own guard has. Nothing else
          about the sequence is touched: the hold releases on its own web
          fallback, and the overlay still disarms itself at the end. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.remove("sc-nosplash");document.documentElement.classList.add("sc-splash-armed");`,
        }}
      />
    </main>
  );
}
