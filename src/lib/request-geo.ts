import type { NextRequest } from "next/server";

// ── Coarse location for one request ──────────────────────────────────────────
//
// Single source of truth for how a view/lead event gets its location. Two
// inputs, both about THIS request's IP, never cached across visitors and
// never client-supplied, so one visitor's location can never be replayed onto
// another visitor's event:
//
//   1. The Vercel edge geo headers (MaxMind) on the request — always present.
//   2. A second, independent IP database (ipinfo with IPINFO_TOKEN, else the
//      keyless ipwho.is), looked up by IP with a hard timeout.
//
// WHY TWO. IP geolocation is a guess about where an ISP registered an address
// block, not where the phone is. 2026-09-03: a Long Island viewer showed as
// "Bolton Landing" — Lake George, four hours away — and the SAME IP came back
// as Trumansburg (Ithaca) from three other databases. Nobody had the town;
// every database was confidently wrong in a different direction. One source
// cannot know it is wrong. Two sources that disagree can, and the honest
// answer then is the level they DO agree on:
//
//   both name the same city   → "City, ST"        (US/CA) or "City, CC"
//   they disagree             → "State, CC"       the region they share
//   cellular carrier IP       → "State, CC"       a carrier hub is never a city
//   only one has a city       → that city         no contradiction, no downgrade
//   second source unavailable → edge headers alone, as before
//
// Honesty rules:
//   • Missing data stays missing — null, never a placeholder city.
//   • A city without a country is still a real signal and is kept, and a bare
//     country code is kept as-is; the UI labels it.
//   • The raw IP is never part of the returned value or stored anywhere.
//
// x-vercel-ip-city is percent-encoded ("S%C3%A3o%20Paulo"). A malformed value
// must degrade to "header absent", not throw — an unguarded decodeURIComponent
// here once turned a bad geo header into a 500 that killed lead capture.

export type GeoGuess = {
  city: string | null;
  /** ISO 3166-2 subdivision code without the country ("NY"), when known. */
  regionCode: string | null;
  /** Human region name ("New York"), when known. */
  regionName: string | null;
  /** Bare ISO country code. */
  country: string | null;
  /** Network owner ("AS6167 Verizon Business") — for the cellular rule only. */
  org: string | null;
};

/** What the edge said about this request. Pure, synchronous, never throws. */
export function edgeGeo(req: NextRequest): GeoGuess {
  const city = safeDecode(req.headers.get("x-vercel-ip-city"));
  const country = isoCountry(req.headers.get("x-vercel-ip-country"));
  const regionRaw = req.headers.get("x-vercel-ip-country-region");
  const regionCode = regionRaw && /^[A-Z0-9]{1,3}$/.test(regionRaw) ? regionRaw : null;
  return { city, regionCode, regionName: regionCode ? US_STATES[regionCode] ?? null : null, country, org: null };
}

/**
 * Edge headers only — the synchronous form. Kept for callers that have no IP
 * to cross-check with; everything that records an event uses resolveLocation.
 */
export function requestLocation(req: NextRequest): string | null {
  return formatLocation(edgeGeo(req));
}

/**
 * Edge headers cross-checked against a second database. Never throws, never
 * slower than the timeout, falls back to the edge answer on any failure.
 */
export async function resolveLocation(req: NextRequest, ip: string): Promise<string | null> {
  const edge = edgeGeo(req);
  const second = await secondOpinion(ip);
  return reconcile(edge, second);
}

/** The decision table in the header comment. Exported for tests. */
export function reconcile(edge: GeoGuess, second: GeoGuess | null): string | null {
  if (!second) return formatLocation(edge);
  const country = edge.country ?? second.country;
  const regionCode = edge.regionCode ?? second.regionCode;
  const regionName = second.regionName ?? edge.regionName ?? (regionCode ? US_STATES[regionCode] ?? null : null);
  // The region is only worth naming if the two sources don't contradict there
  // as well; a code and a name are compared through the same state table.
  const regionsClash =
    (!!edge.regionCode && !!second.regionCode && edge.regionCode !== second.regionCode) ||
    (!!edge.regionName && !!second.regionName && !sameCity(edge.regionName, second.regionName));
  const regional = (): string | null =>
    regionName && country && !regionsClash ? `${regionName}, ${country}` : country ?? formatLocation(edge);

  // A carrier gateway serves a whole region; naming its town is a coin toss.
  if (second.org && CELLULAR.test(second.org)) return regional();

  if (edge.city && second.city) {
    if (sameCity(edge.city, second.city)) return formatLocation(edge);
    // Two databases, two towns: the only thing known is the region.
    if (edge.country && second.country && edge.country !== second.country) return edge.country;
    return regional();
  }
  // One of them has a city and the other doesn't: no contradiction to act on.
  if (edge.city) return formatLocation(edge);
  if (second.city) return formatLocation({ ...second, country: country, regionCode });
  return formatLocation(edge);
}

