import { fetchAppStoreReviews, averageRating } from "@/lib/app-store-reviews";

// Displays REAL App Store reviews (Apple's public RSS feed). Renders NOTHING
// when there are no reviews — so it's invisible until the iOS app is live, and
// never shows an invented rating/count (FTC compliant, see testimonials/page).
// Async server component: the fetch is cached (revalidate 1h) in the lib.

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={n <= rating ? "#f59e0b" : "none"} stroke={n <= rating ? "#f59e0b" : "#94a3b8"} strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.36 4.78 5.28.77-3.82 3.72.9 5.26L11.48 15.5 6.76 18l.9-5.26L3.84 9.05l5.28-.77 2.36-4.78z" />
        </svg>
      ))}
    </span>
  );
}

export default async function AppStoreReviews() {
  const reviews = await fetchAppStoreReviews(12);
  if (!reviews.length) return null; // pre-launch / no reviews → render nothing

  const avg = averageRating(reviews);
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL || null;

  return (
    <section className="rd-light2 relative py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-12" data-reveal>
          <div className="flex justify-center mb-4">
            <span className="rd-pill rd-pill-l">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--rd-aurora)" }} />
              From the App Store
            </span>
          </div>
          <h2 className="rd-h2 text-slate-900 text-[clamp(1.9rem,4vw,3rem)]">
            What people say on the <span className="rd-aurora-text">App Store</span>
          </h2>
          {avg !== null && (
            <p className="text-slate-500 text-[1.05rem] mt-4">
              <span className="font-bold text-slate-900">{avg.toFixed(1)}</span> average across the {reviews.length} most recent reviews.
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((r, i) => (
            <div key={r.id} className="rd-card-l p-6 flex flex-col" data-reveal style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <Stars rating={r.rating} />
              {r.title && <p className="text-slate-900 font-semibold text-[15px] mt-3">{r.title}</p>}
              <p className="text-slate-600 text-[14px] leading-relaxed mt-2 flex-1 whitespace-pre-line line-clamp-6">{r.body}</p>
              <p className="text-slate-400 text-[12.5px] mt-4 font-medium">— {r.author}</p>
            </div>
          ))}
        </div>

        {appStoreUrl && (
          <div className="text-center mt-10" data-reveal>
            <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="rd-btn rd-btn-primary">
              Read more on the App Store →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
