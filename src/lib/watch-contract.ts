// ── Watch sync contract ──────────────────────────────────────────────────────
// The JSON shape a FUTURE native watchOS/iOS companion app would fetch to render
// the user's SwiftCard on-wrist. This repo is web-only (Next.js) — there is no
// Swift/watchOS code here and none can be shipped from a website. This module
// exists so the *backend* contract is defined, versioned, and testable now; see
// docs/APPLE_WATCH.md for exactly what still requires a separate Xcode project.
//
// Nothing here fakes native behavior: it's a read-only projection of card data
// the user already owns, served over the same authenticated API surface.

export const WATCH_API_VERSION = "1";

// A LinkedIn/Google-style card row we know how to project. Kept loose so callers
// can pass a raw Supabase row without a shared DB type.
export type CardRowLike = {
  username?: string | null;
  name?: string | null;
  title?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  photo_url?: string | null;
  logo_url?: string | null;
};

export type WatchCard = {
  username: string;
  name: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  cardUrl: string;
  // The ONE real Apple Watch touchpoint: an Apple Wallet pass added on iPhone
  // surfaces on the paired Watch. This is a link to our existing .pkpass route.
  walletPassUrl: string;
  // The value a watch app would encode into an on-screen QR for tap-free sharing.
  qrValue: string;
};

export type WatchCardResponse = {
  apiVersion: string;
  updatedAt: string;
  cards: WatchCard[];
};

/** Project a card row into the watch contract. Pure — no I/O — so it's unit
 *  tested without a DB. `appUrl` has any trailing slash trimmed. */
export function buildWatchCard(row: CardRowLike, appUrl: string): WatchCard {
  const base = appUrl.replace(/\/$/, "");
  const username = (row.username ?? "").trim();
  const cardUrl = `${base}/card/${username}`;
  return {
    username,
    name: (row.name ?? "").trim() || "SwiftCard",
    title: row.title ?? null,
    company: row.company ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    photoUrl: row.photo_url ?? null,
    logoUrl: row.logo_url ?? null,
    cardUrl,
    walletPassUrl: `${base}/api/wallet/pass?card=${encodeURIComponent(username)}`,
    qrValue: cardUrl,
  };
}

export function buildWatchResponse(rows: CardRowLike[], appUrl: string): WatchCardResponse {
  return {
    apiVersion: WATCH_API_VERSION,
    updatedAt: new Date().toISOString(),
    cards: rows.filter((r) => (r.username ?? "").trim()).map((r) => buildWatchCard(r, appUrl)),
  };
}
