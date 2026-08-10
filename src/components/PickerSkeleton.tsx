// Loading skeleton shaped like the "Select a card" screen — top stripe + nav
// shell + centered title/subtitle/card-row ghosts. Shown while /dashboard
// resolves with NO ?card selected (app launch, post-login): the generic
// PortalSkeleton mirrors a dashboard — tab bar, help bubble, content cards —
// all of which the picker doesn't have, so the swap visibly tore the chrome
// down. sc-still keeps this surface pinned exactly like the real picker.
export default function PickerSkeleton() {
  return (
    <>
      <div className="sc-top-stripe fixed top-0 left-0 right-0 z-40 h-0.5 bg-gradient-to-r from-blue-600 via-violet-500 to-blue-400" />
      <nav className="sc-app fixed top-0.5 left-0 right-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-800 animate-pulse" />
            <div className="w-20 h-3.5 rounded bg-gray-800 animate-pulse" />
          </div>
          <div className="w-16 h-3.5 rounded bg-gray-800/70 animate-pulse" />
        </div>
      </nav>
      <main
        className="sc-still sc-app min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-24"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="w-full max-w-sm">
          <div className="h-5 w-32 rounded bg-gray-800 animate-pulse mx-auto mb-2" />
          <div className="h-3.5 w-64 rounded bg-gray-800/60 animate-pulse mx-auto mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[66px] rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
