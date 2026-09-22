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

// Every way this can come back empty, said out loud.
//
// This used to be `catch {}` and three bare `return []`s. Failing safe is
// right — a marketing page must never show a broken rating — but failing
// SILENTLY meant the section sat empty on swiftcard.me for days with four real
// five-star reviews live on the App Store, and nothing anywhere said why.
// Owner, 2026-09-22: "I thought I saw a reviews page... any five star review
// got posted to our website, no?" It was there; it just wasn't speaking.
//
// One prefix, greppable in Vercel's runtime logs (the page is ISR, so the
// regeneration that produced an empty section is the line you want).
function quiet(reason: string): AppStoreReview[] {
  console.warn(`[app-store-reviews] no reviews shown: ${reason}`);
  return [];
}

export async function fetchAppStoreReviews(limit = 12): Promise<AppStoreReview[]> {
  const id = appStoreId();
  if (!id) {
    return quiet(
      "no App Store id — set NEXT_PUBLIC_APP_STORE_URL (or APP_STORE_ID) in this environment",
    );
  }
  const country = (process.env.APP_STORE_COUNTRY || "us").toLowerCase();
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/id=${id}/sortBy=mostRecent/json`;

  try {
    // Cache for an hour — Apple's feed updates slowly and this keeps marketing
    // pages fast without hammering the feed on every request.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return quiet(`Apple returned ${res.status} ${res.statusText} for ${url}`);
    const data = await res.json().catch(() => null);
    if (data === null) return quiet(`Apple's response was not JSON (${url})`);
    // Apple's JSON is a converted XML feed, so a feed holding exactly ONE
    // review gives `entry` as an object rather than a one-element array. The
    // old code required an array and dropped that review on the floor — the
    // first review the app ever got would have been invisible.
    const raw = data?.feed?.entry;
    const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : null;
    if (!entries) {
      return quiet(`feed.entry is ${raw === undefined ? "missing" : typeof raw} (${url})`);
    }

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
    if (!out.length) return quiet(`${entries.length} feed entries, none usable (${url})`);
    return out;
  } catch (err) {
    return quiet(`fetch threw: ${err instanceof Error ? err.message : String(err)} (${url})`);
  }
}
