// ── Apple App Store customer reviews ────────────────────────────────────────
// Pulls REAL reviews from Apple's public customer-reviews RSS feed and returns
// them for display. No auth, no key — the feed is public. Fails safe at every
// step: when the app isn't live yet (no App Store id) or the feed is empty /
// unreachable, this returns [] and the UI renders nothing. It NEVER invents a
// review, rating, or count — only genuine Apple-sourced reviews are ever shown
// (FTC 16 CFR Part 465; see the note in src/app/testimonials/page.tsx).

export type AppStoreReview = {
  id: string;
  author: string;
  rating: number;   // 1–5
  title: string;
  body: string;
  version?: string;
};

// The numeric App Store id. Prefer an explicit APP_STORE_ID; otherwise derive it
// from the NEXT_PUBLIC_APP_STORE_URL (e.g. .../app/swiftcard/id1234567890).
// Returns null until the app is live, which keeps the whole feature dormant.
export function appStoreId(): string | null {
  const direct = (process.env.APP_STORE_ID ?? "").trim();
  if (/^\d+$/.test(direct)) return direct;
  const m = (process.env.NEXT_PUBLIC_APP_STORE_URL ?? "").match(/id(\d+)/);
  return m ? m[1] : null;
}

// Average of the reviews we fetched (one decimal). Note: this is the average of
// the RECENT reviews in the feed, not Apple's lifetime aggregate — labelled as
// such in the UI so it's never misrepresented.
export function averageRating(reviews: AppStoreReview[]): number | null {
  if (!reviews.length) return null;
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export async function fetchAppStoreReviews(limit = 12): Promise<AppStoreReview[]> {
  const id = appStoreId();
  if (!id) return [];
  const country = (process.env.APP_STORE_COUNTRY || "us").toLowerCase();
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/id=${id}/sortBy=mostRecent/json`;

  try {
    // Cache for an hour — Apple's feed updates slowly and this keeps marketing
    // pages fast without hammering the feed on every request.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const entries = data?.feed?.entry;
    if (!Array.isArray(entries)) return [];

    const out: AppStoreReview[] = [];
    for (const e of entries) {
      // The first feed entry is the app itself (no im:rating) — skip it.
      const rating = Number(e?.["im:rating"]?.label);
      if (!Number.isFinite(rating) || rating < 1) continue;
      const body = String(e?.content?.label ?? "").trim();
      if (!body) continue;
      out.push({
        id: String(e?.id?.label ?? out.length),
        author: String(e?.author?.name?.label ?? "App Store user").trim() || "App Store user",
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        title: String(e?.title?.label ?? "").trim(),
        body,
        version: e?.["im:version"]?.label ? String(e["im:version"].label) : undefined,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
