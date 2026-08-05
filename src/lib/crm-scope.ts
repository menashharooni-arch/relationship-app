// Which cards feed which CRM destination.
//
// Integrations are keyed (user_id, provider) and the Zapier webhook is a single
// column on profiles, so before this every card on an account fed the same
// destination. Someone with a personal card and an employer card had their
// personal contacts written into the employer's CRM — data that had already
// left the building by the time any downstream filter could sort it.
//
// The rule is deliberately small and lives HERE so there is one definition of
// "in scope" rather than one per provider:
//
//   null / absent  -> ALL cards. The pre-existing behaviour, and what every row
//                     reads as the moment the migration lands, so connecting
//                     nothing and changing nothing keeps working identically.
//   non-empty list -> ONLY those card ids.
//   empty list     -> nothing. The save API rejects empty (see the scope route)
//                     so a user can't reach this by accident, but if it ever
//                     shows up in the data, sending nothing is the safe read.
//
// FAIL CLOSED is the load-bearing part. When a scope is set and we cannot
// identify the card the lead came from, the answer is NO. The whole point of
// the feature is that contacts don't reach a destination the owner didn't pick,
// so "not provably in scope" has to mean "don't send" — a leak is unrecoverable
// (the data is on someone else's server), a missed sync is not.

/** null means "all cards". An array means "only these card ids". */
export type CardScope = string[] | null;

/**
 * Normalize whatever came back from the database.
 *
 * Anything that isn't an array becomes null — "all cards". That is not
 * sloppiness, it is the pre-migration path: on a database where the card_ids
 * column doesn't exist yet the field arrives as `undefined`, and treating that
 * as a restriction would silently stop every sync for every account at once.
 * A missing column means "nobody has configured this", which is exactly "all".
 */
export function parseCardScope(raw: unknown): CardScope {
  if (!Array.isArray(raw)) return null;
  // Keep the array-ness even if every entry is junk: the user DID restrict this
  // integration, so a list that filters down to nothing must not silently widen
  // back out to "all cards".
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * May a lead captured by `cardId` be sent to a destination scoped to `scope`?
 *
 * `cardId` is the cards.id uuid — never the username. Usernames are editable
 * (CardUrlEditor), so keying scope on them would silently re-route or drop a
 * destination the moment someone renamed a card.
 */
export function isCardInScope(scope: CardScope, cardId: string | null | undefined): boolean {
  if (scope === null) return true; // all cards
  if (!cardId) return false; // fail closed — see the header
  return scope.includes(cardId);
}

/** True when this destination is restricted rather than sending everything. */
export function isScoped(scope: CardScope): boolean {
  return scope !== null;
}

/**
 * Clean a scope coming from the client before it is stored.
 *
 * Returns null for "all cards", or a de-duplicated list of ids. The caller is
 * responsible for rejecting an empty result — this only sanitizes, it does not
 * decide policy.
 */
export function sanitizeCardScope(raw: unknown): CardScope {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v === "string" && UUID_RE.test(v.trim())) seen.add(v.trim().toLowerCase());
  }
  return [...seen];
}

// Ids are written straight into a uuid[] column; anything that isn't a uuid
// would make Postgres reject the whole update, so non-uuids are dropped rather
// than passed through.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
