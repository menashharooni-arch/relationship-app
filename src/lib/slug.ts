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
