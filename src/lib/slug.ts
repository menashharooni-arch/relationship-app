// Pure card-slug normalizer — the single source of truth for turning any text
// (a name, a name+company, a hand-typed URL) into a valid card slug. No server
// imports, so it's safe in client components (the new-card wizard's live URL
// preview, the card-URL editor) AND server code (the cards API), guaranteeing
// the URL a user is shown while creating/editing a card is exactly the one that
// gets saved.
//
// Charset: [a-z0-9-], no leading/trailing hyphen, no runs, capped at 60.
export function normalizeSlug(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-") // spaces / punctuation → hyphen
    .replace(/-+/g, "-")          // collapse runs
    .replace(/^-+|-+$/g, "")      // trim hyphens
    .slice(0, 60)
    .replace(/-+$/g, "");         // no trailing hyphen after the slice
}

// ── Reserved slugs ───────────────────────────────────────────────────────────
//
// Card pages live at the ROOT (swiftcard.me/<slug>) since 2026-08-19, so a
// slug that matches an app route would produce a card page the router can
// never reach (static routes always win over the dynamic segment). Reserved
// names are treated as taken during slug generation and custom-URL changes.
// The list holds every current top-level route plus names likely to become
// one — reserving generously is free, un-reserving a shipped username is not.
export const RESERVED_SLUGS = new Set([
  // current app routes
  "account-deleted", "admin", "api", "auth", "card", "cards", "checkout",
  "company", "compare", "contact", "for", "contacts", "dashboard", "grow", "join",
  "links", "login", "office", "onboarding", "preview", "pricing", "privacy",
  "products", "profile", "r", "settings", "share", "sms-consent", "sms-terms",
  "templates", "terms", "testimonials", "unsubscribe", "upgrade", "welcome",
  // platform/static paths
  "favicon", "robots", "sitemap", "manifest", "icon", "apple-icon",
  "opengraph-image", "_next", "well-known",
  // likely future routes
  "about", "app", "blog", "docs", "help", "home", "index", "jobs", "legal",
  "logout", "new", "news", "partners", "press", "signin", "signup", "signout",
  "static", "status", "support", "team",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizeSlug(slug));
}
