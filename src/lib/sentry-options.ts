import { scrubEvent, type ScrubbableEvent } from "./sentry-scrub";

/**
 * Adapter between our scrubber and Sentry's `beforeSend` signature.
 *
 * The cast exists because sentry-scrub is deliberately dependency-free — it
 * declares the event shape itself so it can be unit-tested without the SDK, and
 * TypeScript can't prove two independently-declared structural types are the
 * same. The runtime behaviour is identical; only the nominal identity differs.
 *
 * Typed as a generic pass-through so whichever event type Sentry hands us
 * (ErrorEvent, TransactionEvent) comes back unchanged.
 */
function scrubbed<T>(event: T): T | null {
  return scrubEvent(event as ScrubbableEvent) as T | null;
}

// ── Shared Sentry init options ───────────────────────────────────────────────
//
// One builder for client, server and edge. The three runtimes differ only in
// sample rate and a couple of integrations, so keeping the PII rules in ONE
// place is the point: three config files drift, and the copy that drifts is the
// one that leaks. (This codebase has already been bitten twice by duplicated
// logic — see lib/crm-connection.)
//
// Everything is opt-in on the DSN: with no DSN set, Sentry is disabled and the
// app behaves exactly as it did before. Local dev is silent by default.

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Release identity. VERCEL_GIT_COMMIT_SHA is injected by Vercel on every deploy,
 * so an error maps to the exact commit that shipped it — which is the whole
 * point of release tracking, and what makes the rollback decision obvious.
 */
const RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA;

/** preview and production are separate environments so preview noise never pages anyone. */
const ENVIRONMENT = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

/**
 * Performance sampling. Traces are billed per event, so production samples
 * rather than recording everything; preview and dev record all of it because the
 * volume is negligible and you're actively debugging.
 *
 * Override with SENTRY_TRACES_SAMPLE_RATE to turn the dial without a deploy.
 */
function tracesSampleRate(): number {
  const raw = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return ENVIRONMENT === "production" ? 0.1 : 1;
}

export const sentryEnabled = !!DSN;

export function baseSentryOptions() {
  return {
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // ── The PII contract ────────────────────────────────────────────────────
    // sendDefaultPii MUST stay false. When true, Sentry attaches IP addresses,
    // request headers and cookies automatically — the exact payload we promise
    // never leaves our stack. scrubEvent below is the second line of defence,
    // not the first.
    sendDefaultPii: false,
    beforeSend: scrubbed,
    beforeSendTransaction: scrubbed,

    tracesSampleRate: tracesSampleRate(),

    // No session replay and no profiling: replay records the DOM, which on a
    // contact page IS the customer's contact list. Deliberately off.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Local noise we never want to page on.
    ignoreErrors: [
      // Benign React 19 / Next navigation aborts.
      "AbortError",
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
      // Browser extensions and cross-origin scripts we don't control.
      "Non-Error promise rejection captured",
      "ResizeObserver loop completed with undelivered notifications",
      // A visitor whose Supabase session cookie has expired, landing on a
      // PUBLIC page (/card/[username], /api/site-view, /api/card-events). Those
      // paths ask "is anyone signed in?" purely to personalise, so a dead
      // refresh token is the expected answer, not a fault: getUser() returns a
      // null user and the page renders normally. Only the SDK's internal
      // rejection was reaching Sentry. Ignored rather than papered over at each
      // call site, because the behaviour is already correct — it was the
      // reporting that was wrong, and a try/catch per route would suggest
      // otherwise to the next reader.
      "Invalid Refresh Token",
      "refresh_token_not_found",
    ],

    // Keep the SDK quiet in build logs; the build must not become noisy.
    debug: false,
  };
}
