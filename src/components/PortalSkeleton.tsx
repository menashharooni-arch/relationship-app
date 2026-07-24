// Instant loading skeleton for the signed-in portal (dashboard, contacts, links,
// settings, grow, admin). Rendered by each route's loading.tsx the MOMENT a link
// is clicked — so navigation feels immediate instead of showing a frozen screen
// while the server runs its queries. It also unlocks Next's <Link> prefetch for
// these dynamic routes (a dynamic route with no loading boundary isn't
// prefetched at all).
//
// Pure server markup — no state, no effects. It deliberately mirrors the real
// pages' chrome (top accent stripe + sticky nav bar + dark ground) so the swap
// to real content is seamless with no layout jump. `animate-pulse` is a cheap,
// GPU-friendly Tailwind built-in.
export default function PortalSkeleton() {
  return (
    <main className="sc-app min-h-screen bg-gray-950 px-5 py-10 pb-24 md:pb-10" aria-busy="true" aria-label="Loading">
      {/* Top accent stripe — identical to the real pages */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />

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
      <div className="max-w-5xl mx-auto pt-20">
        <div className="w-44 h-6 rounded bg-gray-800 animate-pulse mb-2" />
        <div className="w-64 h-3.5 rounded bg-gray-800/60 animate-pulse mb-7" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-900 border border-gray-800/80 animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
