// ── Product event tracking ──────────────────────────────────────────────────
// The conversion funnel (visit → build → publish → account → plan → pay) was
// instrumented at ZERO points: PostHog was mounted but only ever fired
// $pageview, and its instance wasn't exported, so no call site could fire an
// event even if it wanted to. This is that missing seam.
//
// Design rules, in order of importance:
//
//  1. NEVER block a user action. Every call here is fire-and-forget. An event
//     that fails, or an SDK that isn't configured, must not stop a card from
//     publishing or a checkout from starting. `track()` returns void, is safe to
//     call without awaiting, and swallows everything.
//  2. Inert without a key. With no NEXT_PUBLIC_POSTHOG_KEY the SDK is never
//     imported — no bundle cost, no network, no cookies. Calls become no-ops.
//  3. Names are a closed union, not free strings. A typo'd event name is an
//     event you never see and a funnel that silently under-reports, so the
//     compiler owns the vocabulary.
//  4. No PII. Never pass a name, email, phone, or lead content through here.
//     Ids and enums only — see EventProps.

import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// ── The vocabulary ───────────────────────────────────────────────────────────
// One name per meaningful funnel step. Ordered by where they sit in the journey
// so the list reads as the funnel it measures.
export const EVENTS = [
  // CTA surface
  "cta_clicked",

  // Card creation → publish → share
  "card_creation_started",
  "card_creation_completed",
  "card_published",
  "card_shared",
  "qr_downloaded",
  "wallet_pass_added",

  // Account
  "account_creation_started",
  "account_creation_completed",

  // Plan → pay
  "plan_selected",
  "checkout_started",
  "checkout_completed",

  // Monetisation
  "upgrade_prompt_viewed",
  "upgrade_started",

  // Office
  "office_seat_added",
  "employee_invited",
  "invitation_accepted",

  // Leads
  "lead_captured",
  "lead_contacted",

  // Retention / growth
  "subscription_cancel_started",
  "referral_link_copied",
] as const;

export type EventName = (typeof EVENTS)[number];

// Deliberately narrow. Everything here is an id, an enum, or a count — nothing
// that identifies a human. PostHog already attaches device/timestamp/campaign
// from the pageview, so we don't duplicate them.
export type EventProps = {
  /** Where the click happened, e.g. "homepage_hero". Pairs with `cta`. */
  placement?: string;
  /** The button's stable name, e.g. "create_your_card" — NOT its visible label,
   *  so A/B-testing the label doesn't break the funnel. */
  cta?: string;
  plan?: "free" | "pro" | "office";
  interval?: "monthly" | "annual";
  seats?: number;
  /** Which gated feature triggered an upgrade prompt, e.g. "extra_swiftlink". */
  feature?: string;
  cardId?: string;
  orgId?: string;
  /** How a card was shared: "copy_link" | "qr" | "wallet" | "email" | "sms" | … */
  method?: string;
  /** Free-form but LOW cardinality — never an id or user input. */
  variant?: string;
};

let ph: PostHog | null = null;
let loadPromise: Promise<PostHog | null> | null = null;

// Shared loader so AnalyticsProvider and track() can't race into two init()s.
async function getPostHog(): Promise<PostHog | null> {
  if (!KEY) return null;
  if (ph) return ph;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const mod = await import("posthog-js");
        mod.default.init(KEY, {
          api_host: HOST,
          // Pageviews are captured manually so SPA navigations count exactly once.
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: true,
          // Only spend a person profile on identified users — cheaper, less noise.
          person_profiles: "identified_only",
        });
        ph = mod.default;
        return ph;
      } catch {
        return null; // SDK blocked (ad-blocker, offline) → stay silent forever
      }
    })();
  }
  return loadPromise;
}

/**
 * Fire a product event. Fire-and-forget by design: never await this in a click
 * handler, and never gate navigation on it.
 */
export function track(name: EventName, props: EventProps = {}): void {
  if (!KEY) return;
  if (typeof window === "undefined") return; // server components / SSR: no-op
  void (async () => {
    try {
      const client = await getPostHog();
      client?.capture(name, props);
    } catch {
      // Analytics must never surface to a user.
    }
  })();
}

/** Convenience for the most common event, so call sites stay one line. */
export function trackCta(cta: string, placement: string, props: EventProps = {}): void {
  track("cta_clicked", { cta, placement, ...props });
}

/**
 * Tie events to a user once they're known. Called after sign-in/sign-up.
 * `plan` and `orgId` become person properties so funnels can segment by them.
 */
export function identify(userId: string, props: { plan?: string; orgId?: string } = {}): void {
  if (!KEY || typeof window === "undefined") return;
  void (async () => {
    try {
      const client = await getPostHog();
      client?.identify(userId, props);
    } catch { /* ignore */ }
  })();
}

/** Drop identity on sign-out so the next user isn't merged into the last one. */
export function resetIdentity(): void {
  if (!KEY || typeof window === "undefined") return;
  void (async () => {
    try {
      const client = await getPostHog();
      client?.reset();
    } catch { /* ignore */ }
  })();
}

/** Manual pageview — used by AnalyticsProvider on every route change. */
export function trackPageview(): void {
  if (!KEY || typeof window === "undefined") return;
  void (async () => {
    try {
      const client = await getPostHog();
      client?.capture("$pageview");
    } catch { /* ignore */ }
  })();
}

/** True when analytics is actually configured — for debug surfaces only. */
export const analyticsEnabled = !!KEY;
