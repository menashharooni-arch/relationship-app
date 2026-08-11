import { Suspense } from "react";
import MobileNav from "@/components/MobileNav";

// Instant loading skeleton for the signed-in portal (dashboard, contacts, links,
// settings, grow, admin). Rendered by each route's loading.tsx the MOMENT a link
// is clicked — so navigation feels immediate instead of showing a frozen screen
// while the server runs its queries. It also unlocks Next's <Link> prefetch for
// these dynamic routes (a dynamic route with no loading boundary isn't
// prefetched at all).
//
// Mirrors the real pages' chrome (top accent stripe + sticky nav bar + dark
// ground + REAL tab bar + help-bubble stand-in) so the swap to real content is
// seamless with no layout jump. The tab bar used to be missing here, which made
// it blink out on every tab switch — the pages mount it themselves, so during
// the skeleton phase there was simply no bar. It's the real <MobileNav>
// (client, pathname-aware) so the active tab is even correct while loading;
// admin visibility resolves with the page (a brief 4-tab bar for office admins
// beats no bar for everyone). `animate-pulse` is a cheap, GPU-friendly
// Tailwind built-in.
export default function PortalSkeleton({
  // The floating assistant bubble stand-in. Same classes/geometry as
  // HelpWidget's trigger so the real one replaces it in place. settings/flows
  // has no floating bubble (inline widget) → pass false there or a bubble
  // would appear and then vanish; office/admin's assistant is purple.
  bubble = "blue",
  // Shape of the content shell.
  //
  // A skeleton whose SHAPE differs from the page it covers trades a frozen
  // screen for a visible reflow at handoff — the ghost boxes rearrange into
  // something else the moment real content lands. "cards" is the dashboard-style
  // 2-column grid; "form" is the single-column stack of labelled fields the card
  // wizard and editor actually render, at their narrower max-w-4xl.
  variant = "cards",
}: {
  bubble?: "blue" | "purple" | false;
  variant?: "cards" | "form";
}) {
  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10" aria-busy="true" aria-label="Loading">
      {/* Top accent stripe — identical to the real pages */}
      <div className="sc-top-stripe fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

      {/* Sticky nav bar shell */}
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-800 animate-pulse" />
            <div className="hidden sm:block w-20 h-3.5 rounded bg-gray-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-lg bg-gray-800/70 animate-pulse" />
            ))}
          </div>
        </div>
      </nav>

      {/* Content shell */}
      <div className={`${variant === "form" ? "max-w-4xl" : "max-w-5xl"} mx-auto pt-20`}>
        <div className="w-44 h-6 rounded bg-gray-800 animate-pulse mb-2" />
        <div className="w-64 h-3.5 rounded bg-gray-800/60 animate-pulse mb-7" />
        {variant === "form" ? (
          <div className="rounded-2xl bg-gray-900 border border-gray-800/80 p-5 space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="w-24 h-3 rounded bg-gray-800/70 animate-pulse mb-2" />
                <div className="h-11 rounded-xl bg-gray-800/50 animate-pulse" />
              </div>
            ))}
            <div className="h-11 w-36 rounded-full bg-gray-800 animate-pulse" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-gray-900 border border-gray-800/80 animate-pulse" />
            ))}
          </div>
        )}
      </div>

      {/* Help-bubble stand-in — non-interactive, replaced in place on load. */}
      {bubble && (
        <div
          aria-hidden="true"
          className={`sc-help-bubble fixed bottom-20 md:bottom-5 right-4 z-40 rounded-full ${bubble === "purple" ? "bg-purple-600 shadow-purple-900/40" : "bg-blue-600 shadow-blue-900/40"} shadow-lg flex items-center justify-center`}
          style={{ width: 52, height: 52 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.9} className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
      )}

      {/* Real tab bar — useSearchParams inside, hence the Suspense boundary. */}
      <Suspense>
        <MobileNav />
      </Suspense>
    </main>
  );
}
