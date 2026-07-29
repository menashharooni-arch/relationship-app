// ── PII scrubbing for Sentry ─────────────────────────────────────────────────
//
// HARD RULE: a lead's contact details never leave our stack. Sentry sees stack
// traces and shapes, never people.
//
// This is deliberately belt-and-braces, because the leak is rarely the obvious
// field. Postgres puts the offending VALUE in its error text ("duplicate key
// value violates unique constraint ... (john@acme.com)"), fetch failures embed
// full URLs, and a breadcrumb can carry a whole request body. So rather than
// trusting a list of safe fields, we:
//
//   1. drop the containers that are pure PII (request bodies, cookies, auth
//      headers, the user object beyond an opaque id), and
//   2. walk EVERY remaining string and redact anything email- or phone-shaped.
//
// Pure functions with no Sentry import, so they're unit-testable — the one thing
// you cannot verify by reading a dashboard is a scrubber that silently stopped
// working.

/** Emails: intentionally broad. A false positive costs nothing; a miss is a leak. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Phone numbers. Requires either a leading + or punctuation between digit
 * groups, so it does NOT eat line numbers, ports, timestamps, byte counts or
 * UUID fragments — over-redacting a stack trace destroys the thing we're here
 * to read.
 */
const PHONE_RE = /(?:\+\d[\d\s().-]{7,}\d)|(?:\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b)/g;

/**
 * Keys whose VALUE is dropped wholesale, at any depth. These are the lead-owned
 * fields from the `leads` table plus anything credential-shaped. Matching is on
 * a normalised key (case- and separator-insensitive) so `where_met`, `whereMet`
 * and `WHERE-MET` are all caught.
 */
const DROP_KEYS = new Set([
  // Lead / contact identity
  "email", "phone", "name", "firstname", "lastname", "fullname",
  "notes", "message", "wheremet", "convodetails", "companydescription",
  "address", "street", "city", "postalcode", "zip",
  // Card content that could carry a person's details
  "customization", "vcard", "contact", "lead", "leads",
  // Credentials — never useful in a trace, catastrophic if stored
  "authorization", "cookie", "token", "accesstoken", "refreshtoken",
  "apitoken", "apikey", "secret", "password", "dsn", "servicerolekey",
]);

const REDACTED = "[redacted]";
/** Depth cap: Sentry events are already bounded, this just prevents pathological recursion. */
const MAX_DEPTH = 8;

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[_\-\s]/g, "");
}

/** Redact email/phone shapes inside a free-text string. */
export function scrubString(value: string): string {
  return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED);
}

/**
 * Recursively scrub an arbitrary value: drop sensitive keys entirely, redact
 * PII patterns in every surviving string.
 */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return REDACTED as unknown as T;
  if (typeof value === "string") return scrubString(value) as unknown as T;
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((v) => scrubDeep(v, depth + 1)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = DROP_KEYS.has(normaliseKey(k)) ? REDACTED : scrubDeep(v, depth + 1);
  }
  return out as unknown as T;
}

/**
 * Strip identifying query parameters from a URL but KEEP the path.
 *
 * The path is the diagnostic value ("/api/leads failed"); the query string is
 * where a phone or email would ride along. Card slugs live in the path and are
 * public by design, so they stay — that's how you tell which card broke.
 */
export function scrubUrl(url: string): string {
  const [base, query] = url.split("?");
  if (!query) return scrubString(base);
  return `${scrubString(base)}?[redacted]`;
}

/**
 * Minimal shape of the parts of a Sentry event we touch. Declared locally rather
 * than importing Sentry's types so this file stays dependency-free and testable.
 */
export type ScrubbableEvent = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    query_string?: unknown;
    url?: string;
  };
  // id is string | number in Sentry's own types — mirrored here so the structural
  // cast at the call site stays honest instead of silently widening.
  user?: { id?: string | number; [k: string]: unknown };
  message?: string;
  exception?: { values?: Array<{ value?: string; type?: string; [k: string]: unknown }> };
  breadcrumbs?: Array<Record<string, unknown>>;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  [k: string]: unknown;
};

/** Headers worth keeping — everything else is dropped rather than reviewed. */
const KEEP_HEADERS = new Set(["user-agent", "content-type", "accept-language"]);

/**
 * The Sentry `beforeSend` / `beforeSendTransaction` body.
 *
 * Returns the event with PII removed. Never throws: a scrubber that crashes
 * inside beforeSend would drop the event silently, so anything unexpected
 * results in the event being DISCARDED (return null) rather than sent raw —
 * failing closed is the only safe direction when the alternative is leaking a
 * customer's contacts.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T | null {
  try {
    if (event.request) {
      // Bodies and cookies are dropped outright — there is no version of a
      // request body we want in a third-party dashboard.
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
      if (event.request.url) event.request.url = scrubUrl(event.request.url);
      if (event.request.headers) {
        const kept: Record<string, string> = {};
        for (const [k, v] of Object.entries(event.request.headers)) {
          if (KEEP_HEADERS.has(k.toLowerCase())) kept[k] = scrubString(String(v));
        }
        event.request.headers = kept;
      }
    }

    // Keep only the opaque account id. It's the difference between "one user hit
    // this 400 times" and "400 anonymous errors", and a UUID identifies nobody
    // outside our own database.
    if (event.user) event.user = event.user.id ? { id: event.user.id } : {};

    if (typeof event.message === "string") event.message = scrubString(event.message);

    // Where Postgres and fetch leak values: the exception message itself.
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (typeof ex.value === "string") ex.value = scrubString(ex.value);
      }
    }

    if (event.breadcrumbs) event.breadcrumbs = scrubDeep(event.breadcrumbs);
    if (event.extra) event.extra = scrubDeep(event.extra);
    if (event.tags) event.tags = scrubDeep(event.tags);
    if (event.contexts) event.contexts = scrubDeep(event.contexts);

    return event;
  } catch {
    return null;
  }
}
