import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions, sentryEnabled } from "@/lib/sentry-options";

// ── Browser observability ────────────────────────────────────────────────────
//
// Runs before the app becomes interactive, so an error during hydration is
// caught too (see Next's instrumentation-client docs). Replaces the older
// sentry.client.config.ts convention.
//
// MONITORING ONLY, and additive: ClientErrorReporter → /api/client-error keeps
// working exactly as before. That path is our own, stays inside our stack, and is
// deliberately left as the primary signal; Sentry adds grouping, release
// attribution and performance data on top.
//
// No session replay (see sentry-options): on a contacts page the DOM IS the
// customer's contact list.

if (sentryEnabled) {
  Sentry.init({
    ...baseSentryOptions(),

    // Web vitals + navigation timing for real users. This is the "page load
    // times" half of performance monitoring; the server half comes from
    // instrumentation.ts.
    integrations: [Sentry.browserTracingIntegration()],

    // Only trace requests to our own origin. Without this, Sentry attaches
    // tracing headers to third-party calls (Stripe, Supabase, Google), which
    // both leaks a trace id and can trip their CORS checks.
    tracePropagationTargets: [/^\//, /^https:\/\/swiftcard\.me/],
  });
}

/**
 * App Router navigation tracking, so a slow client-side route change is visible
 * as a transaction rather than disappearing.
 *
 * Exported unconditionally — Next expects a stable export, and the SDK's own
 * helper is inert when Sentry was never initialised.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
