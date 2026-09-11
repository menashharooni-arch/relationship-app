import type { GeoAccuracy } from "@/lib/request-geo";
import { markPhrase, markPlace } from "@/lib/location-privacy";

// ── Saying only what we actually know about where someone was ────────────────
//
// THE PROBLEM THIS FIXES. Every stored location was a bare string, and three
// completely different facts came out shaped identically:
//
//   "Ithaca, NY"      two databases named the town
//   "Great Neck, US"  one database named the town; nothing confirmed it
//   "New York, US"    the databases DISAGREED — somewhere in New York State
//   "US"              country only
//
// Production 2026-09-03 → 09-09: 19 of 26 views stored "New York, US", and the
// owner's notification said "viewed your card near New York, US". Every person
// who reads that reads New York City. The pipeline never meant that, and it
// knew it didn't — lib/request-geo.ts makes the distinction and used to discard
// it. Now the confidence is stored beside the label (card_views.geo_accuracy,
// card_events.geo_accuracy) and this file is the only place that turns the pair
// into words.
//
// TWO RULES, and they are the whole file:
//
//   1. NEVER INVENT PRECISION. A town is stated flat only when two independent
//      IP databases agreed on it. One source's guess is "near". A region is a
//      region. A country is a country.
//   2. HISTORY RENDERS EXACTLY AS IT DID. Every row written before the accuracy
//      column existed has accuracy null, and a null accuracy returns the label
//      untouched — the pre-existing behaviour, byte for byte. No backfill, no
//      guessing at what old rows meant, no change to the Locations tab for data
//      already in it.
//
// The LABEL ITSELF is never rewritten: it is the Locations tab's grouping key
// and locationAliases()' input. Only the presentation changes.

/** Nothing known. One string, used everywhere, so it never drifts. */
export const LOCATION_UNAVAILABLE = "Location unavailable";

/**
 * A stored label split back into the parts the label format guarantees.
 *
 * Split on the LAST comma, not the first: the only multi-comma region name in
 * the table is "Washington, D.C.", which would otherwise come back as
 * "Washington" in a state called "D.C.".
 */
function splitLabel(label: string): { head: string; tail: string | null } {
  const at = label.lastIndexOf(", ");
  if (at < 0) return { head: label, tail: null };
  return { head: label.slice(0, at), tail: label.slice(at + 2) };
}

/**
 * How a location reads in a LIST — the Locations tab, a contact's detail panel.
 *
 *   city         → "Ithaca, NY"
 *   city_approx  → "Near Great Neck, NY"
 *   region       → "New York (approximate)"
 *   country      → "United States (approximate)"
 *   no label     → "Location unavailable"
 *   legacy row   → the label, exactly as it is stored
 */
export function locationLabel(
  label: string | null | undefined,
  accuracy: GeoAccuracy | null | undefined,
): string {
  const raw = (label ?? "").trim();
  if (!raw) return LOCATION_UNAVAILABLE;
  // Legacy rows (and anything written while the migration is unapplied) carry
  // no accuracy. Rendering them unchanged is the whole backward-compatibility
  // story: the Locations tab a customer looked at yesterday looks the same.
  if (!accuracy) return raw;

  switch (accuracy) {
    case "city":
      return raw;
    case "city_approx":
      return `Near ${raw}`;
    case "region": {
      // "New York, US" means somewhere in New York State. Dropping the country
      // code is what stops it reading as the city of the same name.
      const { head } = splitLabel(raw);
      return `${head} (approximate)`;
    }
    case "country": {
      // A bare ISO code is the normal shape here; anything else is a label that
      // degraded to country confidence without losing its text, so it keeps it.
      const name = COUNTRY_NAMES[raw.toUpperCase()];
      return name ? `${name} (approximate)` : `${raw} (approximate)`;
    }
  }
}

/**
 * How a location reads INSIDE A SENTENCE — a push notification, a bell row.
 *
 * Returns the fragment with its own preposition, or "" when there is nothing
 * honest to say, so callers concatenate without a trailing "near".
 *
 *   city / city_approx → " near Ithaca, NY"
 *   region             → " in the New York area"
 *   country            → " in the United States"
 *   nothing            → ""
 *
 * "near" carries the approximation at city level, which is why city and
 * city_approx read the same here: a lock screen has ~60 characters
 * (push-policy.MAX_BODY_CHARS) and "(approximate)" would eat a quarter of the
 * sentence to repeat what "near" already said. At region level "near New York"
 * would be a lie of a different kind — it names a city — so the phrasing
 * changes shape instead of adding a qualifier.
 */