/** "City, ST" for US/CA (the region code IS the address), "City, CC" elsewhere. */
export function formatLocation(g: Pick<GeoGuess, "city" | "regionCode" | "country">): string | null {
  const { city, regionCode, country } = g;
  if (city && country) {
    const tail = (country === "US" || country === "CA") && regionCode ? regionCode : country;
    return `${city}, ${tail}`;
  }
  return city || country || null;
}

/**
 * Old rows say "Great Neck, US"; rows written from 2026-09-03 say
 * "Great Neck, NY". They are the same place, and the Locations tab is
 * all-time — without this it would list both forever, side by side, as if
 * they were two towns. Returns label → the label it should be counted under
 * (the more specific one), for the labels that have a specific twin.
 *
 * A STATE-level label is never folded into the city of the same name:
 * "New York, US" means somewhere in New York State (the two databases
 * disagreed on the town) and must not be counted as New York City.
 */
export function locationAliases(labels: Iterable<string>): Map<string, string> {
  const all = [...labels];
  const norm = (s: string) => s.trim().toLowerCase();
  const stateNames = new Set(Object.values(US_STATES).map(norm));
  // city → the "City, ST" label seen for it
  const specific = new Map<string, string>();
  for (const label of all) {
    const m = /^(.+), ([A-Z]{2})$/.exec(label);
    if (m && (US_STATES[m[2]] || CA_REGIONS.has(m[2]))) specific.set(norm(m[1]), label);
  }
  const alias = new Map<string, string>();
  for (const label of all) {
    const m = /^(.+), (US|CA)$/.exec(label);
    if (!m || stateNames.has(norm(m[1]))) continue;
    const target = specific.get(norm(m[1]));
    if (target && target !== label) alias.set(label, target);
  }
  return alias;
}

// ── Second opinion ───────────────────────────────────────────────────────────

const LOOKUP_TIMEOUT_MS = 600;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 5000;
// Keyed by IP — the one key that cannot cross-contaminate visitors: the same
// address IS the same network, whoever is on it.
const cache = new Map<string, { guess: GeoGuess | null; expires: number }>();

async function secondOpinion(ip: string): Promise<GeoGuess | null> {
  if (!isPublicIp(ip)) return null;
  const hit = cache.get(ip);
  if (hit && hit.expires > Date.now()) return hit.guess;
  let guess: GeoGuess | null = null;
  try {
    guess = await lookup(ip);
  } catch {
    guess = null; // timeout, network, quota: the edge answer stands alone
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(ip, { guess, expires: Date.now() + CACHE_TTL_MS });
  return guess;
}

async function lookup(ip: string): Promise<GeoGuess | null> {
  const token = process.env.IPINFO_TOKEN?.trim();
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`
    : `https://ipwho.is/${encodeURIComponent(ip)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  if (token) {
    if (j.bogon) return null;
    return {
      city: str(j.city),
      regionCode: null,
      regionName: str(j.region),
      country: isoCountry(str(j.country)),
      org: str(j.org),
    };
  }
  if (j.success === false) return null;
  const conn = (j.connection ?? {}) as Record<string, unknown>;
  return {
    city: str(j.city),
    regionCode: str(j.region_code),
    regionName: str(j.region),
    country: isoCountry(str(j.country_code)),
    org: [str(conn.org), str(conn.isp)].filter(Boolean).join(" ") || null,
  };
}

// Mobile carriers: an address here is a regional gateway, not a place.
const CELLULAR =
  /\b(verizon wireless|cellco|t-mobile|tmobile|sprint|at&t mobility|att mobility|us cellular|metropcs|cricket|boost mobile|dish wireless|vodafone|orange s\.?a|ee limited|telefonica moviles|rogers wireless|bell mobility|telus mobility|freedom mobile|wireless|mobility|mobile|cellular)\b/i;

function sameCity(a: string, b: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a) === norm(b);
}

function isPublicIp(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return false;
  if (/^(::1$|fc|fd|fe80)/i.test(ip)) return false;
  return /^[0-9a-f.:]+$/i.test(ip);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null;
}

// Country must be a bare ISO code — anything else is a spoofed/garbled value.
function isoCountry(v: string | null): string | null {
  return v && /^[A-Z]{2}$/.test(v) ? v : null;
}

function safeDecode(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    // Cap length so a forged header can't grow rows unboundedly.
    return decoded ? decoded.slice(0, 80) : null;
  } catch {
    return null;
  }
}

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "Washington, D.C.", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

// Canadian provinces/territories — codes only; used to tell a province tail
// ("Toronto, ON") from a country tail ("Toronto, CA") when merging labels.
const CA_REGIONS = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);
