import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions, sentryEnabled } from "@/lib/sentry-options";

// ── Server + edge observability ──────────────────────────────────────────────
//
// Next 16 calls register() once per server instance before it accepts requests,
// and onRequestError for every server-side error it captures (see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
//
// Both runtimes are initialised here rather than in separate sentry.*.config.ts
// files so the PII rules live in exactly one place.
//
// MONITORING ONLY. This adds no behaviour: with no DSN set, register() is a
// no-op and the app runs exactly as it did before. The existing reportError()
// path in lib/report-error.ts is untouched and still the thing that raises
// structured logs and chat alerts — Sentry is additive, not a replacement.

export async function register(): Promise<void> {
  if (!sentryEnabled) return;

  // Both branches use the same options; the runtime differs only in what the SDK
  // can instrument. Edge has no Node APIs, so no HTTP/fs auto-instrumentation.
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(baseSentryOptions());
  }
}

/**
 * Server-side error capture, including API route failures and Server Component
 * render errors.
 *
 * Sentry's own helper is used rather than a hand-rolled handler so route,
 * request and render context are attached the way its UI expects. Events still
 * pass through beforeSend, so the scrubbing applies here too.
 *
 * Not gated on sentryEnabled: with Sentry uninitialised this is inert, and
 * gating it would mean Next holds a reference to a function that changes shape
 * depending on env.
 */
export const onRequestError = Sentry.captureRequestError;