export function locationPhrase(
  label: string | null | undefined,
  accuracy: GeoAccuracy | null | undefined,
  opts?: {
    /**
     * Wrap the fragment and the place name in the invisible marks from
     * lib/location-privacy.ts, so a Free account's copy can have the place
     * blocked out server-side and blurred in the app — and so the push, which
     * cannot blur anything, can drop the fragment whole.
     *
     * Only the notification composer asks for this. Every other caller wants
     * the plain sentence it has always returned.
     */
    mark?: boolean;
  },
): string {
  const raw = (label ?? "").trim();
  if (!raw) return "";
  const place = (name: string) => (opts?.mark ? markPlace(name) : name);
  const phrase = (fragment: string) => (opts?.mark ? markPhrase(fragment) : fragment);

  // Pre-accuracy rows keep the wording they have always had.
  if (!accuracy) return phrase(` near ${place(raw)}`);

  switch (accuracy) {
    case "city":
    case "city_approx":
      return phrase(` near ${place(raw)}`);
    case "region": {
      const { head } = splitLabel(raw);
      return phrase(` in the ${place(head)} area`);
    }
    case "country": {
      const code = raw.toUpperCase();
      const name = COUNTRY_NAMES[code];
      if (!name) return phrase(` in ${place(raw)}`);
      return phrase(` in ${TAKES_THE.has(code) ? "the " : ""}${place(name)}`);
    }
  }
}

// Confidence, most precise first. Only used for the aggregation rule below.
const LADDER: GeoAccuracy[] = ["city", "city_approx", "region", "country"];

/**
 * The confidence to show for a GROUP of rows that share one label — the
 * Locations tab is all-time, so one label can have been reached by different
 * routes on different days.
 *
 * THE LEAST PRECISE WINS, because that is the only choice that can never
 * overstate. One label really can arrive two ways: "New York, US" is written
 * both when two databases disagree on the town (region — somewhere in the
 * state) and when the edge alone says the city and nothing confirms it
 * (city_approx). Showing the group as "Near New York, US" would promise the
 * city to rows that never meant it.
 *
 * NULLS ARE IGNORED RATHER THAN TREATED AS WEAKEST. Every row written before
 * the column existed has no accuracy, and counting that as the floor would mute
 * the qualifier forever on any label with history — which is most of them. A
 * group with NOTHING but legacy rows returns null and renders raw: the list a
 * customer looked at yesterday is unchanged.
 */
export function groupAccuracy(
  accuracies: Iterable<GeoAccuracy | null | undefined>,
): GeoAccuracy | null {
  let worst = -1;
  for (const a of accuracies) {
    if (!a) continue;
    const rank = LADDER.indexOf(a);
    if (rank > worst) worst = rank;
  }
  return worst < 0 ? null : LADDER[worst];
}

// Country names for the codes that actually appear in, or plausibly will appear
// in, this product's traffic. An unknown code falls back to the code itself —
// "XK (approximate)" is ugly and honest, which beats both a wrong name and a
// 250-entry table nobody maintains.
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", IE: "Ireland",
  AU: "Australia", NZ: "New Zealand", IL: "Israel", IN: "India", DE: "Germany",
  FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", BE: "Belgium",
  CH: "Switzerland", AT: "Austria", SE: "Sweden", NO: "Norway", DK: "Denmark",
  FI: "Finland", PL: "Poland", PT: "Portugal", GR: "Greece", CZ: "Czechia",
  RO: "Romania", HU: "Hungary", UA: "Ukraine", TR: "Türkiye", RU: "Russia",
  MX: "Mexico", BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia",
  PE: "Peru", JP: "Japan", KR: "South Korea", CN: "China", HK: "Hong Kong",
  SG: "Singapore", MY: "Malaysia", TH: "Thailand", PH: "Philippines",
  ID: "Indonesia", VN: "Vietnam", AE: "United Arab Emirates",
  SA: "Saudi Arabia", QA: "Qatar", ZA: "South Africa", NG: "Nigeria",
  KE: "Kenya", EG: "Egypt", MA: "Morocco", PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
};

// Names stored WITHOUT the article, because the list form reads better without
// it ("United States (approximate)") and the sentence form needs it ("in the
// United States"). One set, rather than two spellings of every country.
const TAKES_THE = new Set(["US", "GB", "NL", "PH", "AE", "VI"]);
