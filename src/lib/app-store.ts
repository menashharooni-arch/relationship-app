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

// The numeric App Store id. NEXT_PUBLIC_APP_STORE_ID is the explicit source
// (digits only — anything else is ignored rather than baked into a link);
// when it is unset the id is parsed out of the listing URL (".../app/id6798…"),
// so an environment that only ever set NEXT_PUBLIC_APP_STORE_URL keeps working.
// Null when neither yields an id — every consumer hides, same contract as
// APP_STORE_URL. Feeds the Smart App Banner (root layout `itunes` metadata) and
// the "Rate us" links below.
export const APP_STORE_ID: string | null =
  process.env.NEXT_PUBLIC_APP_STORE_ID?.trim().match(/^\d+$/)?.[0] ??
  APP_STORE_URL?.match(/\/id(\d+)/)?.[1] ??
  null;

// Where a "Rate us" button points. Built from the id, never hardcoded.
//
// In the iOS app it is the write-review page: Capacitor hands a target=_blank
// link to UIApplication.open, and iOS opens apps.apple.com links in the App
// Store app itself — straight onto the review form, which is what Apple's own
// docs prescribe for a user-initiated "rate this app" control.
//
// On the web it is the plain listing: a web visitor may not have the app, and
// you cannot review an app you have not downloaded.
export const APP_STORE_LISTING_URL: string | null =
  APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : null;
export const APP_STORE_WRITE_REVIEW_URL: string | null =
  APP_STORE_LISTING_URL ? `${APP_STORE_LISTING_URL}?action=write-review` : null;

/**
 * Email-safe "Download on the App Store" block — the badge for TRANSACTIONAL
 * emails (welcome, office invite). Same self-activating contract as every
 * other consumer: empty string until NEXT_PUBLIC_APP_STORE_URL is set, so
 * emails sent while the app is in review carry nothing, and the ones sent
 * after the listing goes live carry the badge with no second deploy.
 *
 * Inline styles and no SVG, because email clients; a black Apple-style pill
 * with the classic two-line label, preceded by one short line of context.
 * `lead` lets each email say why the app matters to ITS reader.
 */
export function appStoreEmailBlock(lead: string): string {
  if (!APP_STORE_URL) return "";
  return `
    <div style="margin:28px 0 0;padding:20px 0 0;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;color:#475569;font-size:13px;line-height:1.5;">${lead}</p>
      <a href="${APP_STORE_URL}" style="display:inline-block;background:#0f172a;border-radius:12px;padding:9px 18px;text-decoration:none;">
        <span style="display:block;color:#cbd5e1;font-size:10px;line-height:1.2;">Download on the</span>
        <span style="display:block;color:#ffffff;font-size:17px;font-weight:700;line-height:1.25;">App&nbsp;Store</span>
      </a>
    </div>`;
}
