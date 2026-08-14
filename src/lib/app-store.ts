// Where the "Download on the App Store" buttons point — and, just as
// importantly, WHETHER they should exist yet.
//
// This used to fall back to "https://apps.apple.com/" with the reasoning that a
// button is then "never a dead link". That reasoning was wrong twice over: the
// App Store's front page is a dead end for someone who came to get a specific
// app, and the button was inviting people to download something that has not
// shipped. SwiftCard's iOS app is still in review, so until it is published the
// honest state is not a fallback link — it is no button at all.
//
// So: null when unset, and every consumer hides itself. That mirrors
// AppStoreReviews, which already renders nothing until real reviews exist.
//
// To turn the app on across the site, set NEXT_PUBLIC_APP_STORE_URL to the real
// listing (e.g. https://apps.apple.com/app/id6798875872). Nothing else needs to
// change — the popup and any future download buttons appear on their own.
export const APP_STORE_URL: string | null =
  process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || null;

/**
 * Is the iOS app actually downloadable?
 *
 * The single source of truth for that question. AppStorePopup uses it to decide
 * whether to show, and TourAutoStart uses it to decide whether to WAIT for that
 * popup — if those two ever disagree, the tour blocks forever on a dismissal
 * event from a popup that never rendered, and a brand-new account silently
 * loses its guided tour. One export, so they cannot drift apart.
 */
export function appStoreReady(): boolean {
  return APP_STORE_URL !== null;
}
